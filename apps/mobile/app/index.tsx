import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Link, Stack, useFocusEffect } from "expo-router";
import { t, type CourseMapResponse } from "@ai-learn/shared";
import { api, deviceLocale } from "../src/api";
import { useSession } from "../src/session";
import { useTheme } from "../src/theme";

/** 学习路径（首页） */
export default function Home() {
  const { s, c } = useTheme();
  const tx = t(deviceLocale);
  const { me } = useSession();
  const [data, setData] = useState<CourseMapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 每次回到首页刷新进度（登录状态变化也会触发）
  useFocusEffect(useCallback(() => {
    api.courses(deviceLocale).then((d) => { setData(d); setError(null); }).catch((e: Error) => setError(e.message));
  }, [me?.id, me?.plan]));

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{
        headerRight: () => (
          <Link href={me ? "/account" : "/login"} asChild>
            <Pressable hitSlop={10}><Text style={{ color: c.accent, fontWeight: "600" }}>{me ? (me.plan === "pro" ? "⭐ " : "") + tx.account : tx.login}</Text></Pressable>
          </Link>
        ),
      }} />
      <Text style={s.muted}>{tx.tagline}</Text>
      {me && <Text style={[s.muted, { marginTop: 4 }]}>{tx.xp} {me.xp} · {tx.streak} {me.streak} {tx.days}</Text>}
      <Text style={[s.h1, { marginTop: 12 }]}>{tx.learnMap}</Text>
      {error && <Text style={{ color: c.warn, marginBottom: 12 }}>{error}</Text>}
      {data?.stages.map((stage) => (
        <View key={stage.stage} style={s.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={[s.h2, { flex: 1 }]}>{stage.stage}. {stage.title}</Text>
            <Text style={[s.muted, { color: stage.free ? c.accent : c.muted }]}>{stage.free ? tx.free : tx.locked}</Text>
          </View>
          <Text style={[s.muted, { marginBottom: 6 }]}>{stage.summary}</Text>
          {stage.lessons.map((l) => (
            <Link key={l.id} href={{ pathname: "/lesson/[id]", params: { id: l.id } }} asChild>
              <Pressable style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, paddingVertical: 12, borderTopWidth: 1, borderColor: c.line }}>
                <Text style={[s.text, { flex: 1 }]}>{l.completed ? "✓ " : ""}{l.title}</Text>
                <Text style={s.muted}>{l.locked ? "🔒" : `${l.minutes} ${tx.minutes}`}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
