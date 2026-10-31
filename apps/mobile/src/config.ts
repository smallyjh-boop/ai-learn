/** 构建时注入的公开配置（EXPO_PUBLIC_* 会被打包进 App，不要放密钥） */
export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000",
  lineChannelId: process.env.EXPO_PUBLIC_LINE_CHANNEL_ID ?? "",
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  revenuecatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "",
  revenuecatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
  /** 网站地址：隐私政策等页面直接打开网站版 */
  webUrl: (process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};
