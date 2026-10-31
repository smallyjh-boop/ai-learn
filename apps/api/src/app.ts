import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { z } from "zod";
import {
  CompleteRequest, DevLoginRequest, FREE_STAGES, PracticeRequest, isLocale, pickLocale,
  type ApiError, type AuthResponse, type CourseMapResponse, type LessonResponse, type Locale, type Me,
  type PracticeResponse,
} from "@ai-learn/shared";
import { getLesson, getStages, listLessons, type Catalog } from "@ai-learn/content";
import { config } from "./config";
import type { Store, UserRow } from "./db/store";
import type { Quota } from "./quota";
import { todayBangkok } from "./quota";
import type { AiProvider } from "./ai/gateway";
import { runPractice } from "./ai/practice";
import { verifyGoogle, verifyLine, verifyApple, type VerifiedIdentity } from "./auth/providers";

export interface Deps {
  store: Store;
  quota: Quota;
  ai: AiProvider;
  catalog: Catalog;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

const fail = (reply: FastifyReply, status: number, body: ApiError) => reply.code(status).send(body);

export async function buildApp(deps: Deps) {
  const { store, quota, ai, catalog } = deps;
  const app = Fastify({ logger: !process.env.VITEST && process.env.NODE_ENV !== "test" });

  await app.register(cors, { origin: true });
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
    return { id: u.id, email: u.email, name: u.name, locale: u.locale, plan: ent.plan, xp: u.xp, streak: u.streak };
  }

  async function issue(identity: Omit<VerifiedIdentity, "provider"> & { provider: string }, locale: Locale): Promise<AuthResponse> {
    const user = await store.findOrCreateUser({ ...identity, locale });
    const token = app.jwt.sign({ sub: user.id });
    return { token, me: await toMe(user) };
  }

  app.get("/health", async () => ({ ok: true, ai: ai.name }));

  // ---------- 登录 ----------
  const TokenBody = z.object({ idToken: z.string().min(10), locale: z.string().optional() });

  app.post("/auth/line", async (req, reply) => {
    const body = TokenBody.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: "idToken required", code: "BAD_REQUEST" });
    try {
      const id = await verifyLine(body.data.idToken, process.env.LINE_CHANNEL_ID ?? "");
      return issue(id, isLocale(body.data.locale) ? body.data.locale : "th");
    } catch (e) {
      return fail(reply, 401, { error: (e as Error).message, code: "UNAUTHORIZED" });
    }
  });

  app.post("/auth/google", async (req, reply) => {
    const body = TokenBody.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: "idToken required", code: "BAD_REQUEST" });
    try {
      const ids = (process.env.GOOGLE_CLIENT_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const id = await verifyGoogle(body.data.idToken, ids);
      return issue(id, isLocale(body.data.locale) ? body.data.locale : localeOf(req));
    } catch (e) {
      return fail(reply, 401, { error: (e as Error).message, code: "UNAUTHORIZED" });
    }
  });

  app.post("/auth/apple", async (req, reply) => {
    const body = TokenBody.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: "idToken required", code: "BAD_REQUEST" });
    try {
      return issue(await verifyApple(body.data.idToken), localeOf(req));
    } catch (e) {
      return fail(reply, 501, { error: (e as Error).message });
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

  // ---------- 课程 ----------
  app.get("/courses", async (req): Promise<CourseMapResponse> => {
    const u = await currentUser(req);
    const locale = localeOf(req, u);
    const plan = u ? (await store.getEntitlement(u.id)).plan : "free";
    const done = u ? await store.completedLessons(u.id) : new Map<string, number | null>();
    const lessons = listLessons(catalog, locale);
    const stages = getStages(catalog, locale).map((s) => ({
      ...s,
      lessons: lessons
        .filter((l) => l.stage === s.stage)
        .map(({ steps: _steps, ...meta }) => ({
          ...meta,
          locked: !s.free && plan !== "pro",
          completed: done.has(meta.id),
        })),
    }));
    return { stages };
  });

  app.get<{ Params: { id: string } }>("/lessons/:id", async (req, reply) => {
    const u = await currentUser(req);
    const lesson = getLesson(catalog, localeOf(req, u), req.params.id);
    if (!lesson) return fail(reply, 404, { error: "lesson not found", code: "NOT_FOUND" });
    const plan = u ? (await store.getEntitlement(u.id)).plan : "free";
    const locked = !FREE_STAGES.includes(lesson.stage) && plan !== "pro";
    if (locked) {
      // 锁住的课只返回标题和简介，不给内容
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

    const plan = (await store.getEntitlement(u.id)).plan;
    if (!FREE_STAGES.includes(lesson.stage) && plan !== "pro") {
      return fail(reply, 403, { error: "pro required", code: "LOCKED" });
    }

    const limit = plan === "pro" ? config.quota.pro : config.quota.free;
    const taken = await quota.take(u.id, limit);
    if (!taken.ok) return fail(reply, 429, { error: "daily practice limit reached", code: "QUOTA_EXCEEDED" });

    try {
      const result = await runPractice(ai, { task: step.task, rubric: step.rubric, prompt: body.data.prompt, locale });
      return { ...result, quota: { used: taken.used, limit } } satisfies PracticeResponse;
    } catch (e) {
      await quota.refund(u.id);
      req.log.error(e, "AI practice failed");
      return fail(reply, 502, { error: "AI service unavailable, please try again" });
    }
  });

  app.get("/practice/quota", async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return fail(reply, 401, { error: "login required", code: "UNAUTHORIZED" });
    const plan = (await store.getEntitlement(u.id)).plan;
    return { used: await quota.peek(u.id), limit: plan === "pro" ? config.quota.pro : config.quota.free };
  });

  // ---------- 进度 ----------
  app.post("/progress/complete", async (req, reply) => {
    const u = await currentUser(req);
    if (!u) return fail(reply, 401, { error: "login required", code: "UNAUTHORIZED" });
    const body = CompleteRequest.safeParse(req.body);
    if (!body.success) return fail(reply, 400, { error: body.error.message, code: "BAD_REQUEST" });
    const lesson = getLesson(catalog, u.locale, body.data.lessonId);
    if (!lesson) return fail(reply, 404, { error: "lesson not found", code: "NOT_FOUND" });
    const plan = (await store.getEntitlement(u.id)).plan;
    if (!FREE_STAGES.includes(lesson.stage) && plan !== "pro") {
      return fail(reply, 403, { error: "pro required", code: "LOCKED" });
    }
    const { first, user } = await store.completeLesson(u.id, lesson.id, body.data.score ?? null, lesson.xp, todayBangkok());
    return { first, me: await toMe(user) };
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
    const active = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"].includes(ev.type);
    const ended = ev.type === "EXPIRATION";
    if (active || ended) {
      await store.setEntitlement(ev.app_user_id, {
        plan: active ? "pro" : "free",
        source: ev.store === "PLAY_STORE" ? "play_store" : "app_store",
        expiresAt: ev.expiration_at_ms ? new Date(ev.expiration_at_ms) : null,
      });
    }
    return { ok: true };
  });

  /** Stripe（网站付款）—— TODO：用 stripe SDK 校验签名后，按 client_reference_id = 用户id 写入权益 */
  app.post("/webhooks/stripe", async (_req, reply) => fail(reply, 501, { error: "not implemented yet" }));

  return app;
}
