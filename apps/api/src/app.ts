import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { z } from "zod";
import {
  CheckoutRequest, CompleteRequest, DevLoginRequest, LineCodeRequest, PracticeRequest, WaitlistRequest,
  isFreeStage, isLocale, pickLocale,
  type ApiError, type AuthConfig, type AuthResponse, type CourseMapResponse, type LessonResponse, type Locale, type Me,
  type PracticeResponse, type UrlResponse,
} from "@ai-learn/shared";
import { courseMap, getLesson, type Catalog } from "@ai-learn/content";
import { config } from "./config";
import type { Store, UserRow } from "./db/store";
import type { Quota } from "./quota";
import { todayBangkok } from "./quota";
import type { AiProvider } from "./ai/gateway";
import { runPractice } from "./ai/practice";
import { exchangeLineCode, verifyGoogle, verifyLine, verifyApple, type VerifiedIdentity } from "./auth/providers";
import { applyEntitlement, type StripeBilling } from "./billing/stripe";

export interface Deps {
  store: Store;
  quota: Quota;
  ai: AiProvider;
  catalog: Catalog;
  /** 没配 STRIPE_SECRET_KEY 时为空，付款相关接口返回 NOT_CONFIGURED */
  billing?: StripeBilling;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

const fail = (reply: FastifyReply, status: number, body: ApiError) => reply.code(status).send(body);

/** 曼谷时间今天 0 点 */
const startOfBangkokDay = () => new Date(`${todayBangkok()}T00:00:00+07:00`);

export async function buildApp(deps: Deps) {
  const { store, quota, ai, catalog, billing } = deps;
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  // 生产环境只允许自己的网站跨域调用；开发环境放开
  const origins = config.corsOrigins.length ? config.corsOrigins : [config.webUrl];
  await app.register(cors, { origin: config.isProd ? origins : true });
  await app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: "60d" } });

  /** 读取当前用户（可选登录） */
  async function currentUser(req: FastifyRequest): Promise<UserRow | undefined> {
    if (!req.headers.authorization) return undefined;
    try {
      const { sub } = await req.jwtVerify<{ sub: string }>();
      return store.getUser(sub);
    } catch {
      return undefined;
    }
  }

  /** 语言优先级：?locale= > 用户设置 > 浏览器 Accept-Language > 泰语 */
  function localeOf(req: FastifyRequest, user?: UserRow): Locale {
    const q = (req.query as { locale?: string } | undefined)?.locale;
    if (isLocale(q)) return q;
    if (user) return user.locale;
    return pickLocale(req.headers["accept-language"]);
  }

  async function toMe(u: UserRow): Promise<Me> {
    const ent = await store.getEntitlement(u.id);
    return {
      id: u.id, email: u.email, name: u.name, locale: u.locale,
      plan: ent.plan, planSource: ent.source, planExpiresAt: ent.expiresAt?.toISOString() ?? null,
      canManageBilling: Boolean(u.stripeCustomerId && billing),
      xp: u.xp, streak: u.streak,
    };
  }

  async function issue(identity: Omit<VerifiedIdentity, "provider"> & { provider: string }, locale: Locale): Promise<AuthResponse> {
    const user = await store.findOrCreateUser({ ...identity, locale });
    const token = app.jwt.sign({ sub: user.id });
    return { token, me: await toMe(user) };
  }

  const isPro = async (u: UserRow) => (await store.getEntitlement(u.id)).plan === "pro";
  const canAccess = async (stage: number, u?: UserRow) => isFreeStage(stage) || (u ? await isPro(u) : false);

  app.get("/health", async () => ({ ok: true, ai: ai.name }));

  // ---------- 登录 ----------
  app.get("/auth/config", async (): Promise<AuthConfig> => ({
    lineChannelId: config.auth.lineChannelId || null,
    googleClientId: config.auth.googleClientIds[0] ?? null,
    devLogin: !config.isProd,
  }));

  const TokenBody = z.object({ idToken: z.string().min(10), locale: z.string().optional() });
  const bodyLocale = (req: FastifyRequest, v?: string) => (isLocale(v) ? v : localeOf(req));

  /** App 端：LINE SDK 拿到 id_token 后调用 */
  app.post("/auth/line", async (req, reply) => {
    const body = TokenBody.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: "idToken required", code: "BAD_REQUEST" });
    try {
      return await issue(await verifyLine(body.data.idToken, config.auth.lineChannelId), bodyLocale(req, body.data.locale));
    } catch (e) {
      return fail(reply, 401, { error: (e as Error).message, code: "UNAUTHORIZED" });
    }
  });

  /** 网站：LINE 授权回调拿到 code 后调用 */
  app.post("/auth/line/code", async (req, reply) => {
    const body = LineCodeRequest.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: "code required", code: "BAD_REQUEST" });
    if (!body.data.redirectUri.startsWith(config.webUrl)) {
      return fail(reply, 400, { error: "redirectUri must be on WEB_URL", code: "BAD_REQUEST" });
    }
    try {
      const { lineChannelId, lineChannelSecret } = config.auth;
      const id = await exchangeLineCode(body.data.code, body.data.redirectUri, lineChannelId, lineChannelSecret);
      return await issue(id, bodyLocale(req, body.data.locale));
    } catch (e) {
      return fail(reply, 401, { error: (e as Error).message, code: "UNAUTHORIZED" });
    }
  });

  app.post("/auth/google", async (req, reply) => {
    const body = TokenBody.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: "idToken required", code: "BAD_REQUEST" });
    try {
      return await issue(await verifyGoogle(body.data.idToken, config.auth.googleClientIds), bodyLocale(req, body.data.locale));
    } catch (e) {
      return fail(reply, 401, { error: (e as Error).message, code: "UNAUTHORIZED" });
    }
  });

  app.post("/auth/apple", async (req, reply) => {
    const body = TokenBody.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: "idToken required", code: "BAD_REQUEST" });
    try {
      return await issue(await verifyApple(body.data.idToken), bodyLocale(req, body.data.locale));
    } catch (e) {
      return fail(reply, 501, { error: (e as Error).message, code: "NOT_CONFIGURED" });
    }
  });

  /** 开发用登录：只在非生产环境开放 */
  if (!config.isProd) {
    app.post("/auth/dev", async (req, reply) => {
      const body = DevLoginRequest.safeParse(req.body);
      if (!body.success) return fail(reply, 400, { error: "email required", code: "BAD_REQUEST" });
      return issue({ provider: "email", providerId: body.data.email, email: body.data.email, name: body.data.name ?? null }, localeOf(req));
    });
  }

  app.get("/me", async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return fail(reply, 401, { error: "login required", code: "UNAUTHORIZED" });
    return toMe(u);
  });

  /** 删除账号（PDPA / 应用商店要求）：先取消网站订阅，再删除全部数据 */
  app.delete("/me", async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return fail(reply, 401, { error: "login required", code: "UNAUTHORIZED" });
    if (u.stripeCustomerId && billing) {
      try {
        await billing.cancelAll(u.stripeCustomerId);
      } catch (e) {
        req.log.error(e, "cancel stripe subscriptions failed");
        return fail(reply, 502, { error: "could not cancel subscription, please try again" });
      }
    }
    await store.deleteUser(u.id);
    return { ok: true };
  });

  // ---------- 课程 ----------
  app.get("/courses", async (req): Promise<CourseMapResponse> => {
    const u = await currentUser(req);
    return courseMap(catalog, localeOf(req, u), {
      pro: u ? await isPro(u) : false,
      done: u ? await store.completedLessons(u.id) : undefined,
    });
  });

  app.get<{ Params: { id: string } }>("/lessons/:id", async (req, reply) => {
    const u = await currentUser(req);
    const lesson = getLesson(catalog, localeOf(req, u), req.params.id);
    if (!lesson) return fail(reply, 404, { error: "lesson not found", code: "NOT_FOUND" });
    if (!(await canAccess(lesson.stage, u))) {
      // 锁住的课只返回标题和第一段讲解，不给完整内容
      const preview = { ...lesson, steps: lesson.steps.filter((s) => s.type === "explain").slice(0, 1) };
      return { lesson: preview, locked: true } satisfies LessonResponse;
    }
    return { lesson, locked: false } satisfies LessonResponse;
  });

  // ---------- AI 练习 ----------
  app.post("/practice", async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return fail(reply, 401, { error: "login required", code: "UNAUTHORIZED" });

    const body = PracticeRequest.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: body.error.message, code: "BAD_REQUEST" });

    const locale = localeOf(req, u);
    const lesson = getLesson(catalog, locale, body.data.lessonId);
    const step = lesson?.steps[body.data.stepIndex];
    if (!lesson || !step || step.type !== "practice") {
      return fail(reply, 404, { error: "practice step not found", code: "NOT_FOUND" });
    }
    if (body.data.prompt.length > step.maxChars) {
      return fail(reply, 400, { error: `prompt too long (max ${step.maxChars})`, code: "BAD_REQUEST" });
    }

    const pro = await isPro(u);
    if (!(await canAccess(lesson.stage, u))) return fail(reply, 403, { error: "pro required", code: "LOCKED" });

    const limit = pro ? config.quota.pro : config.quota.free;
    const taken = await quota.take(u.id, limit);
    if (!taken.ok) return fail(reply, 429, { error: "daily practice limit reached", code: "QUOTA_EXCEEDED" });

    try {
      const { usage, ...result } = await runPractice(ai, { task: step.task, rubric: step.rubric, prompt: body.data.prompt, locale });
      await recordUsage(req, u.id, usage);
      return { ...result, quota: { used: taken.used, limit } } satisfies PracticeResponse;
    } catch (e) {
      await quota.refund(u.id);
      req.log.error(e, "AI practice failed");
      return fail(reply, 502, { error: "AI service unavailable, please try again" });
    }
  });

  /** 记录 AI 用量；当天总量超过阈值时告警（每天只告警一次，打到日志里，可接日志告警） */
  let alertedDay = "";
  async function recordUsage(req: FastifyRequest, userId: string, usage: Awaited<ReturnType<typeof runPractice>>["usage"]) {
    try {
      for (const row of usage) await store.logAiUsage({ userId, ...row });
      const threshold = config.ai.dailyTokenAlert;
      const today = todayBangkok();
      if (threshold > 0 && alertedDay !== today) {
        const total = await store.aiTokensSince(startOfBangkokDay());
        if (total > threshold) {
          alertedDay = today;
          req.log.warn({ total, threshold, alert: "AI_DAILY_TOKENS" }, `⚠️ 今日 AI token 用量 ${total} 超过告警线 ${threshold}`);
        }
      }
    } catch (e) {
      // 记账失败不影响用户练习
      req.log.error(e, "record AI usage failed");
    }
  }

  app.get("/practice/quota", async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return fail(reply, 401, { error: "login required", code: "UNAUTHORIZED" });
    return { used: await quota.peek(u.id), limit: (await isPro(u)) ? config.quota.pro : config.quota.free };
  });

  // ---------- 进度 ----------
  app.post("/progress/complete", async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return fail(reply, 401, { error: "login required", code: "UNAUTHORIZED" });
    const body = CompleteRequest.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: body.error.message, code: "BAD_REQUEST" });
    const lesson = getLesson(catalog, localeOf(req, u), body.data.lessonId);
    if (!lesson) return fail(reply, 404, { error: "lesson not found", code: "NOT_FOUND" });
    if (!(await canAccess(lesson.stage, u))) return fail(reply, 403, { error: "pro required", code: "LOCKED" });
    const { first, user } = await store.completeLesson(u.id, lesson.id, body.data.score ?? null, lesson.xp, todayBangkok());
    return { first, me: await toMe(user) };
  });

  // ---------- 落地页预约 ----------
  app.post("/waitlist", async (req, reply) => {
    const body = WaitlistRequest.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: "valid email required", code: "BAD_REQUEST" });
    const added = await store.addWaitlist(body.data.email, bodyLocale(req, body.data.locale));
    return { ok: true, added };
  });

  // ---------- 网站付款（Stripe） ----------
  app.post("/billing/checkout", async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return fail(reply, 401, { error: "login required", code: "UNAUTHORIZED" });
    if (!billing) return fail(reply, 503, { error: "payments not configured", code: "NOT_CONFIGURED" });
    const body = CheckoutRequest.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: "period must be monthly or yearly", code: "BAD_REQUEST" });
    if (await isPro(u)) return fail(reply, 400, { error: "already pro", code: "BAD_REQUEST" });
    try {
      return { url: await billing.checkoutUrl(u, body.data.period, localeOf(req, u)) } satisfies UrlResponse;
    } catch (e) {
      req.log.error(e, "stripe checkout failed");
      return fail(reply, 502, { error: "payment service unavailable, please try again" });
    }
  });

  app.post("/billing/portal", async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return fail(reply, 401, { error: "login required", code: "UNAUTHORIZED" });
    if (!billing || !u.stripeCustomerId) return fail(reply, 404, { error: "no web subscription", code: "NOT_FOUND" });
    try {
      return { url: await billing.portalUrl(u.stripeCustomerId, localeOf(req, u)) } satisfies UrlResponse;
    } catch (e) {
      req.log.error(e, "stripe portal failed");
      return fail(reply, 502, { error: "payment service unavailable, please try again" });
    }
  });

  // ---------- 订阅回调 ----------
  /**
   * RevenueCat 统一处理 App Store / Google Play 订阅。
   * 在 RevenueCat 后台把 App User ID 设成我们的用户 id，并配置 Authorization 头。
   */
  app.post("/webhooks/revenuecat", async (req, reply) => {
    if (!config.revenuecatToken || req.headers.authorization !== `Bearer ${config.revenuecatToken}`) {
      return fail(reply, 401, { error: "bad token", code: "UNAUTHORIZED" });
    }
    const ev = (req.body as { event?: { type: string; app_user_id: string; expiration_at_ms?: number; store?: string } }).event;
    if (!ev) return fail(reply, 400, { error: "no event", code: "BAD_REQUEST" });
    // 匿名用户（还没登录就购买）或不存在的用户：返回 200，避免 RevenueCat 无限重试
    if (!ev.app_user_id || ev.app_user_id.startsWith("$RCAnonymousID") || !(await store.getUser(ev.app_user_id))) {
      req.log.warn({ type: ev.type, appUserId: ev.app_user_id }, "revenuecat event for unknown user ignored");
      return { ok: true, ignored: true };
    }
    const active = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"].includes(ev.type);
    const ended = ev.type === "EXPIRATION";
    if (active || ended) {
      await applyEntitlement(store, ev.app_user_id, {
        plan: active ? "pro" : "free",
        source: ev.store === "PLAY_STORE" ? "play_store" : "app_store",
        expiresAt: ev.expiration_at_ms ? new Date(ev.expiration_at_ms) : null,
      });
    }
    return { ok: true };
  });

  /** Stripe webhook：需要原始请求体校验签名，所以单独放在一个作用域里用 Buffer 解析 */
  await app.register(async (scope) => {
    scope.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
    scope.post("/webhooks/stripe", async (req, reply) => {
      if (!billing) return fail(reply, 503, { error: "payments not configured", code: "NOT_CONFIGURED" });
      const sig = req.headers["stripe-signature"];
      let event;
      try {
        event = billing.parseEvent(req.body as Buffer, String(sig ?? ""));
      } catch {
        return fail(reply, 400, { error: "bad signature", code: "BAD_REQUEST" });
      }
      await billing.handleEvent(event, store);
      return { received: true };
    });
  });

  return app;
}
