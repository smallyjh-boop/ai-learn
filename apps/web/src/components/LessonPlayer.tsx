"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StepTimer, t, type Lesson, type LessonResponse, type LessonStep, type Locale, type PracticeResponse } from "@ai-learn/shared";
import { api, ApiFailure } from "@/lib/api";
import { loginHref, updateMe, useSession } from "@/lib/session";
import { Md } from "./Md";

type Tx = ReturnType<typeof t>;

/**
 * 一节课的播放器：一步一屏，讲解 → 示例 → 测验 → 练习 → 完成。
 * 内容由服务端渲染时传入（initial）；付费课对会员再向 API 取完整内容。
 */
export function LessonPlayer({ locale, initial }: { locale: Locale; initial: LessonResponse }) {
  const tx = t(locale);
  const path = usePathname() ?? "";
  const { me } = useSession();
  const [lesson, setLesson] = useState<Lesson>(initial.lesson);
  const [locked, setLocked] = useState(initial.locked);
  const [index, setIndex] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [bestScore, setBestScore] = useState<number | undefined>();
  const [finished, setFinished] = useState<null | { saved: boolean; first: boolean }>(null);

  // 学习计时：换课（含付费课解锁成完整内容）时重新开始；切到别的标签页时暂停
  const timer = useRef<StepTimer | null>(null);
  useEffect(() => { timer.current = new StepTimer(lesson.steps.length); }, [lesson]);
  useEffect(() => { timer.current?.goTo(index); }, [index]);
  useEffect(() => {
    const onVis = () => (document.hidden ? timer.current?.pause() : timer.current?.resume());
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // 付费课：登录后如果是会员，换成完整内容
  useEffect(() => {
    if (!initial.locked || !me) return;
    api.lesson(initial.lesson.id, locale)
      .then((r) => { if (!r.locked) { setLesson(r.lesson); setLocked(false); setIndex(0); } })
      .catch(() => undefined);
  }, [initial, me, locale]);

  const step = lesson.steps[index]!;
  const isLast = index === lesson.steps.length - 1;
  // 讲解和示例直接可以下一步；测验和练习要完成才行
  const canNext = stepDone || step.type === "explain" || step.type === "example";

  async function next() {
    if (!isLast) { setIndex(index + 1); setStepDone(false); window.scrollTo({ top: 0 }); return; }
    if (!me) { setFinished({ saved: false, first: false }); return; }
    try {
      const r = await api.complete(lesson.id, locale, bestScore, timer.current?.result());
      updateMe(r.me);
      setFinished({ saved: true, first: r.first });
    } catch {
      setFinished({ saved: false, first: false });
    }
  }

  if (finished) {
    return (
      <main className="card">
        <h1>🎉 {tx.lessonDone}</h1>
        <p>{lesson.title}</p>
        {finished.first && <p><strong>+{lesson.xp} XP</strong></p>}
        {!me && <p><Link href={loginHref(locale, path)}>{tx.loginToSave}</Link></p>}
        <Link className="btn" href={`/${locale}/learn`}>{tx.continue}</Link>
      </main>
    );
  }

  return (
    <main>
      <div className="progress"><div style={{ width: `${((index + 1) / lesson.steps.length) * 100}%` }} /></div>
      <h1 style={{ fontSize: 22 }}>{lesson.title}</h1>
      <section className="card">
        <StepView key={`${lesson.steps.length}-${index}`} step={step} tx={tx} locale={locale} lessonId={lesson.id} stepIndex={index}
          loginUrl={loginHref(locale, path)} loggedIn={Boolean(me)}
          onDone={(score) => { setStepDone(true); if (score !== undefined) setBestScore(Math.max(bestScore ?? 0, score)); }} />
      </section>
      {locked ? (
        <div className="card">
          <strong>{tx.locked}</strong>
          <p className="muted">{tx.proPoint1}</p>
          <Link className="btn" href={me ? `/${locale}/pricing` : loginHref(locale, path)}>{me ? tx.upgrade : tx.login}</Link>
        </div>
      ) : (
        <div className="row">
          <button className="btn ghost" disabled={index === 0} onClick={() => { setIndex(index - 1); setStepDone(true); }}>{tx.back}</button>
          <button className="btn" disabled={!canNext} onClick={next}>{isLast ? tx.finish : tx.next}</button>
        </div>
      )}
    </main>
  );
}

type StepProps = { step: LessonStep; tx: Tx; locale: Locale; lessonId: string; stepIndex: number; loginUrl: string; loggedIn: boolean; onDone: (score?: number) => void };

function StepView(props: StepProps) {
  const { step, tx } = props;
  switch (step.type) {
    case "explain":
      return <Md text={step.body} />;
    case "example":
      return (
        <div>
          {step.bad && (<><p className="muted">✗ {tx.badPrompt}</p><div className="prompt">{step.bad}</div></>)}
          <p className="muted">✓ {tx.goodPrompt}</p>
          <div className="prompt">{step.prompt}</div>
          <p className="muted">{tx.aiAnswer}</p>
          <div className="prompt">{step.output}</div>
          {step.note && <p>{step.note}</p>}
        </div>
      );
    case "quiz":
      return <Quiz step={step} tx={tx} onDone={() => props.onDone()} />;
    case "practice":
      return <Practice {...props} step={step} />;
  }
}

function Quiz({ step, tx, onDone }: { step: Extract<LessonStep, { type: "quiz" }>; tx: Tx; onDone: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const right = picked === step.answer;
  return (
    <div>
      <p><strong>{step.question}</strong></p>
      {step.options.map((o, i) => (
        <button key={i} className="option"
          data-state={picked === i ? (right ? "right" : "wrong") : undefined}
          disabled={right}
          onClick={() => { setPicked(i); if (i === step.answer) onDone(); }}>
          {o}
        </button>
      ))}
      {picked !== null && <p>{right ? tx.correct : tx.wrong}</p>}
      {right && step.explain && <p className="muted">{step.explain}</p>}
    </div>
  );
}

function Practice(props: Omit<StepProps, "step"> & { step: Extract<LessonStep, { type: "practice" }> }) {
  const { step, tx, locale } = props;
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PracticeResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setBusy(true); setMsg(null);
    try {
      const r = await api.practice({ lessonId: props.lessonId, stepIndex: props.stepIndex, prompt }, locale);
      setResult(r);
      if (r.feedback.passed) props.onDone(r.feedback.score);
    } catch (e) {
      if (e instanceof ApiFailure && e.body.code === "QUOTA_EXCEEDED") setMsg(tx.quotaOut);
      else setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="muted">{tx.yourTurn}</p>
      <p><strong>{step.task}</strong></p>
      {!props.loggedIn ? (
        <Link className="btn" href={props.loginUrl}>{tx.loginToPractice}</Link>
      ) : (
        <>
          <textarea value={prompt} maxLength={step.maxChars} placeholder={step.placeholder}
            onChange={(e) => setPrompt(e.target.value)} />
          <div className="row">
            <span className="muted">{prompt.length}/{step.maxChars}{result ? ` · ${tx.quotaLeft}: ${result.quota.limit - result.quota.used}` : ""}</span>
            <button className="btn" disabled={busy || !prompt.trim()} onClick={send}>{busy ? tx.sending : tx.send}</button>
          </div>
        </>
      )}
      {msg && <p style={{ color: "var(--warn)" }}>{msg}</p>}
      {result && (
        <div style={{ marginTop: 16 }}>
          <p className="muted">{tx.aiAnswer}</p>
          <div className="prompt">{result.output}</div>
          <p><strong>{tx.score}: {result.feedback.score}</strong></p>
          {result.feedback.flagged && <p className="err">{tx.offTopic}</p>}
          {result.feedback.good.length > 0 && (<><p className="muted">{tx.wellDone}</p><ul>{result.feedback.good.map((g, i) => <li key={i}>{g}</li>)}</ul></>)}
          {result.feedback.improve.length > 0 && (<><p className="muted">{tx.improve}</p><ul>{result.feedback.improve.map((g, i) => <li key={i}>{g}</li>)}</ul></>)}
        </div>
      )}
    </div>
  );
}
