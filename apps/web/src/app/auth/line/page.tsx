"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, t, type Locale } from "@ai-learn/shared";
import { api } from "@/lib/api";
import { safeNext, signIn } from "@/lib/session";
import { LINE_CALLBACK_PATH, LINE_STATE_KEY } from "@/components/LoginPanel";

function LineCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [error, setError] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let saved: { state?: string; locale?: string; next?: string } = {};
    try { saved = JSON.parse(sessionStorage.getItem(LINE_STATE_KEY) ?? "{}"); } catch { /* ignore */ }
    sessionStorage.removeItem(LINE_STATE_KEY);
    const loc = isLocale(saved.locale) ? saved.locale : DEFAULT_LOCALE;
    setLocale(loc);

    const code = params.get("code");
    // state 必须和发起登录时存的一致（防 CSRF）
    if (!code || !saved.state || params.get("state") !== saved.state) { setError(true); return; }
    api.lineCode(code, `${location.origin}${LINE_CALLBACK_PATH}`, loc)
      .then((r) => { signIn(r.token, r.me); router.replace(safeNext(saved.next, loc)); })
      .catch(() => setError(true));
  }, [params, router]);

  const tx = t(locale);
  return (
    <main className="card" style={{ maxWidth: 420, margin: "40px auto", textAlign: "center" }}>
      {error ? (
        <>
          <p className="err">{tx.loginFailed}</p>
          <a className="btn" href={`/${locale}/login`}>{tx.loginTitle}</a>
        </>
      ) : <p className="muted">{tx.loggingIn}</p>}
    </main>
  );
}

export default function Page() {
  return <Suspense><LineCallback /></Suspense>;
}
