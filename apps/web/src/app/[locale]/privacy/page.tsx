import type { Metadata } from "next";
import type { Locale } from "@ai-learn/shared";
import { PRIVACY } from "@/content/privacy";
import { languageAlternates } from "@/lib/seo";

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "privacy@example.com";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: PRIVACY[locale].title, alternates: { canonical: `/${locale}/privacy`, languages: languageAlternates("/privacy") } };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const doc = PRIVACY[locale];
  return (
    <main className="card prose">
      <h1 style={{ marginTop: 0 }}>{doc.title}</h1>
      <p className="muted">{doc.updated}</p>
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          <ul>{s.p.map((p, i) => <li key={i}>{p.replaceAll("{email}", EMAIL)}</li>)}</ul>
        </section>
      ))}
    </main>
  );
}
