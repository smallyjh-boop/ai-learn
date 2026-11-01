import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { t, type Locale } from "@ai-learn/shared";

/** 每日学习提醒：本地通知，每天固定时间（不需要推送服务器） */
const KEY = "ailearn_reminder";
export type Reminder = { enabled: boolean; hour: number; minute: number };
const DEFAULT: Reminder = { enabled: false, hour: 20, minute: 0 };

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function getReminder(): Promise<Reminder> {
  try { return { ...DEFAULT, ...JSON.parse((await SecureStore.getItemAsync(KEY)) ?? "{}") }; } catch { return DEFAULT; }
}

/** 保存并重新安排提醒；没有通知权限时返回 false */
export async function setReminder(r: Reminder, locale: Locale): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (r.enabled) {
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) {
      await SecureStore.setItemAsync(KEY, JSON.stringify({ ...r, enabled: false }));
      return false;
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("daily", { name: t(locale).dailyReminder, importance: Notifications.AndroidImportance.DEFAULT });
    }
    const tx = t(locale);
    await Notifications.scheduleNotificationAsync({
      content: { title: tx.reminderTitle, body: tx.reminderBody },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: "daily" },
    });
  }
  await SecureStore.setItemAsync(KEY, JSON.stringify(r));
  return true;
}
