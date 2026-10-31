import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LOCALES, isLocale, t } from "@ai-learn/shared";
import { HeaderNav } from "@/components/HeaderNav";
import { SITE_URL, languageAlternates } from "@/lib/seo";
import "../globals.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const tx = t(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${tx.appName} — ${tx.tagline}`, template: `%s · ${tx.appName}` },
    description: tx.tagline,
    alternates: { canonical: `/${locale}`, languages: languageAlternates("") },
    openGraph: { siteName: tx.appName, locale: locale === "th" ? "th_TH" : locale === "zh" ? "zh_CN" : "en_US", type: "website" },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const tx = t(locale);
  return (
    <html lang={locale}>
      <body>
        <div className="wrap">
          <header className="top">
            <Link className="brand" href={`/${locale}`}>{tx.appName}</Link>
            <HeaderNav locale={locale} />
          </header>
          {children}
          <footer className="foot muted">
            <Link href={`/${locale}/learn`}>{tx.learnMap}</Link>
            <Link href={`/${locale}/pricing`}>{tx.pricing}</Link>
            <Link href={`/${locale}/privacy`}>{tx.privacy}</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
