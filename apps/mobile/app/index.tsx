import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { t, type CourseMapResponse } from "@ai-learn/shared";
import { api, deviceLocale } from "../src/api";
import { useTheme } from "../src/theme";

/** 学习路径（首页） */
export default function Home() {
  const { s, c } = useTheme();
  const tx = t(deviceLocale);
  const [data, setData] = useState<CourseMapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 每次回到首页刷新进度
  useFocusEffect(useCallback(() => {
    api.courses(deviceLocale).then(setData).catch((e: Error) => setError(e.message));
  }, []));

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.muted}>{tx.tagline}</Text>
      <Text style={[s.h1, { marginTop: 12 }]}>{tx.learnMap}</Text>
      {error && <Text style={{ color: c.warn }}>{error}</Text>}
      {data?.stages.map((stage) => (
        <View key={stage.stage} style={s.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={s.h2}>{stage.stage}. {stage.title}</Text>
            <Text style={[s.muted, { color: stage.free ? c.accent : c.muted }]}>{stage.free ? tx.free : tx.locked}</Text>
          </View>
          <Text style={[s.muted, { marginBottom: 6 }]}>{stage.summary}</Text>
          {stage.lessons.map((l) => (
            <Link key={l.id} href={{ pathname: "/lesson/[id]", params: { id: l.id } }} asChild>
              <Pressable style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderColor: c.line }}>
                <Text style={s.text}>{l.completed ? "✓ " : ""}{l.title}</Text>
                <Text style={s.muted}>{l.locked ? "🔒" : `${l.minutes} ${tx.minutes}`}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
