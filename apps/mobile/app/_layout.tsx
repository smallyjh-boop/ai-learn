import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { t } from "@ai-learn/shared";
import { api, deviceLocale } from "../src/api";
import { restoreSession, useSession } from "../src/session";
import { initPurchases } from "../src/purchases";

export default function RootLayout() {
  const { ready } = useSession();
  useEffect(() => {
    initPurchases();
    void restoreSession(api.me);
  }, []);
  if (!ready) return null;
  const tx = t(deviceLocale);
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
        <Stack.Screen name="index" options={{ title: tx.appName }} />
        <Stack.Screen name="lesson/[id]" options={{ title: "" }} />
        <Stack.Screen name="login" options={{ title: tx.loginTitle, presentation: "modal" }} />
        <Stack.Screen name="paywall" options={{ title: tx.pricingTitle, presentation: "modal" }} />
        <Stack.Screen name="account" options={{ title: tx.account }} />
      </Stack>
    </>
  );
}
