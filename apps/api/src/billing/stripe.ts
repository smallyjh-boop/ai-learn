import Stripe from "stripe";
import type { Locale } from "@ai-learn/shared";
import type { Entitlement, Store, UserRow } from "../db/store";

/**
 * 网站付款：Stripe Checkout（订阅）+ Customer Portal（用户自己管理/取消）+ webhook。
 * 用户 id 放在 client_reference_id 和 subscription.metadata.userId 里，webhook 靠它找到用户。
 */
export interface BillingConfig {
  secretKey: string;
  webhookSecret: string;
  priceMonthly: string;
  priceYearly: string;
  webUrl: string;
}

export type BillingPeriod = "monthly" | "yearly";

export class StripeBilling {
  readonly stripe: Stripe;
  constructor(private cfg: BillingConfig, stripe?: Stripe) {
    this.stripe = stripe ?? new Stripe(cfg.secretKey);
  }

  async checkoutUrl(user: UserRow, period: BillingPeriod, locale: Locale): Promise<string> {
    const price = period === "yearly" ? this.cfg.priceYearly : this.cfg.priceMonthly;
    if (!price) throw new Error(`STRIPE_PRICE_${period.toUpperCase()} 未配置`);
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : user.email ? { customer_email: user.email } : {}),
      subscription_data: { metadata: { userId: user.id } },
      locale: locale === "zh" ? "zh" : locale,
      success_url: `${this.cfg.webUrl}/${locale}/account?paid=1`,
      cancel_url: `${this.cfg.webUrl}/${locale}/pricing`,
    });
    if (!session.url) throw new Error("Stripe 没有返回付款链接");
    return session.url;
  }

  async portalUrl(customerId: string, locale: Locale): Promise<string> {
    const s = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.cfg.webUrl}/${locale}/account`,
    });
    return s.url;
  }

  /** 删除账号前取消该用户所有仍在扣费的订阅 */
  async cancelAll(customerId: string): Promise<void> {
    const subs = await this.stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
    for (const s of subs.data) {
      if (!["canceled", "incomplete_expired"].includes(s.status)) await this.stripe.subscriptions.cancel(s.id);
    }
  }

  /** 校验签名并解析事件；签名不对会抛错 */
  parseEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.cfg.webhookSecret);
  }

  async handleEvent(event: Stripe.Event, store: Store): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const userId = s.client_reference_id;
        const customer = typeof s.customer === "string" ? s.customer : s.customer?.id;
        if (!userId || !(await store.getUser(userId))) return;
        if (customer) await store.setStripeCustomer(userId, customer);
        if (s.subscription) {
          const sub = typeof s.subscription === "string" ? await this.stripe.subscriptions.retrieve(s.subscription) : s.subscription;
          await applySubscription(store, sub, userId);
        }
        return;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await applySubscription(store, event.data.object);
        return;
      }
      default:
        return;
    }
  }
}

/** 订阅状态 → 权益。active / trialing / past_due（宽限期）算 Pro */
export async function applySubscription(store: Store, sub: Stripe.Subscription, userIdHint?: string) {
  const userId = sub.metadata?.userId || userIdHint;
  if (!userId || !(await store.getUser(userId))) return;
  const active = ["active", "trialing", "past_due"].includes(sub.status);
  const periodEnd = Math.max(0, ...sub.items.data.map((i) => i.current_period_end ?? 0));
  await applyEntitlement(store, userId, {
    plan: active ? "pro" : "free",
    source: "stripe",
    expiresAt: active && periodEnd ? new Date(periodEnd * 1000) : null,
  });
}

/**
 * 写入权益。目前每个用户只有一行：如果另一个付款来源的会员仍然有效，
 * 本来源的「到期/取消」不应把它覆盖成 free。
 */
export async function applyEntitlement(store: Store, userId: string, next: Entitlement) {
  if (next.plan === "free") {
    const cur = await store.getEntitlement(userId);
    if (cur.plan === "pro" && cur.source && cur.source !== next.source) return;
  }
  await store.setEntitlement(userId, next);
}
