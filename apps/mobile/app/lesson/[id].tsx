import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { parseMd, StepTimer, t, type Inline, type Lesson, type LessonStep, type PracticeResponse } from "@ai-learn/shared";
import { api, ApiFailure, deviceLocale } from "../../src/api";
import { updateMe, useSession } from "../../src/session";
import { useTheme } from "../../src/theme";

type Tx = ReturnType<typeof t>;
type Theme = ReturnType<typeof useTheme>;

/** 一节课：一步一屏（与网站版 LessonPlayer 逻辑一致） */
export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { s, c } = theme;
  const tx = t(deviceLocale);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [locked, setLocked] = useState(false);
  const [index, setIndex] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [best, setBest] = useState<number | undefined>();
  const [finished, setFinished] = useState<null | { first: boolean }>(null);
  const [error, setError] = useState<string | null>(null);
  const { me } = useSession();

  // 登录状态或会员状态变化时重新取课（开通会员后解锁完整内容）
  useEffect(() => {
    api.lesson(id, deviceLocale)
      .then((r) => { setLesson(r.lesson); setLocked(r.locked); setIndex(0); setError(null); })
      .catch((e: Error) => setError(e.message));
  }, [id, me?.id, me?.plan]);

  // 学习计时（与网站版一致）：换课时重新开始；App 进入后台时暂停
  const timer = useRef<StepTimer | null>(null);
  useEffect(() => { if (lesson) timer.current = new StepTimer(lesson.steps.length); }, [lesson]);
  useEffect(() => { timer.current?.goTo(index); }, [index]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => (st === "active" ? timer.current?.resume() : timer.current?.pause()));
    return () => sub.remove();
  }, []);

  if (error) return <View style={[s.screen, s.content]}><Text style={{ color: c.warn }}>{error}</Text></View>;
  if (!lesson) return <View style={s.screen} />;
  const step = lesson.steps[index]!;
  const isLast = index === lesson.steps.length - 1;
  const canNext = stepDone || step.type === "explain" || step.type === "example";

  async function next() {
    if (!isLast) { setIndex(index + 1); setStepDone(false); return; }
    if (!me) { setFinished({ first: false }); return; }
    try {
      const r = await api.complete(lesson!.id, deviceLocale, best, timer.current?.result());
      updateMe(r.me);
      setFinished({ first: r.first });
    } catch {
      setFinished({ first: false });
    }
  }

  if (finished) {
    return (
      <View style={[s.screen, s.content, { justifyContent: "center" }]}>
        <Text style={[s.h1, { textAlign: "center" }]}>🎉 {tx.lessonDone}</Text>
        <Text style={[s.text, { textAlign: "center", marginBottom: 8 }]}>{lesson.title}</Text>
        {finished.first && <Text style={[s.h2, { textAlign: "center", marginBottom: 8 }]}>+{lesson.xp} XP</Text>}
        {!me && <Text style={[s.muted, { textAlign: "center", marginBottom: 8, color: c.accent }]} onPress={() => router.push("/login")}>{tx.loginToSave}</Text>}
        <View style={{ height: 16 }} />
        <Pressable style={s.btn} onPress={() => router.back()}><Text style={s.btnText}>{tx.continue}</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: lesson.title }} />
      <View style={{ height: 6, backgroundColor: c.line, borderRadius: 99, marginBottom: 16 }}>
        <View style={{ height: 6, borderRadius: 99, backgroundColor: c.accent, width: `${((index + 1) / lesson.steps.length) * 100}%` }} />
      </View>
      <View style={s.card}>
        <StepView key={index} step={step} tx={tx} theme={theme} lessonId={lesson.id} stepIndex={index}
          onDone={(score) => { setStepDone(true); if (score !== undefined) setBest(Math.max(best ?? 0, score)); }} />
      </View>
      {locked ? (
        <View style={s.card}>
          <Text style={s.h2}>{tx.locked}</Text>
          <Text style={[s.muted, { marginTop: 4 }]}>{tx.proPoint1}</Text>
          <Pressable style={[s.btn, { marginTop: 12 }]} onPress={() => router.push(me ? "/paywall" : "/login")}>
            <Text style={s.btnText}>{me ? tx.upgrade : tx.login}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Pressable style={[s.ghost, { opacity: index === 0 ? 0.4 : 1 }]} disabled={index === 0}
            onPress={() => { setIndex(index - 1); setStepDone(true); }}>
            <Text style={s.text}>{tx.back}</Text>
          </Pressable>
          <Pressable style={[s.btn, { flex: 1, opacity: canNext ? 1 : 0.4 }]} disabled={!canNext} onPress={next}>
            <Text style={s.btnText}>{isLast ? tx.finish : tx.next}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function Line({ inline, theme }: { inline: Inline[]; theme: Theme }) {
  return <Text style={theme.s.text}>{inline.map((x, i) => <Text key={i} style={x.bold ? { fontWeight: "700" } : undefined}>{x.text}</Text>)}</Text>;
}

function Md({ text, theme }: { text: string; theme: Theme }) {
  return (
    <View style={{ gap: 8 }}>
      {parseMd(text).map((b, i) =>
        b.type === "p" ? <Line key={i} inline={b.inline} theme={theme} /> : (
          <View key={i} style={{ gap: 4 }}>
            {b.items.map((it, j) => (
              <View key={j} style={{ flexDirection: "row" }}>
                <Text style={theme.s.text}>{b.type === "ul" ? "•  " : `${j + 1}. `}</Text>
                <View style={{ flex: 1 }}><Line inline={it} theme={theme} /></View>
              </View>
            ))}
          </View>
        ))}
    </View>
  );
}

function StepView(p: { step: LessonStep; tx: Tx; theme: Theme; lessonId: string; stepIndex: number; onDone: (score?: number) => void }) {
  const { step, tx, theme } = p;
  const { s } = theme;
  switch (step.type) {
    case "explain":
      return <Md text={step.body} theme={theme} />;
    case "example":
      return (
        <View>
          {step.bad && (<><Text style={s.muted}>✗ {tx.badPrompt}</Text><View style={s.box}><Text style={s.text}>{step.bad}</Text></View></>)}
          <Text style={s.muted}>✓ {tx.goodPrompt}</Text>
          <View style={s.box}><Text style={s.text}>{step.prompt}</Text></View>
          <Text style={s.muted}>{tx.aiAnswer}</Text>
          <View style={s.box}><Text style={s.text}>{step.output}</Text></View>
          {step.note && <Text style={[s.text, { marginTop: 8 }]}>{step.note}</Text>}
        </View>
      );
    case "quiz":
      return <Quiz step={step} tx={tx} theme={theme} onDone={() => p.onDone()} />;
    case "practice":
      return <Practice {...p} step={step} />;
  }
}

function Quiz({ step, tx, theme, onDone }: { step: Extract<LessonStep, { type: "quiz" }>; tx: Tx; theme: Theme; onDone: () => void }) {
  const { s, c } = theme;
  const [picked, setPicked] = useState<number | null>(null);
  const right = picked === step.answer;
  return (
    <View>
      <Text style={[s.text, { fontWeight: "700", marginBottom: 8 }]}>{step.question}</Text>
      {step.options.map((o, i) => (
        <Pressable key={i} disabled={right} onPress={() => { setPicked(i); if (i === step.answer) onDone(); }}
          style={[s.box, picked === i && { borderColor: right ? c.accent : c.warn, backgroundColor: right ? c.accentSoft : c.bg }]}>
          <Text style={s.text}>{o}</Text>
        </Pressable>
      ))}
      {picked !== null && <Text style={s.text}>{right ? tx.correct : tx.wrong}</Text>}
      {right && step.explain && <Text style={s.muted}>{step.explain}</Text>}
    </View>
  );
}

function Practice(p: { step: Extract<LessonStep, { type: "practice" }>; tx: Tx; theme: Theme; lessonId: string; stepIndex: number; onDone: (score?: number) => void }) {
  const { step, tx, theme } = p;
  const { s, c } = theme;
  const [prompt, setPrompt] = useState("");
  const loggedIn = Boolean(useSession().me);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PracticeResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setBusy(true); setMsg(null);
    try {
      const r = await api.practice({ lessonId: p.lessonId, stepIndex: p.stepIndex, prompt }, deviceLocale);
      setResult(r);
      if (r.feedback.passed) p.onDone(r.feedback.score);
    } catch (e) {
      setMsg(e instanceof ApiFailure && e.body.code === "QUOTA_EXCEEDED" ? tx.quotaOut : (e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <View>
      <Text style={s.muted}>{tx.yourTurn}</Text>
      <Text style={[s.text, { fontWeight: "700", marginVertical: 8 }]}>{step.task}</Text>
      {!loggedIn ? (
        <Pressable style={s.btn} onPress={() => router.push("/login")}>
          <Text style={s.btnText}>{tx.loginToPractice}</Text>
        </Pressable>
      ) : (
        <View style={{ gap: 8 }}>
          <TextInput style={[s.input, { minHeight: 110, textAlignVertical: "top" }]} multiline value={prompt}
            onChangeText={setPrompt} maxLength={step.maxChars} placeholder={step.placeholder} placeholderTextColor={c.muted} />
          <Text style={s.muted}>{prompt.length}/{step.maxChars}{result ? ` · ${tx.quotaLeft}: ${result.quota.limit - result.quota.used}` : ""}</Text>
          <Pressable style={[s.btn, { opacity: busy || !prompt.trim() ? 0.4 : 1 }]} disabled={busy || !prompt.trim()} onPress={send}>
            <Text style={s.btnText}>{busy ? tx.sending : tx.send}</Text>
          </Pressable>
        </View>
      )}
      {msg && <Text style={{ color: c.warn, marginTop: 8 }}>{msg}</Text>}
      {result && (
        <View style={{ marginTop: 12 }}>
          <Text style={s.muted}>{tx.aiAnswer}</Text>
          <View style={s.box}><Text style={s.text}>{result.output}</Text></View>
          <Text style={[s.text, { fontWeight: "700" }]}>{tx.score}: {result.feedback.score}</Text>
          {result.feedback.flagged && <Text style={{ color: c.warn }}>{tx.offTopic}</Text>}
          {result.feedback.good.map((g, i) => <Text key={`g${i}`} style={s.text}>✓ {g}</Text>)}
          {result.feedback.improve.map((g, i) => <Text key={`i${i}`} style={s.text}>→ {g}</Text>)}
        </View>
      )}
    </View>
  );
}
