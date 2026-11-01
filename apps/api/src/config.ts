const env = process.env;
const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const config = {
  port: Number(env.PORT ?? 4000),
  databaseUrl: env.DATABASE_URL || "",
  redisUrl: env.REDIS_URL || "",
  jwtSecret: env.JWT_SECRET || "dev-only-secret-change-me",
  isProd: env.NODE_ENV === "production",
  /** 网站地址（Stripe 付款完成后跳回、LINE 登录回调）。如 https://ailearn.example.com */
  webUrl: (env.WEB_URL || "http://localhost:3000").replace(/\/$/, ""),
  /** 允许跨域访问 API 的网站地址，逗号分隔；不填则只允许 WEB_URL */
  corsOrigins: list(env.CORS_ORIGINS),

  ai: {
    provider: (env.AI_PROVIDER || (env.ANTHROPIC_API_KEY ? "anthropic" : "mock")) as "anthropic" | "mock",
    anthropicKey: env.ANTHROPIC_API_KEY || "",
    practiceModel: env.AI_MODEL_PRACTICE || "claude-haiku-4-5",
    graderModel: env.AI_MODEL_GRADER || "claude-haiku-4-5",
    maxOutputTokens: 600,
    /** 当天（曼谷时间）AI token 总量超过这个数就在日志里告警；0 = 不告警 */
    dailyTokenAlert: Number(env.AI_DAILY_TOKEN_ALERT ?? 2_000_000),
  },

  /** 运营统计接口（/admin/*）的访问令牌，不填则关闭这些接口 */
  adminToken: env.ADMIN_TOKEN || "",
  /** 告警推送地址（Slack / Discord / 自建中转），不填只写日志 */
  alertWebhookUrl: env.ALERT_WEBHOOK_URL || "",

  quota: {
    free: Number(env.QUOTA_FREE_PER_DAY ?? 5),
    pro: Number(env.QUOTA_PRO_PER_DAY ?? 50),
  },

  auth: {
    lineChannelId: env.LINE_CHANNEL_ID || "",
    lineChannelSecret: env.LINE_CHANNEL_SECRET || "",
    googleClientIds: list(env.GOOGLE_CLIENT_ID),
    /** iOS App 的 bundle id（Apple identityToken 的 aud），可逗号分隔多个 */
    appleAudiences: list(env.APPLE_BUNDLE_ID),
  },

  revenuecatToken: env.REVENUECAT_WEBHOOK_TOKEN || "",
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY || "",
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || "",
    /** Stripe 后台建好的价格 ID：月付、年付 */
    priceMonthly: env.STRIPE_PRICE_MONTHLY || "",
    priceYearly: env.STRIPE_PRICE_YEARLY || "",
  },
};

/** 生产环境的必填项检查：缺了直接启动失败，避免线上悄悄用 mock / 默认密钥 */
export function assertProdConfig(c = config) {
  if (!c.isProd) return;
  const missing: string[] = [];
  if (c.jwtSecret === "dev-only-secret-change-me") missing.push("JWT_SECRET");
  if (!c.databaseUrl) missing.push("DATABASE_URL");
  if (c.ai.provider !== "mock" && !c.ai.anthropicKey) missing.push("ANTHROPIC_API_KEY");
  if (missing.length) throw new Error(`生产环境缺少配置：${missing.join(", ")}`);
  if (c.ai.provider === "mock") console.warn("⚠️ 生产环境使用 mock AI（AI_PROVIDER=mock），用户看到的是假回答");
}
