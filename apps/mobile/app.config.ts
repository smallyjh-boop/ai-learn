import type { ExpoConfig } from "expo/config";

/**
 * App 配置。密钥类的值从环境变量读（EAS 构建时在 eas.json / EAS 环境变量里配置）：
 *   EXPO_PUBLIC_API_URL                API 地址
 *   EXPO_PUBLIC_LINE_CHANNEL_ID        LINE Login channel ID（和网站同一个 channel）
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID   Google OAuth「Web」客户端 ID（后端用它校验 idToken 的 aud）
 *   GOOGLE_IOS_URL_SCHEME              Google iOS 客户端的反向 client ID（做 iOS 时才需要）
 *   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY / EXPO_PUBLIC_REVENUECAT_IOS_KEY
 */
const googleIosScheme = process.env.GOOGLE_IOS_URL_SCHEME;

const config: ExpoConfig = {
  name: "AI Step by Step",
  slug: "ai-learn",
  scheme: "ailearn",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.example.ailearn",
    supportsTablet: true,
    usesAppleSignIn: true,
  },
  android: {
    package: "com.example.ailearn",
    // 每日提醒只用本地通知，不需要精确闹钟权限
    blockedPermissions: ["android.permission.SCHEDULE_EXACT_ALARM", "android.permission.USE_EXACT_ALARM"],
  },
  locales: {
    th: "./locales/th.json",
    zh: "./locales/zh.json",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-localization",
    "expo-web-browser",
    ["expo-notifications", { color: "#0f7b6c" }],
    ["expo-build-properties", { ios: { useFrameworks: "static" } }],
    "@xmartlabs/react-native-line",
    // Android 端 Google 登录不需要插件；iOS 端需要 URL scheme
    ...(googleIosScheme ? [["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosScheme }] as [string, unknown]] : []),
  ],
  experiments: { typedRoutes: true },
};

export default config;
