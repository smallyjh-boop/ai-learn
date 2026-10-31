"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { t, type Lesson, type LessonStep, type Locale, type PracticeResponse } from "@ai-learn/shared";
import { api, ApiFailure, getToken, setToken } from "@/lib/api";
import { Md } from "./Md";

type Tx = ReturnType<typeof t>;

/** 一节课的播放器：一步一屏，讲解 → 示例 → 测验 → 练习 → 完成 */
export function LessonPlayer({ locale, lessonId }: { locale: Locale; lessonId: string }) {
  const tx = t(locale);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [locked, setLocked] = useState(false);
  const [index, setIndex] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [bestScore, setBestScore] = useState<number | undefined>();
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.lesson(lessonId, locale)
      .then((r) => { setLesson(r.lesson); setLocked(r.locked); })
      .catch((e: Error) => setError(e.message));
  }, [lessonId, locale]);

  if (error) return <p className="muted">{error}</p>;
  if (!lesson) return <p className="muted">…</p>;

  const step = lesson.steps[index]!;
  const isLast = index === lesson.steps.length - 1;
  // 讲解和示例直接可以下一步；测验和练习要完成才行
  const canNext = stepDone || step.type === "explain" || step.type === "example";

  async function next() {
    if (!isLast) { setIndex(index + 1); setStepDone(false); return; }
    if (getToken()) await api.complete(lesson!.id, bestScore).catch(() => undefined);
    setFinished(true);
  }

  if (finished) {
    return (
      <main className="card">
        <h1>🎉 {lesson.title}</h1>
        <p>+{lesson.xp} XP</p>
        <Link className="btn" href={`/${locale}/learn`}>{tx.continue}</Link>
      </main>
    );
  }

  return (
    <main>
      <div className="progress"><div style={{ width: `${((index + 1) / lesson.steps.length) * 100}%` }} /></div>
      <h1 style={{ fontSize: 22 }}>{lesson.title}</h1>
      <section className="card">
        <StepView key={index} step={step} tx={tx} locale={locale} lessonId={lesson.id} stepIndex={index}
          onDone={(score) => { setStepDone(true); if (score !== undefined) setBestScore(Math.max(bestScore ?? 0, score)); }} />
      </section>
      {locked ? (
        <div className="card"><strong>{tx.locked}</strong><p className="muted">{tx.quotaOut}</p><button className="btn">{tx.upgrade}</button></div>
      ) : (
        <div className="row">
          <button className="btn ghost" disabled={index === 0} onClick={() => { setIndex(index - 1); setStepDone(true); }}>{tx.back}</button>
          <button className="btn" disabled={!canNext} onClick={next}>{isLast ? tx.finish : tx.next}</button>
        </div>
      )}
    </main>
  );
}

function StepView(props: { step: LessonStep; tx: Tx; locale: Locale; lessonId: string; stepIndex: number; onDone: (score?: number) => void }) {
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

function Practice(props: { step: Extract<LessonStep, { type: "practice" }>; tx: Tx; locale: Locale; lessonId: string; stepIndex: number; onDone: (score?: number) => void }) {
  const { step, tx, locale } = props;
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PracticeResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => setLoggedIn(Boolean(getToken())), []);

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
      {!loggedIn ? (
        <DevLogin tx={tx} locale={locale} onLogin={() => setLoggedIn(true)} />
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
          {result.feedback.good.length > 0 && (<><p className="muted">{tx.wellDone}</p><ul>{result.feedback.good.map((g, i) => <li key={i}>{g}</li>)}</ul></>)}
          {result.feedback.improve.length > 0 && (<><p className="muted">{tx.improve}</p><ul>{result.feedback.improve.map((g, i) => <li key={i}>{g}</li>)}</ul></>)}
        </div>
      )}
    </div>
  );
}

/** 临时登录框（开发用）。正式版替换为 LINE / Google / Apple 按钮 —— 见 CLAUDE.md 待办 */
function DevLogin({ tx, locale, onLogin }: { tx: Tx; locale: Locale; onLogin: () => void }) {
  const [email, setEmail] = useState("");
  return (
    <div className="row" style={{ justifyContent: "flex-start" }}>
      <input type="email" value={email} placeholder="email" onChange={(e) => setEmail(e.target.value)}
        style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid var(--line)", font: "inherit" }} />
      <button className="btn" disabled={!email.includes("@")}
        onClick={async () => { const r = await api.devLogin(email, locale); setToken(r.token); onLogin(); }}>
        {tx.login}
      </button>
    </div>
  );
}
