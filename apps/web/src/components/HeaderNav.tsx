"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_LABEL, t, type Locale } from "@ai-learn/shared";
import { loginHref, useSession } from "@/lib/session";

/** 右上角：语言切换（停留在当前页）+ 登录 / 我的账户 */
export function HeaderNav({ locale }: { locale: Locale }) {
  const tx = t(locale);
  const path = usePathname() ?? `/${locale}`;
  const rest = path.split("/").slice(2).join("/");
  const { me, ready } = useSession();

  return (
    <nav className="nav">
      <span className="langs" aria-label="language">
        {LOCALES.map((l) => (
          <Link key={l} href={`/${l}${rest ? `/${rest}` : ""}`} aria-current={l === locale}
            onClick={() => { document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`; }}>
            {LOCALE_LABEL[l]}
          </Link>
        ))}
      </span>
      {ready && (me
        ? <Link className="nav-link" href={`/${locale}/account`}>{me.plan === "pro" ? "⭐ " : ""}{me.name ?? tx.account}</Link>
        : <Link className="nav-link" href={loginHref(locale, path)}>{tx.login}</Link>)}
    </nav>
  );
}
