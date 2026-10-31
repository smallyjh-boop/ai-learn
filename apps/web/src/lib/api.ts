import type {
  ApiError, AuthResponse, CourseMapResponse, LessonResponse, Locale, Me, PracticeRequest, PracticeResponse,
} from "@ai-learn/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "ailearn_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* 隐私模式 */ }
}

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
