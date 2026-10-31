import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { loadCatalog } from "@ai-learn/content";
import { buildApp } from "./app";
import { config } from "./config";
import { MemoryStore, PgStore, nextStreak, type Store } from "./db/store";
import { runMigrations } from "./db/migrate";
import { MemoryQuota } from "./quota";
import { MockProvider } from "./ai/gateway";
import { parseFeedback } from "./ai/practice";
import { StripeBilling } from "./billing/stripe";

process.env.NODE_ENV = "test";
config.revenuecatToken = "rc-test";

const WEBHOOK_SECRET = "whsec_test_secret";
const catalog = loadCatalog();

/**
 * 同一套接口测试分别跑在内存版和 Postgres 版上，保证两者行为一致。
 * Postgres 版需要 TEST_DATABASE_URL（没配就跳过），例如：
 *   TEST_DATABASE_URL=postgres://ailearn@localhost:5432/ailearn_test pnpm --filter @ai-learn/api test
 */
const pgUrl = process.env.TEST_DATABASE_URL;
const kinds: Array<{ name: string; make: () => Promise<Store>; skip?: string }> = [
  { name: "MemoryStore", make: async () => new MemoryStore() },
  { name: "PgStore", make: async () => pgStore!, skip: pgUrl ? undefined : "未设置 TEST_DATABASE_URL" },
];
let pgStore: PgStore | undefined;

before(async () => {
  if (!pgUrl) return;
  pgStore = new PgStore(pgUrl);
  await pgStore.db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`);
  await runMigrations(pgStore);
});
after(async () => { await pgStore?.close(); });

for (const kind of kinds) {
  describe(kind.name, { skip: kind.skip }, () => {
    let store: Store;

    beforeEach(async () => {
      store = await kind.make();
      if (store instanceof PgStore) {
        await store.db.execute(sql`truncate users, progress, entitlements, ai_usage, waitlist restart identity cascade`);
      }
    });

    async function setup(email = "a@test.com") {
      const billing = new StripeBilling({ secretKey: "sk_test_dummy", webhookSecret: WEBHOOK_SECRET, priceMonthly: "", priceYearly: "", webUrl: "http://localhost:3000" });
      const app = await buildApp({ store, quota: new MemoryQuota(), ai: new MockProvider(), catalog, billing });
      const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { email } });
      const { token, me } = login.json();
      return { app, me, billing, auth: { authorization: `Bearer ${token}` } };
    }

    test("课程地图：泰语默认，付费阶段上锁", async () => {
      const { app } = await setup();
      const { stages } = (await app.inject({ method: "GET", url: "/courses" })).json();
      assert.equal(stages[0].locale, "th");
      assert.equal(stages[0].free, true);
      assert.equal(stages[0].lessons[0].locked, false);
      const s2 = stages.find((s: { stage: number }) => s.stage === 2);
      assert.equal(s2.free, false);
      assert.equal(s2.lessons[0].locked, true);
    });

    test("中文缺课时回退到泰语", async () => {
      const { app } = await setup();
      const s2 = (await app.inject({ method: "GET", url: "/courses?locale=zh" })).json().stages.find((s: { stage: number }) => s.stage === 2);
      assert.equal(s2.lessons[0].locale, "th");
    });

    test("锁住的课只给预览", async () => {
      const { app } = await setup();
      const r = (await app.inject({ method: "GET", url: "/lessons/s2-01" })).json();
      assert.equal(r.locked, true);
      assert.equal(r.lesson.steps.length, 1);
    });

    test("练习：需登录、按限额扣次数、记录 AI 用量", async () => {
      const { app, auth } = await setup();
      const payload = { lessonId: "s0-01", stepIndex: 2, prompt: "ช่วยคิดเมนูอาหารเย็น 3 อย่าง ทำได้ใน 20 นาที" };
      assert.equal((await app.inject({ method: "POST", url: "/practice", payload })).statusCode, 401);

      const ok = await app.inject({ method: "POST", url: "/practice", payload, headers: auth });
      assert.equal(ok.statusCode, 200);
      assert.equal(ok.json().quota.used, 1);
      assert.ok(typeof ok.json().feedback.score === "number");
      assert.equal(ok.json().usage, undefined, "用量明细不返回给前端");
      assert.ok((await store.aiTokensSince(new Date(Date.now() - 60_000))) > 0);

      for (let i = 0; i < 4; i++) await app.inject({ method: "POST", url: "/practice", payload, headers: auth });
      assert.equal((await app.inject({ method: "POST", url: "/practice", payload, headers: auth })).statusCode, 429);
    });

    test("免费用户不能练习付费课，开通会员后可以", async () => {
      const { app, auth, me } = await setup();
      const payload = { lessonId: "s2-01", stepIndex: 1, prompt: "สรุปข่าวนี้ 3 ข้อ" };
      assert.equal((await app.inject({ method: "POST", url: "/practice", payload, headers: auth })).statusCode, 403);
      await store.setEntitlement(me.id, { plan: "pro", source: "stripe", expiresAt: new Date(Date.now() + 86400000) });
      assert.equal((await app.inject({ method: "POST", url: "/practice", payload, headers: auth })).statusCode, 200);
    });

    test("会员过期后自动变回免费", async () => {
      const { app, auth, me } = await setup();
      await store.setEntitlement(me.id, { plan: "pro", source: "stripe", expiresAt: new Date(Date.now() - 1000) });
      assert.equal((await app.inject({ method: "GET", url: "/me", headers: auth })).json().plan, "free");
    });

    test("完成课程：首次加经验值，重复不加", async () => {
      const { app, auth } = await setup();
      const a = await app.inject({ method: "POST", url: "/progress/complete", payload: { lessonId: "s0-01", score: 70 }, headers: auth });
      assert.equal(a.json().first, true);
      assert.equal(a.json().me.xp, 10);
      assert.equal(a.json().me.streak, 1);
      const b = await app.inject({ method: "POST", url: "/progress/complete", payload: { lessonId: "s0-01", score: 90 }, headers: auth });
      assert.equal(b.json().first, false);
      assert.equal(b.json().me.xp, 10);
      const map = (await app.inject({ method: "GET", url: "/courses", headers: auth })).json();
      assert.equal(map.stages[0].lessons[0].completed, true);
    });

    test("同一邮箱用两种方式登录不报错（各自一个账号）", async () => {
      const a = await store.findOrCreateUser({ provider: "line", providerId: "L1", email: "same@test.com", locale: "th" });
      const b = await store.findOrCreateUser({ provider: "google", providerId: "G1", email: "same@test.com", locale: "th" });
      const a2 = await store.findOrCreateUser({ provider: "line", providerId: "L1", email: "same@test.com", locale: "th" });
      assert.notEqual(a.id, b.id);
      assert.equal(a.id, a2.id);
    });

    test("并发登录同一个人只建一个账号", async () => {
      const input = { provider: "line", providerId: "L-race", email: null, locale: "th" as const };
      const users = await Promise.all(Array.from({ length: 5 }, () => store.findOrCreateUser(input)));
      assert.equal(new Set(users.map((u) => u.id)).size, 1);
    });

    test("删除账号：数据一并删除，旧 token 失效", async () => {
      const { app, auth, me } = await setup();
      await app.inject({ method: "POST", url: "/progress/complete", payload: { lessonId: "s0-01" }, headers: auth });
      assert.equal((await app.inject({ method: "DELETE", url: "/me", headers: auth })).statusCode, 200);
      assert.equal(await store.getUser(me.id), undefined);
      assert.equal((await store.completedLessons(me.id)).size, 0);
      assert.equal((await app.inject({ method: "GET", url: "/me", headers: auth })).statusCode, 401);
    });

    test("预约名单：重复邮箱不重复添加", async () => {
      const { app } = await setup();
      const r1 = await app.inject({ method: "POST", url: "/waitlist", payload: { email: "W@test.com", locale: "th" } });
      const r2 = await app.inject({ method: "POST", url: "/waitlist", payload: { email: "w@test.com" } });
      assert.equal(r1.json().added, true);
      assert.equal(r2.json().added, false);
      assert.equal((await app.inject({ method: "POST", url: "/waitlist", payload: { email: "bad" } })).statusCode, 400);
    });

    test("Stripe webhook：校验签名，订阅生效 / 取消", async () => {
      const { app, me, billing, auth } = await setup();
      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
      const send = async (status: string, sig?: string) => {
        const payload = JSON.stringify({
          id: "evt_1", object: "event", type: "customer.subscription.updated",
          data: { object: { id: "sub_1", object: "subscription", status, metadata: { userId: me.id }, items: { data: [{ current_period_end: periodEnd }] } } },
        });
        const header = sig ?? billing.stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
        return app.inject({ method: "POST", url: "/webhooks/stripe", payload, headers: { "content-type": "application/json", "stripe-signature": header } });
      };

      assert.equal((await send("active", "t=1,v1=bad")).statusCode, 400);
      assert.equal((await send("active")).statusCode, 200);
      const pro = (await app.inject({ method: "GET", url: "/me", headers: auth })).json();
      assert.equal(pro.plan, "pro");
      assert.equal(pro.planSource, "stripe");
      assert.equal(new Date(pro.planExpiresAt).getTime(), periodEnd * 1000);

      assert.equal((await send("canceled")).statusCode, 200);
      assert.equal((await app.inject({ method: "GET", url: "/me", headers: auth })).json().plan, "free");
    });

    test("一个来源到期不会覆盖另一个来源仍有效的会员", async () => {
      const { app, me, auth } = await setup();
      await store.setEntitlement(me.id, { plan: "pro", source: "stripe", expiresAt: new Date(Date.now() + 86400000) });
      const rc = (type: string) => app.inject({
        method: "POST", url: "/webhooks/revenuecat", headers: { authorization: "Bearer rc-test" },
        payload: { event: { type, app_user_id: me.id, store: "PLAY_STORE" } },
      });
      assert.equal((await rc("EXPIRATION")).statusCode, 200);
      const after = (await app.inject({ method: "GET", url: "/me", headers: auth })).json();
      assert.equal(after.plan, "pro");
      assert.equal(after.planSource, "stripe");
    });

    test("RevenueCat：匿名或不存在的用户返回 200 并忽略", async () => {
      const { app } = await setup();
      for (const id of ["$RCAnonymousID:abc", "no-such-user"]) {
        const r = await app.inject({
          method: "POST", url: "/webhooks/revenuecat", headers: { authorization: "Bearer rc-test" },
          payload: { event: { type: "INITIAL_PURCHASE", app_user_id: id } },
        });
        assert.equal(r.statusCode, 200);
        assert.equal(r.json().ignored, true);
      }
    });
  });
}

test("连续打卡计算", () => {
  assert.equal(nextStreak(null, 0, "2026-11-01"), 1);
  assert.equal(nextStreak("2026-10-31", 3, "2026-11-01"), 4);
  assert.equal(nextStreak("2026-10-29", 3, "2026-11-01"), 1);
  assert.equal(nextStreak("2026-11-01", 4, "2026-11-01"), 4);
});

test("点评 JSON 容错", () => {
  assert.equal(parseFeedback('好的 {"score": 85, "good": ["ok"], "improve": []}').score, 85);
  assert.equal(parseFeedback("not json").passed, true);
});
