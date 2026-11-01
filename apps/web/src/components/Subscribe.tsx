"use client";

import { useState } from "react";
import { PRICING, defaultCurrency, t, type Locale } from "@ai-learn/shared";
import { api, ApiFailure } from "@/lib/api";
import { loginHref, useSession } from "@/lib/session";
import { WaitlistForm } from "./WaitlistForm";

/** 选择月付 / 年付 → 跳转 Stripe 付款页。没登录先去登录，付款未配置时改为收集邮箱 */
export function Subscribe({ locale }: { locale: Locale }) {
  const tx = t(locale);
  const price = PRICING[defaultCurrency(locale)];
  const { me } = useSession();
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  const [busy, setBusy] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me?.plan === "pro") return <p className="ok"><strong>{tx.alreadyPro}</strong></p>;

  async function go() {
    if (!me) { location.href = loginHref(locale, `/${locale}/pricing`); return; }
    setBusy(true); setError(null);
    try {
      location.href = (await api.checkout(period, locale)).url;
    } catch (e) {
      if (e instanceof ApiFailure && e.body.code === "NOT_CONFIGURED") setNotReady(true);
      else setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="plans">
        <button className="plan" aria-pressed={period === "monthly"} onClick={() => setPeriod("monthly")}>
          <div className="muted">{tx.monthly}</div>
          <div className="price">{price.symbol}{price.monthly}<span className="muted" style={{ fontSize: 14 }}>{tx.perMonth}</span></div>
        </button>
        <button className="plan" aria-pressed={period === "yearly"} onClick={() => setPeriod("yearly")}>
          <div className="muted">{tx.yearly} · <span className="badge">{tx.yearlySave}</span></div>
          <div className="price">{price.symbol}{price.yearly}<span className="muted" style={{ fontSize: 14 }}>{tx.perYear}</span></div>
        </button>
      </div>
      <div className="row">
        <span className="muted">{tx.cancelAnytime}</span>
        <button className="btn" disabled={busy} onClick={go}>{tx.subscribe}</button>
      </div>
      {error && <p className="err">{error}</p>}
      {notReady && (
        <div style={{ marginTop: 16 }}>
          <p>{tx.payNotReady}</p>
          <WaitlistForm locale={locale} />
        </div>
      )}
    </div>
  );
}
