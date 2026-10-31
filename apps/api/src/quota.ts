import { Redis } from "ioredis";

/** 曼谷时区的今天日期 YYYY-MM-DD（限额和打卡都按这个日期重置） */
export function todayBangkok(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

export interface Quota {
  /** 先占用一次；超额返回 ok=false 且不计数 */
  take(userId: string, limit: number): Promise<{ ok: boolean; used: number }>;
  /** AI 调用失败时退回一次 */
  refund(userId: string): Promise<void>;
  peek(userId: string): Promise<number>;
}

const key = (userId: string) => `quota:${todayBangkok()}:${userId}`;

export class MemoryQuota implements Quota {
  private counts = new Map<string, number>();
  async take(userId: string, limit: number) {
    const k = key(userId);
    const used = this.counts.get(k) ?? 0;
    if (used >= limit) return { ok: false, used };
    this.counts.set(k, used + 1);
    return { ok: true, used: used + 1 };
  }
  async refund(userId: string) {
    const k = key(userId);
    this.counts.set(k, Math.max(0, (this.counts.get(k) ?? 1) - 1));
  }
  async peek(userId: string) { return this.counts.get(key(userId)) ?? 0; }
}

export class RedisQuota implements Quota {
  constructor(private redis: Redis) {}
  async take(userId: string, limit: number) {
    const k = key(userId);
    const used = await this.redis.incr(k);
    if (used === 1) await this.redis.expire(k, 60 * 60 * 26);
    if (used > limit) {
      await this.redis.decr(k);
      return { ok: false, used: limit };
    }
    return { ok: true, used };
  }
  async refund(userId: string) { await this.redis.decr(key(userId)); }
  async peek(userId: string) { return Number((await this.redis.get(key(userId))) ?? 0); }
}
