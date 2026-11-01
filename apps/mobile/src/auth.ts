import { Platform } from "react-native";
import Line, { Scope } from "@xmartlabs/react-native-line";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import type { AuthResponse, Locale } from "@ai-learn/shared";
import { api } from "./api";
import { env } from "./config";

/**
 * 原生登录：拿到第三方 id_token 后交给后端换我们自己的 token。
 * 用户取消时返回 null。
 */
let configured = false;
function configure() {
  if (configured) return;
  configured = true;
  if (env.lineChannelId) void Line.setup({ channelId: env.lineChannelId });
  if (env.googleWebClientId) GoogleSignin.configure({ webClientId: env.googleWebClientId });
}

export const loginAvailable = () => ({ line: Boolean(env.lineChannelId), google: Boolean(env.googleWebClientId) });

export async function loginWithLine(locale: Locale): Promise<AuthResponse | null> {
  configure();
  try {
    const r = await Line.login({ scopes: [Scope.Profile, Scope.OpenId, Scope.Email] });
    const idToken = r.accessToken.idToken;
    if (!idToken) throw new Error("LINE did not return an id token");
    return await api.line(idToken, locale);
  } catch (e) {
    if (isCancel(e)) return null;
    throw e;
  }
}

export async function loginWithGoogle(locale: Locale): Promise<AuthResponse | null> {
  configure();
  if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const r = await GoogleSignin.signIn();
  if (!isSuccessResponse(r)) return null;
  if (!r.data.idToken) throw new Error("Google did not return an id token");
  return api.google(r.data.idToken, locale);
}

/** Apple 登录（仅 iOS；App Store 要求提供了第三方登录就必须同时提供 Apple 登录） */
export const appleAvailable = () => Platform.OS === "ios" && AppleAuthentication.isAvailableAsync();

export async function loginWithApple(locale: Locale): Promise<AuthResponse | null> {
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!cred.identityToken) throw new Error("Apple did not return an identity token");
    // 名字只有第一次授权时才有
    const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(" ") || null;
    return await api.apple(cred.identityToken, locale, name);
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw e;
  }
}

/** 退出时也退出 Google，下次可以换账号 */
export async function signOutProviders() {
  configure();
  await GoogleSignin.signOut().catch(() => undefined);
  await Line.logout().catch(() => undefined);
}

function isCancel(e: unknown) {
  const msg = String((e as { message?: string; code?: string })?.code ?? (e as Error)?.message ?? "").toLowerCase();
  return msg.includes("cancel");
}
