/**
 * 第三方登录：前端拿到 id_token 后交给后端验证，后端换成自己的 JWT。
 * 泰国用户优先 LINE，其次 Google；iOS 上架必须同时提供 Apple 登录。
 */
export interface VerifiedIdentity {
  provider: "line" | "google" | "apple";
  providerId: string;
  email: string | null;
  name: string | null;
}

/** LINE Login：https://developers.line.biz/en/reference/line-login/#verify-id-token */
export async function verifyLine(idToken: string, channelId: string): Promise<VerifiedIdentity> {
  if (!channelId) throw new Error("LINE_CHANNEL_ID 未配置");
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  if (!res.ok) throw new Error("LINE token 无效");
  const p = (await res.json()) as { sub: string; email?: string; name?: string };
  return { provider: "line", providerId: p.sub, email: p.email ?? null, name: p.name ?? null };
}

/**
 * LINE Login 网页版（OAuth 授权码流程）：网站跳转到 LINE 授权页，回调拿到 code，
 * 由后端用 Channel Secret 换取 id_token，再按上面的方式校验。
 * https://developers.line.biz/en/reference/line-login/#issue-access-token
 */
export async function exchangeLineCode(code: string, redirectUri: string, channelId: string, channelSecret: string): Promise<VerifiedIdentity> {
  if (!channelId || !channelSecret) throw new Error("LINE_CHANNEL_ID / LINE_CHANNEL_SECRET 未配置");
  const res = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: channelId, client_secret: channelSecret,
    }),
  });
  if (!res.ok) throw new Error("LINE 授权码无效或已过期");
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("LINE 没有返回 id_token（请在 scope 里包含 openid）");
  return verifyLine(id_token, channelId);
}

/** Google：用 tokeninfo 校验（流量大后可改为本地 JWKS 校验） */
export async function verifyGoogle(idToken: string, clientIds: string[]): Promise<VerifiedIdentity> {
  if (!clientIds.length) throw new Error("GOOGLE_CLIENT_ID 未配置");
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("Google token 无效");
  const p = (await res.json()) as { sub: string; aud: string; email?: string; email_verified?: string | boolean; name?: string };
  if (!clientIds.includes(p.aud)) throw new Error("Google token 的 aud 不匹配");
  const verified = p.email_verified === true || p.email_verified === "true";
  return { provider: "google", providerId: p.sub, email: verified ? p.email ?? null : null, name: p.name ?? null };
}

/** Apple：需用 Apple 公钥 (JWKS) 校验 identityToken —— TODO 上架 iOS 前实现 */
export async function verifyApple(_identityToken: string): Promise<VerifiedIdentity> {
  throw new Error("Apple 登录尚未实现");
}
