"use client";

import { use } from "react";
import type { Locale } from "@ai-learn/shared";
import { LessonPlayer } from "@/components/LessonPlayer";

export default function LessonPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = use(params);
  return <LessonPlayer locale={locale} lessonId={id} />;
}
