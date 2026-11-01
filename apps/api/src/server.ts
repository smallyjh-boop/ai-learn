import { Redis } from "ioredis";
import { loadCatalog } from "@ai-learn/content";
import { buildApp } from "./app";
import { assertProdConfig, config } from "./config";
import { MemoryStore, PgStore } from "./db/store";
import { runMigrations } from "./db/migrate";
import { MemoryQuota, RedisQuota } from "./quota";
import { createProvider } from "./ai/gateway";
import { StripeBilling } from "./billing/stripe";

assertProdConfig();

const pg = config.databaseUrl ? new PgStore(config.databaseUrl) : null;
if (pg) await runMigrations(pg);
const store = pg ?? new MemoryStore();
const redis = config.redisUrl ? new Redis(config.redisUrl) : null;
const quota = redis ? new RedisQuota(redis) : new MemoryQuota();
const ai = createProvider();
const catalog = loadCatalog();
const billing = config.stripe.secretKey ? new StripeBilling({ ...config.stripe, webUrl: config.webUrl }) : undefined;

const app = await buildApp({ store, quota, ai, catalog, billing });

app.log.info(`存储=${pg ? "postgres" : "memory"} 限额=${redis ? "redis" : "memory"} AI=${ai.name} 付款=${billing ? "stripe" : "未配置"}`);
await app.listen({ port: config.port, host: "0.0.0.0" });

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.once(sig, async () => {
    await app.close();
    await pg?.close();
    redis?.disconnect();
    process.exit(0);
  });
}
