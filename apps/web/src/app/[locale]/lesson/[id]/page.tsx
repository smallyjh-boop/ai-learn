import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LOCALES, isFreeStage, type Locale } from "@ai-learn/shared";
import { getLesson, listLessons } from "@ai-learn/content";
import { catalog } from "@/lib/catalog";
import { languageAlternates } from "@/lib/seo";
import { LessonPlayer } from "@/components/LessonPlayer";

export const dynamicParams = false;

/** 构建时为每种语言、每节课生成静态页面 */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) => listLessons(catalog(), locale).map((l) => ({ locale, id: l.id })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  const lesson = getLesson(catalog(), locale, id);
  if (!lesson) return {};
  return {
    title: lesson.title,
    description: lesson.summary,
    alternates: { canonical: `/${locale}/lesson/${id}`, languages: languageAlternates(`/lesson/${id}`) },
  };
}

export default async function LessonPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const lesson = getLesson(catalog(), locale, id);
  if (!lesson) notFound();
  // 免费课直接把内容渲染进页面；付费课只给第一段讲解作预览，会员登录后由播放器向 API 取完整内容
  const free = isFreeStage(lesson.stage);
  const initial = free
    ? { lesson, locked: false }
    : { lesson: { ...lesson, steps: lesson.steps.filter((s) => s.type === "explain").slice(0, 1) }, locked: true };
  return <LessonPlayer locale={locale} initial={initial} />;
}
