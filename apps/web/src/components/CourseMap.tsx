"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { t, type CourseMapResponse, type Locale } from "@ai-learn/shared";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

/** 学习地图：服务端先渲染未登录版本（SEO），登录用户再拉一次带进度和会员状态的数据 */
export function CourseMap({ locale, initial }: { locale: Locale; initial: CourseMapResponse }) {
  const tx = t(locale);
  const { me } = useSession();
  const [data, setData] = useState(initial);

  useEffect(() => {
    if (me) api.courses(locale).then(setData).catch(() => undefined);
    else setData(initial);
  }, [me, locale, initial]);

  return (
    <>
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
    </>
  );
}
