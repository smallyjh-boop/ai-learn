import type { FastifyBaseLogger } from "fastify";

/**
 * 运营告警：写日志，并在配置了 ALERT_WEBHOOK_URL 时推送。
 * 推送的 JSON 同时带 text（Slack / Google Chat）和 content（Discord）字段，
 * 也可以接自己的中转服务转发到 LINE 群或 Telegram。
 * 同一类告警在 cooldownMs 内只推送一次，避免刷屏。
 */
export class Alerts {
  private last = new Map<string, number>();
  constructor(private webhookUrl: string, private log: FastifyBaseLogger, private cooldownMs = 60 * 60 * 1000) {}

  async send(key: string, text: string, extra: Record<string, unknown> = {}) {
    const now = Date.now();
    if (now - (this.last.get(key) ?? 0) < this.cooldownMs) return false;
    this.last.set(key, now);
    this.log.warn({ alert: key, ...extra }, text);
    if (!this.webhookUrl) return true;
    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `[ai-learn] ${text}`, content: `[ai-learn] ${text}`, alert: key, ...extra }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (e) {
      this.log.error(e, "alert webhook failed");
    }
    return true;
  }
}
