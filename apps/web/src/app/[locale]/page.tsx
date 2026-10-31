import Link from "next/link";
import { PRICING, defaultCurrency, t, type Locale } from "@ai-learn/shared";
import { courseMap } from "@ai-learn/content";
import { catalog } from "@/lib/catalog";
import { WaitlistForm } from "@/components/WaitlistForm";

/** 首页 / 落地页：课程大纲 + 定价 + 预约邮箱，用于 SEO 和测试付费意愿 */
export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const tx = t(locale);
  const price = PRICING[defaultCurrency(locale)];
  const { stages } = courseMap(catalog(), locale);
  const firstLesson = stages[0]?.lessons[0];

  return (
    <main>
      <section className="card hero">
        <h1>{tx.appName}</h1>
        <p className="muted" style={{ fontSize: 18 }}>{tx.tagline}</p>
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <Link className="btn" href={firstLesson ? `/${locale}/lesson/${firstLesson.id}` : `/${locale}/learn`}>{tx.start}</Link>
          <Link className="btn ghost" href={`/${locale}/learn`}>{tx.learnMap}</Link>
        </div>
      </section>

      <h2>{tx.howTitle}</h2>
      <section className="steps3">
        {[tx.how1, tx.how2, tx.how3].map((s, i) => (
          <div key={i} className="card"><div className="num">{i + 1}</div><div>{s}</div></div>
        ))}
      </section>

      <h2>{tx.outlineTitle}</h2>
      {stages.map((s) => (
        <section key={s.stage} className="card stage">
          <div className="row" style={{ marginTop: 0 }}>
            <h3 style={{ margin: 0 }}>{s.stage}. {s.title}</h3>
            <span className={s.free ? "badge" : "badge lock"}>{s.free ? tx.free : tx.locked}</span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {s.summary}{s.lessons.length > 0 && ` · ${s.lessons.length} ${tx.lessonsCount}`}
          </p>
        </section>
      ))}

      <section className="card">
        <div className="row" style={{ marginTop: 0 }}>
          <strong>{tx.pricingTitle}</strong>
          <span><span className="price">{price.symbol}{price.monthly}</span>{tx.perMonth}</span>
        </div>
        <ul className="checks">
          <li>{tx.proPoint1}</li>
          <li>{tx.proPoint2}</li>
        </ul>
        <Link className="btn ghost" href={`/${locale}/pricing`}>{tx.pricing}</Link>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>{tx.waitlistTitle}</h2>
        <p className="muted">{tx.waitlistDesc}</p>
        <WaitlistForm locale={locale} />
      </section>
    </main>
  );
}
