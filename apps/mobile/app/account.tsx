import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { formatDate, t } from "@ai-learn/shared";
import { api, deviceLocale } from "../src/api";
import { signOutProviders } from "../src/auth";
import { env } from "../src/config";
import { managementUrl } from "../src/purchases";
import { getReminder, setReminder, type Reminder } from "../src/reminders";
import { signOut, useSession } from "../src/session";
import { useTheme } from "../src/theme";

const TIMES = [[7, 0], [12, 0], [19, 0], [20, 0], [21, 0]] as const;
const hhmm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/** 我的账户：会员、每日提醒、退出、删除账户（Google Play / App Store 要求 App 内可删除账户） */
export default function Account() {
  const { s, c } = useTheme();
  const tx = t(deviceLocale);
  const { me } = useSession();
  const [rem, setRem] = useState<Reminder | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void getReminder().then(setRem); }, []);
  useEffect(() => { if (!me) router.replace("/"); }, [me]);
  if (!me) return null;

  async function saveReminder(next: Reminder) {
    const ok = await setReminder(next, deviceLocale);
    setRem(ok ? next : { ...next, enabled: false });
    setMsg(ok ? null : tx.notificationsDenied);
  }

  async function manage() {
    // App 内购在商店里管理；网站付款的打开网站账户页
    const url = me!.planSource === "stripe" ? `${env.webUrl}/${deviceLocale}/account` : await managementUrl();
    if (url) await Linking.openURL(url);
  }

  async function logout() {
    await signOutProviders();
    await signOut();
  }

  function confirmDelete() {
    Alert.alert(tx.deleteAccount, tx.deleteConfirm, [
      { text: tx.back, style: "cancel" },
      {
        text: tx.deleteAccount, style: "destructive", onPress: async () => {
          setBusy(true);
          try { await api.deleteMe(); await logout(); } catch (e) { setMsg((e as Error).message); setBusy(false); }
        },
      },
    ]);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.h2}>{me.name ?? me.email ?? "—"}</Text>
        {me.email && me.name ? <Text style={s.muted}>{me.email}</Text> : null}
        <Text style={[s.text, { marginTop: 8 }]}>{tx.xp}: {me.xp} · {tx.streak}: {me.streak} {tx.days}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.text}>
          {tx.plan}: <Text style={{ fontWeight: "700" }}>{me.plan === "pro" ? tx.planPro : tx.planFree}</Text>
        </Text>
        {me.plan === "pro" && me.planExpiresAt && <Text style={s.muted}>{tx.expires} {formatDate(new Date(me.planExpiresAt), deviceLocale)}</Text>}
        {me.plan === "pro"
          ? <Pressable style={[s.ghost, { marginTop: 12 }]} onPress={manage}><Text style={s.text}>{tx.manageBilling}</Text></Pressable>
          : <Pressable style={[s.btn, { marginTop: 12 }]} onPress={() => router.push("/paywall")}><Text style={s.btnText}>{tx.upgrade}</Text></Pressable>}
      </View>

      {rem && (
        <View style={s.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={s.h2}>{tx.dailyReminder}</Text>
            <Switch value={rem.enabled} onValueChange={(v) => saveReminder({ ...rem, enabled: v })} trackColor={{ true: c.accent }} />
          </View>
          {rem.enabled && (
            <>
              <Text style={[s.muted, { marginTop: 8 }]}>{tx.reminderTime}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {TIMES.map(([h, m]) => {
                  const on = rem.hour === h && rem.minute === m;
                  return (
                    <Pressable key={hhmm(h, m)} onPress={() => saveReminder({ ...rem, hour: h, minute: m })}
                      style={[s.ghost, { paddingVertical: 8, paddingHorizontal: 12 }, on && { borderColor: c.accent, backgroundColor: c.accentSoft }]}>
                      <Text style={s.text}>{hhmm(h, m)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      )}

      {msg && <Text style={{ color: c.warn, marginBottom: 12 }}>{msg}</Text>}
      <Pressable style={[s.ghost, { marginBottom: 12 }]} onPress={logout}><Text style={s.text}>{tx.logout}</Text></Pressable>
      <Pressable style={[s.ghost, { borderColor: c.warn }]} disabled={busy} onPress={confirmDelete}>
        <Text style={{ color: c.warn, fontWeight: "600" }}>{tx.deleteAccount}</Text>
      </Pressable>
      <Text style={[s.muted, { marginTop: 24, color: c.accent }]} onPress={() => Linking.openURL(`${env.webUrl}/${deviceLocale}/privacy`)}>{tx.privacy}</Text>
    </ScrollView>
  );
}
