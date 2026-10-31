import { Suspense } from "react";
import type { Metadata } from "next";
import { t, type Locale } from "@ai-learn/shared";
import { LoginPanel } from "@/components/LoginPanel";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: t(locale).loginTitle, robots: { index: false } };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <Suspense><LoginPanel locale={locale} /></Suspense>;
}
