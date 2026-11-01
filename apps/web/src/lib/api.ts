import type {
  ApiError, AuthConfig, AuthResponse, CourseMapResponse, LessonResponse, Locale, Me, PracticeRequest, PracticeResponse,
  UrlResponse,
} from "@ai-learn/shared";
import { getToken } from "./session";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiFailure extends Error {
  constructor(public status: number, public body: ApiError) { super(body.error); }
}

async function call<T>(path: string, init: RequestInit = {}, locale?: Locale): Promise<T> {
  const url = new URL(path, API_URL);
  if (locale) url.searchParams.set("locale", locale);
  const token = getToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new ApiFailure(res.status, body as ApiError);
  return body as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  authConfig: () => call<AuthConfig>("/auth/config"),
  lineCode: (code: string, redirectUri: string, locale: Locale) => call<AuthResponse>("/auth/line/code", post({ code, redirectUri, locale })),
  google: (idToken: string, locale: Locale) => call<AuthResponse>("/auth/google", post({ idToken, locale })),
  devLogin: (email: string, locale: Locale) => call<AuthResponse>("/auth/dev", post({ email }), locale),
  me: () => call<Me>("/me"),
  deleteMe: () => call<{ ok: true }>("/me", { method: "DELETE" }),

  courses: (locale: Locale) => call<CourseMapResponse>("/courses", {}, locale),
  lesson: (id: string, locale: Locale) => call<LessonResponse>(`/lessons/${encodeURIComponent(id)}`, {}, locale),
  practice: (req: PracticeRequest, locale: Locale) => call<PracticeResponse>("/practice", post(req), locale),
  complete: (lessonId: string, locale: Locale, score?: number, timing?: { durationSec: number; stepSeconds: number[] }) =>
    call<{ first: boolean; me: Me }>("/progress/complete", post({ lessonId, score, ...timing }), locale),

  waitlist: (email: string, locale: Locale) => call<{ ok: true; added: boolean }>("/waitlist", post({ email, locale })),
  checkout: (period: "monthly" | "yearly", locale: Locale) => call<UrlResponse>("/billing/checkout", post({ period }), locale),
  portal: (locale: Locale) => call<UrlResponse>("/billing/portal", post({}), locale),
};
