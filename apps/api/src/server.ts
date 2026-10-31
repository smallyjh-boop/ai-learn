import { Redis } from "ioredis";
import { loadCatalog } from "@ai-learn/content";
import { buildApp } from "./app";
import { config } from "./config";
import { MemoryStore, PgStore } from "./db/store";
import { MemoryQuota, RedisQuota } from "./quota";
import { createProvider } from "./ai/gateway";

const store = config.databaseUrl ? new PgStore(config.databaseUrl) : new MemoryStore();
const quota = config.redisUrl ? new RedisQuota(new Redis(config.redisUrl)) : new MemoryQuota();
const ai = createProvider();
const catalog = loadCatalog();

const app = await buildApp({ store, quota, ai, catalog });

app.log.info(
  `存储=${config.databaseUrl ? "postgres" : "memory"} 限额=${config.redisUrl ? "redis" : "memory"} AI=${ai.name}`,
);
await app.listen({ port: config.port, host: "0.0.0.0" });
