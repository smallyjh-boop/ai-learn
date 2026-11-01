import "server-only";
import { join } from "node:path";
import { loadCatalog, type Catalog } from "@ai-learn/content";

/**
 * 服务端渲染直接读课程 JSON（构建时生成静态页面，利于 SEO）。
 * 课程更新后需要重新构建网站；登录用户的进度、付费内容仍走 API。
 */
let cached: Catalog | undefined;
export function catalog(): Catalog {
  cached ??= loadCatalog(process.env.CONTENT_DIR ?? join(process.cwd(), "..", "..", "packages", "content", "courses"));
  return cached;
}
