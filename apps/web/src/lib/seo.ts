import { LOCALES } from "@ai-learn/shared";

/** 网站对外地址，用于 sitemap、canonical 链接 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** 各语言版本的地址（泰国本地 SEO：th-TH）。path 以 / 开头或为空 */
export const languageAlternates = (path: string) =>
  Object.fromEntries(LOCALES.map((l) => [l === "th" ? "th-TH" : l, `/${l}${path}`]));
