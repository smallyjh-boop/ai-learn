import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { env } from "./config";
import { onSessionChange } from "./session";

/**
 * App 内购（RevenueCat 统一管理 Google Play / App Store）。
 * App User ID = 我们的用户 id：付款后 RevenueCat 回调后端 /webhooks/revenuecat 写入会员表，
 * 各端都以后端的 /me 为准，App 不自己判断会员。
 * 要求登录后才能购买（不支持匿名购买）。
 */
const apiKey = Platform.OS === "ios" ? env.revenuecatIosKey : env.revenuecatAndroidKey;
let ready = false;

export const purchasesAvailable = () => Boolean(apiKey);

export function initPurchases() {
  if (!apiKey || ready) return;
  Purchases.configure({ apiKey });
  ready = true;
  onSessionChange((me) => {
    if (me) void Purchases.logIn(me.id).catch(() => undefined);
    else void Purchases.logOut().catch(() => undefined);
  });
}

/** 当前 offering 里的套餐（月付 / 年付），在 RevenueCat 后台配置 */
export async function getPackages(): Promise<PurchasesPackage[]> {
  if (!ready) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

/** 购买；用户取消返回 false */
export async function buy(pkg: PurchasesPackage): Promise<boolean> {
  try {
    await Purchases.purchasePackage(pkg);
    return true;
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

export async function restore() {
  if (ready) await Purchases.restorePurchases();
}

/** 商店的订阅管理页（取消 / 更换套餐） */
export async function managementUrl(): Promise<string | null> {
  if (!ready) return null;
  return (await Purchases.getCustomerInfo()).managementURL;
}
