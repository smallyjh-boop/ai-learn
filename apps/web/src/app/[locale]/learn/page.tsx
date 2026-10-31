"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { t, type CourseMapResponse, type Locale } from "@ai-learn/shared";
import { api } from "@/lib/api";

/** 学习路径：阶段地图 + 每个阶段的课程 */
export default function Learn({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  const tx = t(locale);
  const [data, setData] = useState<CourseMapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.courses(locale).then(setData).catch((e: Error) => setError(e.message));
  }, [locale]);

  if (error) return <p className="muted">{error}</p>;
  if (!data) return <p className="muted">…</p>;

  return (
    <main>
      <h1>{tx.learnMap}</h1>
      {data.stages.map((s) => (
        <section key={s.stage} className="card stage">
          <div className="row" style={{ marginTop: 0 }}>
            <h2>{s.stage}. {s.title}</h2>
            <span className={s.free ? "badge" : "badge lock"}>{s.free ? tx.free : tx.locked}</span>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>{s.summary}</p>
          {s.lessons.map((l) => (
            <Link key={l.id} className="lesson-row" href={`/${locale}/lesson/${l.id}`}>
              <span>{l.completed ? "✓ " : ""}{l.title}</span>
              <span className="muted">{l.locked ? "🔒" : `${l.minutes} ${tx.minutes}`}</span>
            </Link>
          ))}
        </section>
      ))}
    </main>
  );
}
