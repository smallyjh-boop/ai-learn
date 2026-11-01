"use client";

import { useState } from "react";
import { t, type Locale } from "@ai-learn/shared";
import { api } from "@/lib/api";

export function WaitlistForm({ locale }: { locale: Locale }) {
  const tx = t(locale);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (state === "done") return <p className="ok">{tx.joined}</p>;
  return (
    <form className="row" style={{ justifyContent: "flex-start" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        try { await api.waitlist(email, locale); setState("done"); } catch { setState("error"); }
      }}>
      <input className="input" type="email" required value={email} placeholder={tx.emailPlaceholder} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn" disabled={state === "busy"}>{tx.join}</button>
      {state === "error" && <p className="err" style={{ width: "100%" }}>{tx.loginFailed}</p>}
    </form>
  );
}
