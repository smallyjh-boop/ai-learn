import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Locale, Plan } from "@ai-learn/shared";
import * as schema from "./schema";

export interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  locale: Locale;
  provider: string;
  providerId: string;
  xp: number;
  streak: number;
  lastStudyDay: string | null;
  stripeCustomerId: string | null;
}

export interface AiUsageRow {
  userId: string | null;
  kind: "practice" | "grade";
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface Entitlement {
  plan: Plan;
  source: string | null;
  expiresAt: Date | null;
}

/**
 * 数据访问接口。开发时没配 DATABASE_URL 就用内存版，
 * 正式环境用 Postgres 版。两者行为一致。
 */
export interface Store {
  findOrCreateUser(input: { provider: string; providerId: string; email?: string | null; name?: string | null; locale: Locale }): Promise<UserRow>;
  getUser(id: string): Promise<UserRow | undefined>;
  getEntitlement(userId: string): Promise<Entitlement>;
  setEntitlement(userId: string, e: Entitlement): Promise<void>;
  completedLessons(userId: string): Promise<Map<string, number | null>>;
  /** 记一课完成；首次完成返回 true（加经验值），重复完成只更新最高分 */
  completeLesson(userId: string, lessonId: string, score: number | null, xp: number, today: string): Promise<{ first: boolean; user: UserRow }>;
  setStripeCustomer(userId: string, customerId: string): Promise<void>;
  /** 删除账号及其全部数据（进度、权益、AI 用量） */
  deleteUser(userId: string): Promise<void>;
  logAiUsage(row: AiUsageRow): Promise<void>;
  /** 某时间点以来的 AI token 总数（输入+输出），用于告警 */
  aiTokensSince(since: Date): Promise<number>;
  /** 加入预约名单；已存在返回 false */
  addWaitlist(email: string, locale: Locale): Promise<boolean>;
}

/** 根据上次学习日期更新连续打卡天数 */
export function nextStreak(last: string | null, current: number, today: string): number {
  if (last === today) return Math.max(current, 1);
  if (!last) return 1;
  const diff = (Date.parse(today) - Date.parse(last)) / 86_400_000;
  return diff === 1 ? current + 1 : 1;
}

function activePlan(e: Entitlement | undefined): Entitlement {
  if (!e) return { plan: "free", source: null, expiresAt: null };
  if (e.plan === "pro" && e.expiresAt && e.expiresAt.getTime() < Date.now()) {
    return { plan: "free", source: e.source, expiresAt: e.expiresAt };
  }
  return e;
}

// ---------------- 内存版（开发 / 测试） ----------------
export class MemoryStore implements Store {
  private users = new Map<string, UserRow>();
  private ents = new Map<string, Entitlement>();
  private prog = new Map<string, Map<string, number | null>>();
  private usage: Array<AiUsageRow & { at: Date }> = [];
  private wait = new Map<string, Locale>();

  async findOrCreateUser(input: Parameters<Store["findOrCreateUser"]>[0]) {
    for (const u of this.users.values()) {
      if (u.provider === input.provider && u.providerId === input.providerId) return u;
    }
    const u: UserRow = {
      id: randomUUID(), email: input.email ?? null, name: input.name ?? null, locale: input.locale,
      provider: input.provider, providerId: input.providerId, xp: 0, streak: 0, lastStudyDay: null, stripeCustomerId: null,
    };
    this.users.set(u.id, u);
    return u;
  }
  async getUser(id: string) { return this.users.get(id); }
  async getEntitlement(userId: string) { return activePlan(this.ents.get(userId)); }
  async setEntitlement(userId: string, e: Entitlement) { this.ents.set(userId, e); }
  async completedLessons(userId: string) { return new Map(this.prog.get(userId) ?? []); }
  async completeLesson(userId: string, lessonId: string, score: number | null, xp: number, today: string) {
    const u = this.users.get(userId);
    if (!u) throw new Error("user not found");
    const map = this.prog.get(userId) ?? new Map<string, number | null>();
    this.prog.set(userId, map);
    const first = !map.has(lessonId);
    const prev = map.get(lessonId) ?? null;
    map.set(lessonId, score === null ? prev : Math.max(prev ?? 0, score));
    if (first) u.xp += xp;
    u.streak = nextStreak(u.lastStudyDay, u.streak, today);
    u.lastStudyDay = today;
    return { first, user: u };
  }
  async setStripeCustomer(userId: string, customerId: string) {
    const u = this.users.get(userId);
    if (u) u.stripeCustomerId = customerId;
  }
  async deleteUser(userId: string) {
    this.users.delete(userId);
    this.ents.delete(userId);
    this.prog.delete(userId);
    this.usage = this.usage.filter((r) => r.userId !== userId);
  }
  async logAiUsage(row: AiUsageRow) { this.usage.push({ ...row, at: new Date() }); }
  async aiTokensSince(since: Date) {
    return this.usage.filter((r) => r.at >= since).reduce((n, r) => n + r.inputTokens + r.outputTokens, 0);
  }
  async addWaitlist(email: string, locale: Locale) {
    const k = email.toLowerCase();
    if (this.wait.has(k)) return false;
    this.wait.set(k, locale);
    return true;
  }
}

// ---------------- Postgres 版（正式环境） ----------------
export class PgStore implements Store {
  readonly db: PostgresJsDatabase<typeof schema>;
  private client: postgres.Sql;
  constructor(url: string) {
    this.client = postgres(url, { max: 10, onnotice: () => {} });
    this.db = drizzle(this.client, { schema });
  }

  async close() { await this.client.end(); }

  private toRow(r: typeof schema.users.$inferSelect): UserRow {
    return { ...r, locale: r.locale as Locale };
  }

  async findOrCreateUser(input: Parameters<Store["findOrCreateUser"]>[0]) {
    const byProvider = and(eq(schema.users.provider, input.provider), eq(schema.users.providerId, input.providerId));
    const found = await this.db.select().from(schema.users).where(byProvider).limit(1);
    if (found[0]) return this.toRow(found[0]);
    // 并发登录时可能同时插入：靠唯一索引兜底，冲突就再查一次
    const [created] = await this.db.insert(schema.users).values({
      id: randomUUID(), provider: input.provider, providerId: input.providerId,
      email: input.email ?? null, name: input.name ?? null, locale: input.locale,
    }).onConflictDoNothing().returning();
    if (created) return this.toRow(created);
    const [again] = await this.db.select().from(schema.users).where(byProvider).limit(1);
    return this.toRow(again!);
  }

  async getUser(id: string) {
    const r = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return r[0] ? this.toRow(r[0]) : undefined;
  }

  async getEntitlement(userId: string) {
    const r = await this.db.select().from(schema.entitlements).where(eq(schema.entitlements.userId, userId)).limit(1);
    return activePlan(r[0] ? { plan: r[0].plan as Plan, source: r[0].source, expiresAt: r[0].expiresAt } : undefined);
  }

  async setEntitlement(userId: string, e: Entitlement) {
    await this.db.insert(schema.entitlements)
      .values({ userId, plan: e.plan, source: e.source, expiresAt: e.expiresAt })
      .onConflictDoUpdate({
        target: schema.entitlements.userId,
        set: { plan: e.plan, source: e.source, expiresAt: e.expiresAt, updatedAt: new Date() },
      });
  }

  async completedLessons(userId: string) {
    const rows = await this.db.select().from(schema.progress).where(eq(schema.progress.userId, userId));
    return new Map(rows.map((r) => [r.lessonId, r.bestScore] as const));
  }

  async completeLesson(userId: string, lessonId: string, score: number | null, xp: number, today: string) {
    return this.db.transaction(async (tx) => {
      const inserted = await tx.insert(schema.progress)
        .values({ userId, lessonId, bestScore: score })
        .onConflictDoUpdate({
          target: [schema.progress.userId, schema.progress.lessonId],
          set: { bestScore: sql`greatest(coalesce(${schema.progress.bestScore}, 0), ${score ?? 0})` },
        })
        .returning({ first: sql<boolean>`(xmax = 0)` });
      const first = Boolean(inserted[0]?.first);
      const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, userId)).for("update");
      if (!u) throw new Error("user not found");
      const streak = nextStreak(u.lastStudyDay, u.streak, today);
      const [updated] = await tx.update(schema.users)
        .set({ xp: u.xp + (first ? xp : 0), streak, lastStudyDay: today })
        .where(eq(schema.users.id, userId)).returning();
      return { first, user: this.toRow(updated!) };
    });
  }

  async setStripeCustomer(userId: string, customerId: string) {
    await this.db.update(schema.users).set({ stripeCustomerId: customerId }).where(eq(schema.users.id, userId));
  }

  async deleteUser(userId: string) {
    // progress / entitlements / ai_usage 都是 on delete cascade
    await this.db.delete(schema.users).where(eq(schema.users.id, userId));
  }

  async logAiUsage(row: AiUsageRow) {
    await this.db.insert(schema.aiUsage).values(row);
  }

  async aiTokensSince(since: Date) {
    const [r] = await this.db
      .select({ n: sql<string>`coalesce(sum(${schema.aiUsage.inputTokens} + ${schema.aiUsage.outputTokens}), 0)` })
      .from(schema.aiUsage).where(gte(schema.aiUsage.createdAt, since));
    return Number(r?.n ?? 0);
  }

  async addWaitlist(email: string, locale: Locale) {
    const r = await this.db.insert(schema.waitlist).values({ email: email.toLowerCase(), locale })
      .onConflictDoNothing().returning({ email: schema.waitlist.email });
    return r.length > 0;
  }
}
