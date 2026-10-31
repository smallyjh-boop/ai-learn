import { NextResponse, type NextRequest } from "next/server";
import { LOCALES, pickLocale } from "@ai-learn/shared";

/** 没带语言前缀的网址，按浏览器语言跳转（默认泰语）：/learn → /th/learn */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1];
  if ((LOCALES as readonly string[]).includes(first ?? "")) return;

  const locale = req.cookies.get("locale")?.value ?? pickLocale(req.headers.get("accept-language"));
  const url = req.nextUrl.clone();
  url.pathname = `/${pickLocale(locale)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
