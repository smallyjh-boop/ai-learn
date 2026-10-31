# CLAUDE.md — 项目交接说明

用户是程序员，用中文沟通。回复用中文。

## 产品
零基础用户按步骤学会使用 AI 的学习 App：网站 + iOS + Android，一个账号、一个订阅三端通用。
- 主要市场：泰国（**默认语言 th**），其次海外华人（zh）、英语用户（en），面向东南亚
- 默认货币泰铢；日期对泰语用户显示佛历；限额和打卡按曼谷时区（Asia/Bangkok）的日期重置
- 登录优先级：LINE > Google > Apple（iOS 上架必须有 Apple 登录）
- 前两个阶段（stage 0、1）免费，后面订阅解锁（`FREE_STAGES` in packages/shared/src/api.ts）

## 架构
- pnpm monorepo；共享包以 TS 源码形式被引用（无构建步骤）
- `apps/api`：Fastify。`buildApp(deps)` 依赖注入 Store / Quota / AiProvider / Catalog，方便测试
  - 没配 DATABASE_URL → MemoryStore；没配 REDIS_URL → MemoryQuota；没配 AI key → MockProvider
  - AI 调用只在后端，前端拿不到任何密钥
  - 练习流程：限额扣次 → 练习模型回答 → 点评模型按 rubric 打分输出 JSON → 失败则退还次数
  - 订阅：所有付款来源（Stripe / App Store / Play）都写 `entitlements` 表，各端只查后端
- `apps/web`：Next.js app router，路由 `/[locale]/...`，middleware 按浏览器语言跳转
- `apps/mobile`：Expo + expo-router，课程播放逻辑与网站版 LessonPlayer 保持一致
- `packages/content`：课程 JSON，按 zod schema 校验；其他语言缺课回退泰语

## 状态（骨架阶段）
已完成：课程格式与加载、课程地图/课程页/AI 练习/进度/经验值/连续打卡 API、限额、
RevenueCat 回调、LINE/Google token 校验、网站和 App 的学习地图与课程播放、Docker 部署文件、后端测试。

注意：骨架在一个无法访问 npm 的环境里写成，**尚未安装依赖、未跑过测试**。
接手第一步：`pnpm install && pnpm typecheck && pnpm --filter @ai-learn/api test`，修掉报错。

## 待办（按优先级）
1. 跑通安装、类型检查、测试；生成 pnpm-lock.yaml；`db:generate` 生成首个数据库迁移，并在 server 启动时执行迁移
2. 前端接入真实登录：LINE Login（网站用 LIFF 或 OAuth；App 用 LINE SDK）、Google、Apple；删除 DevLogin 组件
3. Apple identityToken 校验（JWKS）— `apps/api/src/auth/providers.ts`
4. 订阅：App 接 RevenueCat（App User ID = 我们的 user id）；网站接 Stripe Checkout + webhook 签名校验
5. 写满阶段 0、1 共 15 课（泰语为主，中文/英文跟上），`pnpm content:check`
6. 课程地图页对 SEO 改为服务端渲染（目前为客户端请求），加 sitemap.xml
7. 每日学习提醒推送（expo-notifications）、成就徽章、提示词收藏库
8. AI 用量日志与告警（记录每次调用 token 数）、练习内容审核

## 约定
- 新课程放 `packages/content/courses/<locale>/lessons/s<阶段>-<两位序号>.json`
- 新界面文字三种语言都要加到 `packages/shared/src/ui-text.ts`（TS 会检查缺漏）
- 泰文文案上线前由泰语母语者审校
