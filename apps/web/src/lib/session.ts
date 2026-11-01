"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Locale, Me } from "@ai-learn/shared";

/**
 * 登录状态（只在浏览器里）：token 存 localStorage，当前用户信息放内存并通知订阅的组件。
 * 这里不 import api.ts 的 call 以免循环依赖，/me 用 fetch 直接请求。
 */
const TOKEN_KEY = "ailearn_token";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

type State = { me: Me | null; ready: boolean };
const INITIAL: State = { me: null, ready: false };
let state: State = INITIAL;
const listeners = new Set<() => void>();
const emit = (next: State) => { state = next; listeners.forEach((l) => l()); };
let loading: Promise<void> | null = null;

async function loadMe() {
  const token = getToken();
  if (!token) return emit({ me: null, ready: true });
  try {
    const res = await fetch(new URL("/me", API_URL), { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (res.status === 401) { clearToken(); return emit({ me: null, ready: true }); }
    emit({ me: res.ok ? ((await res.json()) as Me) : null, ready: true });
  } catch {
    emit({ me: null, ready: true });
  }
}

function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* 隐私模式 */ }
}

/** 登录成功后调用 */
export function signIn(token: string, me: Me) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* 隐私模式下只在本页有效 */ }
  emit({ me, ready: true });
}

export function signOut() {
  clearToken();
  emit({ me: null, ready: true });
}

/** 课程完成等操作返回了新的用户信息时更新 */
export function updateMe(me: Me) { emit({ me, ready: true }); }

export function refreshMe() { loading = loadMe(); return loading; }

/** 当前用户；ready=false 表示还在读取 */
export function useSession(): State {
  const snap = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => INITIAL,
  );
  useEffect(() => { if (!state.ready && !loading) loading = loadMe(); }, []);
  return snap;
}

/** 登录页地址，登录后回到 next */
export const loginHref = (locale: Locale, next?: string) =>
  `/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

/** 只允许站内相对路径，防止 next 参数被用来跳到别的网站 */
export function safeNext(next: string | null | undefined, locale: Locale): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/learn`;
}
