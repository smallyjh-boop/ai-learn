import type { Metadata } from "next";
import { t, type Locale } from "@ai-learn/shared";
import { Subscribe } from "@/components/Subscribe";
import { languageAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const tx = t(locale);
  return { title: tx.pricingTitle, description: tx.proPoint1, alternates: { canonical: `/${locale}/pricing`, languages: languageAlternates("/pricing") } };
}

export default async function PricingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const tx = t(locale);
  return (
    <main>
      <h1>{tx.pricingTitle}</h1>
      <section className="card">
        <ul className="checks">
          <li>{tx.proPoint1}</li>
          <li>{tx.proPoint2}</li>
          <li>{tx.proPoint3}</li>
        </ul>
        <Subscribe locale={locale} />
      </section>
    </main>
  );
}
