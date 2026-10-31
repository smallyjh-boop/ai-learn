import * as SecureStore from "expo-secure-store";
import { getLocales } from "expo-localization";
import {
  pickLocale, type ApiError, type AuthResponse, type CourseMapResponse, type LessonResponse, type Locale, type Me,
  type PracticeRequest, type PracticeResponse,
} from "@ai-learn/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "ailearn_token";

/** 手机系统语言 → th / zh / en，默认泰语 */
export const deviceLocale: Locale = pickLocale(getLocales().map((l) => l.languageCode).join(","));

let token: string | null = null;
export async function loadToken() { token = await SecureStore.getItemAsync(TOKEN_KEY); return token; }
export async function saveToken(t: string | null) {
  token = t;
  if (t) await SecureStore.setItemAsync(TOKEN_KEY, t); else await SecureStore.deleteItemAsync(TOKEN_KEY);
}
export const hasToken = () => Boolean(token);

export class ApiFailure extends Error {
  constructor(public status: number, public body: ApiError) { super(body.error); }
}

async function call<T>(path: string, init: RequestInit = {}, locale?: Locale): Promise<T> {
  const url = `${API_URL}${path}${locale ? `${path.includes("?") ? "&" : "?"}locale=${locale}` : ""}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new ApiFailure(res.status, body as ApiError);
  return body as T;
}

export const api = {
  courses: (locale: Locale) => call<CourseMapResponse>("/courses", {}, locale),
  lesson: (id: string, locale: Locale) => call<LessonResponse>(`/lessons/${encodeURIComponent(id)}`, {}, locale),
  me: () => call<Me>("/me"),
  devLogin: (email: string, locale: Locale) =>
    call<AuthResponse>("/auth/dev", { method: "POST", body: JSON.stringify({ email }) }, locale),
  practice: (req: PracticeRequest, locale: Locale) =>
    call<PracticeResponse>("/practice", { method: "POST", body: JSON.stringify(req) }, locale),
  complete: (lessonId: string, score?: number) =>
    call<{ first: boolean; me: Me }>("/progress/complete", { method: "POST", body: JSON.stringify({ lessonId, score }) }),
};
