# CLAUDE.md — 项目交接说明

用户是程序员，用中文沟通。回复用中文。

## 产品
零基础用户按步骤学会使用 AI 的学习 App：网站 + iOS + Android，一个账号、一个订阅三端通用。
- 主要市场：泰国（**默认语言 th**），其次海外华人（zh）、英语用户（en），面向东南亚
- 默认货币泰铢；日期对泰语用户显示佛历；限额和打卡按曼谷时区（Asia/Bangkok）的日期重置
- 登录优先级：LINE > Google > Apple（iOS 上架必须有 Apple 登录）
- 前两个阶段（stage 0、1）免费，后面订阅解锁（唯一来源：`FREE_STAGES` in packages/shared/src/api.ts）

## 架构
- pnpm monorepo；共享包以 TS 源码形式被引用（无构建步骤）
- `apps/api`：Fastify。`buildApp(deps)` 依赖注入 Store / Quota / AiProvider / Catalog，方便测试
  - 没配 DATABASE_URL → MemoryStore；没配 REDIS_URL → MemoryQuota；没配 AI key → MockProvider；没配 STRIPE_SECRET_KEY → 付款接口返回 NOT_CONFIGURED
  - 生产环境（NODE_ENV=production）缺 JWT_SECRET / DATABASE_URL / AI key 会启动失败
  - AI 调用只在后端，前端拿不到任何密钥
  - 练习流程：限额扣次 → 练习模型回答 → 点评模型按 rubric 打分输出 JSON → 失败则退还次数
  - 订阅：所有付款来源（Stripe / App Store / Play）都写 `entitlements` 表，各端只查后端
- `apps/web`：Next.js app router，路由 `/[locale]/...`，middleware 按浏览器语言跳转
  - 课程地图、课程页、落地页在服务端直接读 `packages/content`（构建时静态生成，利于 SEO），登录用户的进度/会员内容走 API
  - LINE 网页登录回调固定为 `/auth/line`（不带语言前缀）；登录配置运行时从 `GET /auth/config` 读取
- `apps/mobile`：Expo + expo-router，课程播放逻辑与网站版 LessonPlayer 保持一致
- `packages/content`：课程 JSON，按 zod schema 校验；其他语言缺课回退泰语

## 状态
**开发顺序（已与用户确认）：先做好网站 → NAS 内测 → Android App → iOS App 放最后。**
账号体系独立，不与 lucky 共用。

已完成：
- 后端：Postgres 迁移（启动时自动执行）、LINE（网页授权码 / App id_token）、Google、Apple（JWKS 本地校验）登录、
  Stripe 订阅（Checkout / 订阅管理页 / webhook 签名校验）、RevenueCat 回调、会员按付款来源分行存储并合并、
  AI 用量记录 + 当日告警 + webhook 推送、练习内容审核（点评模型判 on_task）、删除账号、预约名单、
  学习用时记录（每步秒数，`StepTimer` 在 packages/shared，网站和 App 共用）+ `GET /admin/lesson-stats`（ADMIN_TOKEN）
- 网站：落地页、学习地图和课程页服务端渲染（构建时静态生成）、sitemap / robots、登录、账户、价格、隐私政策
- App（Expo SDK 58）：LINE / Google / Apple 登录、RevenueCat 付费墙、每日学习提醒（本地通知）、账户页（含删除账户）、
  课程播放与网站一致。只验证了 tsc、expo export（android / ios 打包）、expo-doctor，**还没在真机上跑过**
- 课程：阶段 0、1（免费）+ 阶段 2（付费）共 25 课，泰/中/英三语（泰文待母语者审校）
- 测试：`pnpm --filter @ai-learn/api test`；设 `TEST_DATABASE_URL` 时同一套测试再跑一遍 Postgres 版

## 待办（按优先级）
1. NAS 内测（用户操作）：填 `.env`，`docker compose up -d --build`；在 LINE / Google / Stripe 后台登记回调地址（见 .env.example）
2. 泰语母语者审校课程和界面文字；隐私政策请法律顾问看一遍；设置 NEXT_PUBLIC_CONTACT_EMAIL
3. Android 上架准备（用户操作为主）：EAS 账号、`eas build --profile development` 真机测试、
   Google Cloud 建 Android OAuth 客户端（包名 + SHA-1）、LINE channel 加 Android 设置、
   Play Console 建订阅商品并接入 RevenueCat；替换 `com.example.ailearn` 包名和 App 图标
4. 根据内测反馈调整课程（`/admin/lesson-stats` 校准每课 minutes、看卡住的步骤），再写阶段 3–5（约 34 课）
5. 成就徽章、提示词收藏库、结业证书
6. iOS 上架：Apple Developer 账号、App Store Connect 订阅商品、`GOOGLE_IOS_URL_SCHEME`

## 已知取舍
- 同一邮箱用 LINE 和 Google 登录是两个账号（不按邮箱自动合并，防账号接管）；以后需要可加 identities 表做手动绑定
- App 内付费墙不放网站付款链接（商店规定）；网站付款的会员在 App 里登录即可使用
- 课程页是构建时静态生成的：改课程 JSON 后要重新构建网站（API 端重启即可）
- 付费课只把第一段讲解渲染进页面；会员内容由 API 校验后返回

## 背景资料
- 可行性报告与实现方案（含课程体系 6 阶段约 60 课、功能清单、成本、排期）：
  https://claude.ai/artifact/KYqEB2f21L7ZYTYa8ogFYs
- 开发节奏：先网站在 NAS 上公测、验证付费意愿，达标后再上架 iOS / Android
- 登录、多语言、三端订阅、NAS 部署的做法与用户的另一个项目 lucky（算命平台）相同，可以参考或抽成公共模块

## 约定
- 新课程放 `packages/content/courses/<locale>/lessons/s<阶段>-<两位序号>.json`
- 新界面文字三种语言都要加到 `packages/shared/src/ui-text.ts`（TS 会检查缺漏）
- 泰文文案上线前由泰语母语者审校
