/**
 * 语言与地区设置
 * 主要市场：泰国（默认 th），其次海外华人（zh）与英语用户（en），整体面向东南亚。
 */
export const LOCALES = ["th", "zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "th";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** 从 Accept-Language 之类的字符串里挑出最匹配的语言，找不到就用泰语 */
export function pickLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const parts = input.toLowerCase().split(",").map((p) => p.trim().slice(0, 2));
  for (const p of parts) if (isLocale(p)) return p;
  return DEFAULT_LOCALE;
}

export const LOCALE_LABEL: Record<Locale, string> = {
  th: "ไทย",
  zh: "中文",
  en: "English",
};

/** 按地区定价（展示用；真实价格以 App Store / Google Play / Stripe 后台为准） */
export const PRICING = {
  THB: { monthly: 99, yearly: 690, symbol: "฿" },
  USD: { monthly: 4.99, yearly: 34.99, symbol: "$" },
  CNY: { monthly: 25, yearly: 168, symbol: "¥" },
} as const;
export type Currency = keyof typeof PRICING;

export function defaultCurrency(locale: Locale): Currency {
  return locale === "th" ? "THB" : locale === "zh" ? "CNY" : "USD";
}

/** 泰国习惯用佛历（公历 + 543） */
export function formatDate(d: Date, locale: Locale): string {
  if (locale === "th") {
    return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { dateStyle: "medium" }).format(d);
  }
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { dateStyle: "medium" }).format(d);
}
