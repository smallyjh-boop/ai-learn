"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatDate, t, type Locale } from "@ai-learn/shared";
import { api } from "@/lib/api";
import { loginHref, refreshMe, signOut, useSession } from "@/lib/session";

export function AccountView({ locale }: { locale: Locale }) {
  const tx = t(locale);
  const router = useRouter();
  const paid = useSearchParams().get("paid") === "1";
  const { me, ready } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 主动退出 / 删除账户时不要再跳登录页
  const leaving = useRef(false);
  const leave = () => { leaving.current = true; router.replace(`/${locale}`); signOut(); };

  useEffect(() => {
    if (ready && !me && !leaving.current) router.replace(loginHref(locale, `/${locale}/account`));
  }, [ready, me, locale, router]);

  // 刚付完款：webhook 可能还没到，过几秒再刷新一次会员状态
  useEffect(() => {
    if (!paid) return;
    const timers = [2000, 6000].map((ms) => setTimeout(() => refreshMe(), ms));
    return () => timers.forEach(clearTimeout);
  }, [paid]);

  if (!me) return <p className="muted">…</p>;

  async function portal() {
    setBusy(true); setError(null);
    try { location.href = (await api.portal(locale)).url; } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  async function del() {
    if (!confirm(tx.deleteConfirm)) return;
    setBusy(true); setError(null);
    try {
      await api.deleteMe();
      leave();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <main>
      <h1>{tx.account}</h1>
      {paid && <p className="card ok">{tx.paySuccess}</p>}
      <section className="card">
        <p style={{ marginTop: 0 }}><strong>{me.name ?? me.email ?? "—"}</strong>{me.email && me.name ? <span className="muted"> · {me.email}</span> : null}</p>
        <p>{tx.xp}: <strong>{me.xp}</strong> · {tx.streak}: <strong>{me.streak}</strong> {tx.days}</p>
      </section>
      <section className="card">
        <p style={{ marginTop: 0 }}>
          {tx.plan}: <strong>{me.plan === "pro" ? tx.planPro : tx.planFree}</strong>
          {me.plan === "pro" && me.planExpiresAt && <span className="muted"> · {tx.expires} {formatDate(new Date(me.planExpiresAt), locale)}</span>}
        </p>
        {me.plan === "pro" && me.planSource && me.planSource !== "stripe" && <p className="muted">{tx.proFromApp}</p>}
        <div className="row" style={{ justifyContent: "flex-start" }}>
          {me.plan !== "pro" && <Link className="btn" href={`/${locale}/pricing`}>{tx.upgrade}</Link>}
          {me.canManageBilling && <button className="btn ghost" disabled={busy} onClick={portal}>{tx.manageBilling}</button>}
        </div>
      </section>
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn ghost" onClick={leave}>{tx.logout}</button>
        <button className="btn danger" disabled={busy} onClick={del}>{tx.deleteAccount}</button>
      </div>
    </main>
  );
}
