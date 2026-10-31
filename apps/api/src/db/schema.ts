import { pgTable, text, integer, timestamp, primaryKey, date } from "drizzle-orm/pg-core";

/** 用户：一个账号三端通用 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  name: text("name"),
  locale: text("locale").notNull().default("th"),
  /** 登录方式：line | google | apple | email */
  provider: text("provider").notNull(),
  /** 第三方平台上的用户ID */
  providerId: text("provider_id").notNull(),
  xp: integer("xp").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  /** 最近一次学习的日期（曼谷时区），用于计算连续打卡 */
  lastStudyDay: date("last_study_day"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** 学习进度：每人每课一条 */
export const progress = pgTable(
  "progress",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").notNull(),
    bestScore: integer("best_score"),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

/**
 * 会员权益：不论在网站(Stripe)、iOS、Android 哪里付款，
 * 支付回调都写到这张表，各端只查这里。
 */
export const entitlements = pgTable("entitlements", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"),
  /** stripe | app_store | play_store */
  source: text("source"),
  expiresAt: timestamp("expires_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
