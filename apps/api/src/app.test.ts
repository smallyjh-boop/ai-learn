import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCatalog } from "@ai-learn/content";
import { buildApp } from "./app";
import { MemoryStore, nextStreak } from "./db/store";
import { MemoryQuota } from "./quota";
import { MockProvider } from "./ai/gateway";
import { parseFeedback } from "./ai/practice";

process.env.NODE_ENV = "test";

async function setup() {
  const store = new MemoryStore();
  const app = await buildApp({ store, quota: new MemoryQuota(), ai: new MockProvider(), catalog: loadCatalog() });
  const login = await app.inject({ method: "POST", url: "/auth/dev", payload: { email: "a@test.com" } });
  const { token, me } = login.json();
  return { app, store, me, auth: { authorization: `Bearer ${token}` } };
}

test("课程地图：泰语默认，付费阶段上锁", async () => {
  const { app } = await setup();
  const res = await app.inject({ method: "GET", url: "/courses" });
  const { stages } = res.json();
  assert.equal(stages[0].locale, "th");
  assert.equal(stages[0].lessons[0].locked, false);
  assert.equal(stages.find((s: { stage: number }) => s.stage === 2).lessons[0].locked, true);
});

test("中文缺课时回退到泰语", async () => {
  const { app } = await setup();
  const res = await app.inject({ method: "GET", url: "/courses?locale=zh" });
  const s2 = res.json().stages.find((s: { stage: number }) => s.stage === 2);
  assert.equal(s2.lessons[0].locale, "th");
});

test("练习：需登录、按限额扣次数", async () => {
  const { app, auth } = await setup();
  const payload = { lessonId: "s0-01", stepIndex: 2, prompt: "ช่วยคิดเมนูอาหารเย็น 3 อย่าง ทำได้ใน 20 นาที" };
  assert.equal((await app.inject({ method: "POST", url: "/practice", payload })).statusCode, 401);

  const ok = await app.inject({ method: "POST", url: "/practice", payload, headers: auth });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().quota.used, 1);
  assert.ok(typeof ok.json().feedback.score === "number");

  for (let i = 0; i < 4; i++) await app.inject({ method: "POST", url: "/practice", payload, headers: auth });
  const over = await app.inject({ method: "POST", url: "/practice", payload, headers: auth });
  assert.equal(over.statusCode, 429);
});

test("免费用户不能练习付费课，开通会员后可以", async () => {
  const { app, auth, store, me } = await setup();
  const payload = { lessonId: "s2-01", stepIndex: 1, prompt: "สรุปข่าวนี้ 3 ข้อ" };
  assert.equal((await app.inject({ method: "POST", url: "/practice", payload, headers: auth })).statusCode, 403);
  await store.setEntitlement(me.id, { plan: "pro", source: "stripe", expiresAt: new Date(Date.now() + 86400000) });
  assert.equal((await app.inject({ method: "POST", url: "/practice", payload, headers: auth })).statusCode, 200);
});

test("完成课程：首次加经验值，重复不加", async () => {
  const { app, auth } = await setup();
  const a = await app.inject({ method: "POST", url: "/progress/complete", payload: { lessonId: "s0-01", score: 70 }, headers: auth });
  assert.equal(a.json().me.xp, 10);
  assert.equal(a.json().me.streak, 1);
  const b = await app.inject({ method: "POST", url: "/progress/complete", payload: { lessonId: "s0-01", score: 90 }, headers: auth });
  assert.equal(b.json().first, false);
  assert.equal(b.json().me.xp, 10);
});

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
