import Link from "next/link";
import { PRICING, defaultCurrency, t, type Locale } from "@ai-learn/shared";

/** 首页 / 落地页：用于 SEO 和测试付费意愿 */
export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const tx = t(locale);
  const price = PRICING[defaultCurrency(locale)];
  return (
    <main>
      <section className="card">
        <h1 style={{ marginTop: 0 }}>{tx.appName}</h1>
        <p className="muted">{tx.tagline}</p>
        <Link className="btn" href={`/${locale}/learn`}>{tx.start}</Link>
      </section>
      <section className="card">
        <strong>Pro</strong>{" "}
        <span>{price.symbol}{price.monthly}{tx.perMonth}</span>
      </section>
    </main>
  );
}
