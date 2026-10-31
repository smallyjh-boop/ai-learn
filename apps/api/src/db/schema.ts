import { pgTable, text, integer, timestamp, primaryKey, date, uniqueIndex, index, serial } from "drizzle-orm/pg-core";

/** 用户：一个账号三端通用 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    /** 不设唯一：同一邮箱可能分别用 LINE、Google 登录，目前是两个账号（以后做手动绑定） */
    email: text("email"),
    name: text("name"),
    locale: text("locale").notNull().default("th"),
    /** 登录方式：line | google | apple | email */
    provider: text("provider").notNull(),
    /** 第三方平台上的用户ID */
    providerId: text("provider_id").notNull(),
    /** Stripe 客户 ID（网站付款后写入，用于打开订阅管理页） */
    stripeCustomerId: text("stripe_customer_id"),
    xp: integer("xp").notNull().default(0),
    streak: integer("streak").notNull().default(0),
    /** 最近一次学习的日期（曼谷时区），用于计算连续打卡 */
    lastStudyDay: date("last_study_day"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_provider_uq").on(t.provider, t.providerId)],
);

/** 学习进度：每人每课一条 */
export const progress = pgTable(
  "progress",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").notNull(),
    bestScore: integer("best_score"),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

/**
 * 会员权益：不论在网站(Stripe)、iOS、Android 哪里付款，
 * 支付回调都写到这张表，各端只查这里。
 * TODO(上架 App 时)：改成每个付款来源一行，避免互相覆盖。
 */
export const entitlements = pgTable("entitlements", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"),
  /** stripe | app_store | play_store */
  source: text("source"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** AI 用量日志：每次调用一条，用于成本统计和告警。删除账号时一起删除（PDPA） */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** practice | grade */
    kind: text("kind").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_created_idx").on(t.createdAt)],
);

/** 落地页预约名单 */
export const waitlist = pgTable("waitlist", {
  email: text("email").primaryKey(),
  locale: text("locale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
