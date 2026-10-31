import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { parseMd, t, type Inline, type Lesson, type LessonStep, type PracticeResponse } from "@ai-learn/shared";
import { api, ApiFailure, deviceLocale, hasToken, saveToken } from "../../src/api";
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
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    api.lesson(id, deviceLocale).then((r) => { setLesson(r.lesson); setLocked(r.locked); });
  }, [id]);

  if (!lesson) return <View style={s.screen} />;
  const step = lesson.steps[index]!;
  const isLast = index === lesson.steps.length - 1;
  const canNext = stepDone || step.type === "explain" || step.type === "example";

  async function next() {
    if (!isLast) { setIndex(index + 1); setStepDone(false); return; }
    if (hasToken()) await api.complete(lesson!.id, best).catch(() => undefined);
    setFinished(true);
  }

  if (finished) {
    return (
      <View style={[s.screen, s.content, { justifyContent: "center" }]}>
        <Text style={[s.h1, { textAlign: "center" }]}>🎉 {lesson.title}</Text>
        <Text style={[s.text, { textAlign: "center", marginBottom: 24 }]}>+{lesson.xp} XP</Text>
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
          {/* TODO: 接入 RevenueCat 付费墙 */}
          <Pressable style={[s.btn, { marginTop: 12 }]}><Text style={s.btnText}>{tx.upgrade}</Text></Pressable>
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
  const [email, setEmail] = useState("");
  const [loggedIn, setLoggedIn] = useState(hasToken());
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
        // TODO: 换成 LINE / Google / Apple 登录按钮
        <View style={{ gap: 8 }}>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="email" autoCapitalize="none" keyboardType="email-address" />
          <Pressable style={s.btn} onPress={async () => { const r = await api.devLogin(email, deviceLocale); await saveToken(r.token); setLoggedIn(true); }}>
            <Text style={s.btnText}>{tx.login}</Text>
          </Pressable>
        </View>
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
          {result.feedback.good.map((g, i) => <Text key={`g${i}`} style={s.text}>✓ {g}</Text>)}
          {result.feedback.improve.map((g, i) => <Text key={`i${i}`} style={s.text}>→ {g}</Text>)}
        </View>
      )}
    </View>
  );
}
