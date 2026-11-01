import type { MetadataRoute } from "next";
import { LOCALES } from "@ai-learn/shared";
import { listLessons } from "@ai-learn/content";
import { catalog } from "@/lib/catalog";
import { SITE_URL, languageAlternates } from "@/lib/seo";

/** /sitemap.xml：各语言的首页、学习地图、价格、隐私政策和每节课 */
export default function sitemap(): MetadataRoute.Sitemap {
  const ids = listLessons(catalog(), "th").map((l) => l.id);
  const paths = ["", "/learn", "/pricing", "/privacy", ...ids.map((id) => `/lesson/${id}`)];
  const abs = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${SITE_URL}${v}`]));
  return LOCALES.flatMap((locale) =>
    paths.map((p) => ({
      url: `${SITE_URL}/${locale}${p}`,
      changeFrequency: p.startsWith("/lesson") ? ("monthly" as const) : ("weekly" as const),
      priority: p === "" ? 1 : p === "/learn" ? 0.9 : 0.6,
      alternates: { languages: abs(languageAlternates(p)) },
    })),
  );
}
