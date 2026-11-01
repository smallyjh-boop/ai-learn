import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { t, type AuthResponse } from "@ai-learn/shared";
import { api, deviceLocale } from "../src/api";
import * as AppleAuthentication from "expo-apple-authentication";
import { appleAvailable, loginAvailable, loginWithApple, loginWithGoogle, loginWithLine } from "../src/auth";
import { env } from "../src/config";
import { signIn } from "../src/session";
import { useTheme } from "../src/theme";

/** 登录：LINE（泰国首选）> Google；开发版多一个测试登录 */
export default function Login() {
  const { s, c } = useTheme();
  const tx = t(deviceLocale);
  const avail = loginAvailable();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devLogin, setDevLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [apple, setApple] = useState(false);

  useEffect(() => { void Promise.resolve(appleAvailable()).then((v) => setApple(Boolean(v))); }, []);

  useEffect(() => {
    if (__DEV__) api.authConfig().then((cfg) => setDevLogin(cfg.devLogin)).catch(() => undefined);
  }, []);

  async function run(fn: () => Promise<AuthResponse | null>) {
    setBusy(true); setError(null);
    try {
      const r = await fn();
      if (r) { await signIn(r.token, r.me); router.back(); }
    } catch {
      setError(tx.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={[s.text, { marginBottom: 20 }]}>{tx.loginWhy}</Text>
      {avail.line && (
        <Pressable style={[s.btn, { backgroundColor: "#06c755", marginBottom: 12 }]} disabled={busy} onPress={() => run(() => loginWithLine(deviceLocale))}>
          <Text style={s.btnText}>{tx.loginLine}</Text>
        </Pressable>
      )}
      {avail.google && (
        <Pressable style={[s.ghost, { marginBottom: 12 }]} disabled={busy} onPress={() => run(() => loginWithGoogle(deviceLocale))}>
          <Text style={s.text}>{tx.loginGoogle}</Text>
        </Pressable>
      )}
      {apple && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={c.bg === "#15171a" ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={10}
          style={{ height: 48, marginBottom: 12 }}
          onPress={() => run(() => loginWithApple(deviceLocale))}
        />
      )}
      {!avail.line && !avail.google && !apple && !devLogin && <Text style={{ color: c.warn }}>{tx.loginNotConfigured}</Text>}
      {devLogin && (
        <View style={{ gap: 8, marginTop: 16 }}>
          <Text style={s.muted}>{tx.devLogin}</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="email" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={c.muted} />
          <Pressable style={s.ghost} disabled={busy || !email.includes("@")} onPress={() => run(() => api.devLogin(email, deviceLocale))}>
            <Text style={s.text}>OK</Text>
          </Pressable>
        </View>
      )}
      {busy && <ActivityIndicator style={{ marginTop: 16 }} />}
      {error && <Text style={{ color: c.warn, marginTop: 12 }}>{error}</Text>}
      <Text style={[s.muted, { marginTop: 24 }]}>
        {tx.agreePrivacy}{" "}
        <Text style={{ color: c.accent }} onPress={() => Linking.openURL(`${env.webUrl}/${deviceLocale}/privacy`)}>{tx.privacy}</Text>
      </Text>
    </ScrollView>
  );
}
