import { Suspense } from "react";
import type { Metadata } from "next";
import { t, type Locale } from "@ai-learn/shared";
import { AccountView } from "@/components/AccountView";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: t(locale).account, robots: { index: false } };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <Suspense><AccountView locale={locale} /></Suspense>;
}
