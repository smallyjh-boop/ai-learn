"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { t, type AuthConfig, type AuthResponse, type Locale } from "@ai-learn/shared";
import { api } from "@/lib/api";
import { safeNext, signIn } from "@/lib/session";

/** LINE 授权完成后回到这个固定地址（需要在 LINE Developers 后台登记） */
export const LINE_CALLBACK_PATH = "/auth/line";
export const LINE_STATE_KEY = "ailearn_line_state";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
        };
      };
    };
  }
}

/** 登录方式：LINE（泰国用户首选）> Google；开发环境多一个测试登录 */
export function LoginPanel({ locale }: { locale: Locale }) {
  const tx = t(locale);
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"), locale);
  const [cfg, setCfg] = useState<AuthConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.authConfig().then(setCfg).catch(() => setError(tx.loginFailed)); }, [tx.loginFailed]);

  function done(r: AuthResponse) {
    signIn(r.token, r.me);
    router.replace(next);
  }

  function lineLogin() {
    if (!cfg?.lineChannelId) return;
    const state = crypto.randomUUID();
    sessionStorage.setItem(LINE_STATE_KEY, JSON.stringify({ state, locale, next }));
    const q = new URLSearchParams({
      response_type: "code",
      client_id: cfg.lineChannelId,
      redirect_uri: `${location.origin}${LINE_CALLBACK_PATH}`,
      state,
      scope: "profile openid email",
      ui_locales: locale === "zh" ? "zh-CN" : locale,
    });
    location.href = `https://access.line.me/oauth2/v2.1/authorize?${q}`;
  }

  const none = cfg && !cfg.lineChannelId && !cfg.googleClientId && !cfg.devLogin;

  return (
    <main className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>{tx.loginTitle}</h1>
      <p className="muted">{tx.loginWhy}</p>
      {!cfg && !error && <p className="muted">…</p>}
      {cfg?.lineChannelId && (
        <button className="btn line-btn login-btn" onClick={lineLogin}>{tx.loginLine}</button>
      )}
      {cfg?.googleClientId && (
        <GoogleButton clientId={cfg.googleClientId} locale={locale}
          onToken={async (idToken) => {
            setBusy(true); setError(null);
            try { done(await api.google(idToken, locale)); } catch { setError(tx.loginFailed); setBusy(false); }
          }} />
      )}
      {cfg?.devLogin && <DevLogin locale={locale} label={tx.devLogin} onDone={done} />}
      {none && <p className="err">{tx.loginNotConfigured}</p>}
      {busy && <p className="muted">{tx.loggingIn}</p>}
      {error && <p className="err">{error}</p>}
      <p className="muted" style={{ fontSize: 13 }}>
        {tx.agreePrivacy} <Link href={`/${locale}/privacy`}>{tx.privacy}</Link>
      </p>
    </main>
  );
}

function GoogleButton({ clientId, locale, onToken }: { clientId: string; locale: Locale; onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    const render = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
      window.google.accounts.id.renderButton(ref.current, {
        theme: "outline", size: "large", width: 320, text: "continue_with", locale: locale === "zh" ? "zh_CN" : locale,
      });
    };
    if (window.google) return render();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [clientId, locale]);

  return <div ref={ref} style={{ display: "flex", justifyContent: "center", margin: "10px 0", minHeight: 44 }} />;
}

/** 开发环境测试登录（后端只在非生产环境开放 /auth/dev） */
function DevLogin({ locale, label, onDone }: { locale: Locale; label: string; onDone: (r: AuthResponse) => void }) {
  const [email, setEmail] = useState("");
  return (
    <details style={{ marginTop: 16 }}>
      <summary className="muted">{label}</summary>
      <div className="row">
        <input className="input" type="email" value={email} placeholder="email" onChange={(e) => setEmail(e.target.value)} />
        <button className="btn ghost" disabled={!email.includes("@")}
          onClick={async () => onDone(await api.devLogin(email, locale))}>OK</button>
      </div>
    </details>
  );
}
