import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import type { PurchasesPackage } from "react-native-purchases";
import { t } from "@ai-learn/shared";
import { api, deviceLocale } from "../src/api";
import { buy, getPackages, purchasesAvailable, restore } from "../src/purchases";
import { updateMe, useSession } from "../src/session";
import { useTheme } from "../src/theme";

/**
 * 付费墙（App 内购）。注意商店规定：App 内不能引导用户去网站付款。
 * 购买成功后会员由 RevenueCat → 后端 webhook 写入，这里轮询 /me 几次等它生效。
 */
export default function Paywall() {
  const { s, c } = useTheme();
  const tx = t(deviceLocale);
  const { me } = useSession();
  const [pkgs, setPkgs] = useState<PurchasesPackage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (!me) router.replace("/login"); }, [me]);
  useEffect(() => {
    getPackages().then((p) => {
      setPkgs(p);
      // 默认选年付
      setSelected((p.find((x) => x.packageType === "ANNUAL") ?? p[0])?.identifier ?? null);
    }).catch(() => setPkgs([]));
  }, []);

  if (me?.plan === "pro") {
    return (
      <View style={[s.screen, s.content]}>
        <Text style={[s.h2, { color: c.accent }]}>{tx.alreadyPro}</Text>
        <Pressable style={[s.btn, { marginTop: 16 }]} onPress={() => router.back()}><Text style={s.btnText}>{tx.continue}</Text></Pressable>
      </View>
    );
  }

  /** webhook 到达需要几秒：轮询 /me 直到变成 Pro */
  async function waitForPro() {
    for (let i = 0; i < 6; i++) {
      const fresh = await api.me().catch(() => null);
      if (fresh) updateMe(fresh);
      if (fresh?.plan === "pro") return;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  async function purchase() {
    const pkg = pkgs?.find((p) => p.identifier === selected);
    if (!pkg) return;
    setBusy(true); setMsg(null);
    try {
      if (await buy(pkg)) { setMsg(tx.paySuccess); await waitForPro(); }
    } catch {
      setMsg(tx.purchaseFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {[tx.proPoint1, tx.proPoint2, tx.proPoint3].map((p) => <Text key={p} style={[s.text, { marginBottom: 6 }]}>✓ {p}</Text>)}
      <View style={{ marginTop: 16, gap: 10 }}>
        {!purchasesAvailable() || (pkgs && pkgs.length === 0) ? <Text style={{ color: c.warn }}>{tx.storeUnavailable}</Text> : null}
        {!pkgs && purchasesAvailable() && <ActivityIndicator />}
        {pkgs?.map((p) => {
          const on = p.identifier === selected;
          return (
            <Pressable key={p.identifier} onPress={() => setSelected(p.identifier)}
              style={[s.card, { marginBottom: 0, borderWidth: 2 }, on && { borderColor: c.accent }]}>
              <Text style={s.muted}>{p.packageType === "ANNUAL" ? `${tx.yearly} · ${tx.yearlySave}` : p.packageType === "MONTHLY" ? tx.monthly : p.product.title}</Text>
              <Text style={[s.h2, { fontSize: 22 }]}>{p.product.priceString}</Text>
            </Pressable>
          );
        })}
      </View>
      {pkgs && pkgs.length > 0 && (
        <>
          <Pressable style={[s.btn, { marginTop: 16, opacity: busy ? 0.5 : 1 }]} disabled={busy} onPress={purchase}>
            <Text style={s.btnText}>{tx.subscribe}</Text>
          </Pressable>
          <Text style={[s.muted, { textAlign: "center", marginTop: 8 }]}>{tx.cancelAnytime}</Text>
        </>
      )}
      {busy && <ActivityIndicator style={{ marginTop: 12 }} />}
      {msg && <Text style={[s.text, { marginTop: 12 }]}>{msg}</Text>}
      {purchasesAvailable() && (
        <Text style={[s.muted, { marginTop: 24, textAlign: "center", color: c.accent }]}
          onPress={async () => { setBusy(true); try { await restore(); await waitForPro(); } finally { setBusy(false); } }}>
          {tx.restorePurchases}
        </Text>
      )}
    </ScrollView>
  );
}
