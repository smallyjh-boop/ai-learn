import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { t } from "@ai-learn/shared";
import { deviceLocale, loadToken } from "../src/api";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => { loadToken().finally(() => setReady(true)); }, []);
  if (!ready) return null;
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerBackTitle: "" }}>
        <Stack.Screen name="index" options={{ title: t(deviceLocale).appName }} />
        <Stack.Screen name="lesson/[id]" options={{ title: "" }} />
      </Stack>
    </>
  );
}
