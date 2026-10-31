import { getLocales } from "expo-localization";
import {
  pickLocale, type ApiError, type AuthConfig, type AuthResponse, type CourseMapResponse, type LessonResponse, type Locale,
  type Me, type PracticeRequest, type PracticeResponse,
} from "@ai-learn/shared";
import { env } from "./config";
import { getToken } from "./session";

/** 手机系统语言 → th / zh / en，默认泰语 */
export const deviceLocale: Locale = pickLocale(getLocales().map((l) => l.languageCode).join(","));

export class ApiFailure extends Error {
  constructor(public status: number, public body: ApiError) { super(body.error); }
}

async function call<T>(path: string, init: RequestInit = {}, locale?: Locale): Promise<T> {
  const url = `${env.apiUrl}${path}${locale ? `${path.includes("?") ? "&" : "?"}locale=${locale}` : ""}`;
  const token = getToken();
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

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  authConfig: () => call<AuthConfig>("/auth/config"),
  line: (idToken: string, locale: Locale) => call<AuthResponse>("/auth/line", post({ idToken, locale })),
  google: (idToken: string, locale: Locale) => call<AuthResponse>("/auth/google", post({ idToken, locale })),
  apple: (idToken: string, locale: Locale, name?: string | null) => call<AuthResponse>("/auth/apple", post({ idToken, locale, name })),
  devLogin: (email: string, locale: Locale) => call<AuthResponse>("/auth/dev", post({ email }), locale),
  me: () => call<Me>("/me"),
  deleteMe: () => call<{ ok: true }>("/me", { method: "DELETE" }),

  courses: (locale: Locale) => call<CourseMapResponse>("/courses", {}, locale),
  lesson: (id: string, locale: Locale) => call<LessonResponse>(`/lessons/${encodeURIComponent(id)}`, {}, locale),
  practice: (req: PracticeRequest, locale: Locale) => call<PracticeResponse>("/practice", post(req), locale),
  complete: (lessonId: string, locale: Locale, score?: number) =>
    call<{ first: boolean; me: Me }>("/progress/complete", post({ lessonId, score }), locale),
};
