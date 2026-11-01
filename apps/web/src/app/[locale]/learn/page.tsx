import type { Metadata } from "next";
import { t, type Locale } from "@ai-learn/shared";
import { courseMap } from "@ai-learn/content";
import { catalog } from "@/lib/catalog";
import { languageAlternates } from "@/lib/seo";
import { CourseMap } from "@/components/CourseMap";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const tx = t(locale);
  return { title: tx.learnMap, description: tx.tagline, alternates: { canonical: `/${locale}/learn`, languages: languageAlternates("/learn") } };
}

/** 学习路径：阶段地图 + 每个阶段的课程（服务端渲染，搜索引擎可收录） */
export default async function Learn({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <main>
      <h1>{t(locale).learnMap}</h1>
      <CourseMap locale={locale} initial={courseMap(catalog(), locale)} />
    </main>
  );
}
