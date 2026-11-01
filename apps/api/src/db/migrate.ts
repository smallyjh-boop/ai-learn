import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { PgStore } from "./store";

/**
 * 启动时执行数据库迁移（drizzle-kit generate 生成的 SQL）。
 * 源码运行时位于 src/db/，打包后位于 dist/，迁移目录都在 apps/api/drizzle；
 * Docker 里用 MIGRATIONS_DIR 指定。
 */
export async function runMigrations(store: PgStore, dir = process.env.MIGRATIONS_DIR) {
  const here = dirname(fileURLToPath(import.meta.url));
  const fallback = here.endsWith(join("src", "db")) ? join(here, "..", "..", "drizzle") : join(here, "..", "drizzle");
  await migrate(store.db, { migrationsFolder: dir ?? fallback });
}
