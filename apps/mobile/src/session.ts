import { useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
import type { Me } from "@ai-learn/shared";

/**
 * 登录状态：token 存 SecureStore，当前用户放内存并通知订阅的组件。
 * 登录 / 退出时同步通知 RevenueCat（见 purchases.ts 里的 onSessionChange）。
 */
const TOKEN_KEY = "ailearn_token";

type State = { token: string | null; me: Me | null; ready: boolean };
let state: State = { token: null, me: null, ready: false };
const listeners = new Set<() => void>();
const sessionHooks = new Set<(me: Me | null) => void>();

function emit(next: Partial<State>) {
  const prevId = state.me?.id ?? null;
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  if ((state.me?.id ?? null) !== prevId) sessionHooks.forEach((h) => h(state.me));
}

export const getToken = () => state.token;

/** 登录用户变化时回调（RevenueCat 识别用户等） */
export function onSessionChange(cb: (me: Me | null) => void) { sessionHooks.add(cb); return () => sessionHooks.delete(cb); }

/** App 启动时调用：读 token，并用 fetchMe 拉一次用户信息 */
export async function restoreSession(fetchMe: () => Promise<Me>) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return emit({ ready: true });
  state = { ...state, token };
  try {
    emit({ me: await fetchMe(), ready: true });
  } catch (e) {
    // 401 = token 失效；网络错误时保留 token，下次再试
    if ((e as { status?: number }).status === 401) await signOut();
    emit({ ready: true });
  }
}

export async function signIn(token: string, me: Me) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  emit({ token, me, ready: true });
}

export async function signOut() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  emit({ token: null, me: null, ready: true });
}

export function updateMe(me: Me) { emit({ me }); }

export function useSession(): State {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}
