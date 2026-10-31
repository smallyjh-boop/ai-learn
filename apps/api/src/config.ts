const env = process.env;

export const config = {
  port: Number(env.PORT ?? 4000),
  databaseUrl: env.DATABASE_URL || "",
  redisUrl: env.REDIS_URL || "",
  jwtSecret: env.JWT_SECRET || "dev-only-secret-change-me",
  isProd: env.NODE_ENV === "production",

  ai: {
    provider: (env.AI_PROVIDER || (env.ANTHROPIC_API_KEY ? "anthropic" : "mock")) as "anthropic" | "mock",
    anthropicKey: env.ANTHROPIC_API_KEY || "",
    practiceModel: env.AI_MODEL_PRACTICE || "claude-haiku-4-5",
    graderModel: env.AI_MODEL_GRADER || "claude-haiku-4-5",
    maxOutputTokens: 600,
  },

  quota: {
    free: Number(env.QUOTA_FREE_PER_DAY ?? 5),
    pro: Number(env.QUOTA_PRO_PER_DAY ?? 50),
  },

  revenuecatToken: env.REVENUECAT_WEBHOOK_TOKEN || "",
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || "",
};

if (config.isProd && config.jwtSecret === "dev-only-secret-change-me") {
  throw new Error("生产环境必须设置 JWT_SECRET");
}
