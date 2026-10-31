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

网站公测所需功能已完成：
- 后端：Postgres 迁移（启动时自动执行）、LINE 网页登录（授权码）、Google 登录、Stripe 订阅
  （Checkout / 订阅管理页 / webhook 签名校验）、AI 用量记录与当日告警、删除账号、预约名单
- 网站：落地页（大纲 + 定价 + 预约邮箱）、学习地图和课程页服务端渲染（构建时静态生成）、
  sitemap.xml / robots.txt、登录页、账户页、价格页、隐私政策；DevLogin 只在开发环境出现
- 课程：阶段 0、1 共 15 课，泰/中/英三语（泰文待母语者审校）
- 测试：`pnpm --filter @ai-learn/api test`；设 `TEST_DATABASE_URL` 时同一套测试再跑一遍 Postgres 版

## 待办（按优先级）
1. NAS 内测：填 `.env`（JWT_SECRET、ANTHROPIC_API_KEY、LINE、Google、WEB_URL 等），
   `docker compose up -d --build`；在 LINE / Google / Stripe 后台登记回调地址（见 .env.example 注释）
2. 泰语母语者审校课程和界面文字；隐私政策请法律顾问看一遍；设置 NEXT_PUBLIC_CONTACT_EMAIL
3. 内测反馈：练习内容审核（目前只靠系统提示词拒绝无关/有害内容）、AI 用量告警接到通知渠道
4. Android App：接入真实登录（LINE SDK、Google）、RevenueCat（App User ID = 我们的 user id）、
   每日学习提醒推送（expo-notifications）；移动端课程播放与网站版保持一致
5. 上架 App 前：`entitlements` 改为每个付款来源一行（目前单行 + 「不覆盖另一来源的有效会员」保护）；
   可选：identities 表支持一个账号绑定多种登录方式
6. iOS App：Apple 登录 + identityToken 校验（JWKS，`apps/api/src/auth/providers.ts`）
7. 阶段 2–5 课程、成就徽章、提示词收藏库、结业证书

## 已知取舍
- 同一邮箱用 LINE 和 Google 登录是两个账号（不按邮箱自动合并，防账号接管）
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
