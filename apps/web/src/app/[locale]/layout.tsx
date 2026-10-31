import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LOCALES, LOCALE_LABEL, isLocale, t, type Locale } from "@ai-learn/shared";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const tx = t(locale);
  return {
    title: { default: tx.appName, template: `%s · ${tx.appName}` },
    description: tx.tagline,
    // 告诉搜索引擎各语言版本（泰国本地 SEO）
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l === "th" ? "th-TH" : l, `/${l}`])) },
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
            <nav className="langs" aria-label="language">
              {LOCALES.map((l: Locale) => (
                <Link key={l} href={`/${l}`} aria-current={l === locale}>{LOCALE_LABEL[l]}</Link>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
