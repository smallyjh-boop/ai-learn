# AI Step by Step（一步步学AI / เรียน AI ทีละขั้น）

一个按步骤、系统化教零基础用户使用 AI 的学习产品：网站 + iOS + Android，一个账号、一个订阅三端通用。
主要市场：泰国（泰语为默认语言），其次海外华人和英语用户，整体面向东南亚。

## 目录结构

```
apps/
  api/       后端 Fastify + Drizzle（Postgres）+ Redis 限额 + AI 网关
  web/       网站 Next.js（/th /zh /en 多语言路由，利于 SEO）
  mobile/    iOS / Android，Expo + expo-router，一套代码
packages/
  shared/    三端共用：课程格式(zod)、接口类型、界面文字、定价、极简 Markdown
  content/   课程内容 JSON（courses/<语言>/lessons/*.json）+ 加载器 + 检查脚本
```

## 本地运行

```bash
pnpm install
cp .env.example .env          # 不填 DATABASE_URL / REDIS_URL / AI key 也能跑（内存存储 + mock AI）

pnpm dev:api                  # http://localhost:4000
pnpm dev:web                  # http://localhost:3000  → 自动跳转 /th
pnpm dev:mobile               # 用 Expo Go 扫码

pnpm --filter @ai-learn/api test   # 后端测试（内存版）
# 同一套测试再跑 Postgres 版（需要一个空的测试库）
TEST_DATABASE_URL=postgres://ailearn@localhost:5432/ailearn_test pnpm --filter @ai-learn/api test
pnpm content:check                 # 检查课程 JSON 格式、各语言缺课情况
```

真机调试 App 时把 `EXPO_PUBLIC_API_URL` 改成电脑的局域网 IP。

## NAS 测试部署

```bash
cp .env.example .env   # 填 JWT_SECRET、ANTHROPIC_API_KEY、LINE/Google、WEB_URL、NEXT_PUBLIC_* 等
docker compose up -d --build
```

- API 启动时自动执行数据库迁移（`apps/api/drizzle/`）
- `WEB_URL`、`NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_SITE_URL` 要填浏览器能访问到的地址（NAS 的 IP 或域名），不能是 localhost
- 回调地址要在各平台登记：LINE → `<WEB_URL>/auth/line`；Google → 授权的 JavaScript 来源填 `WEB_URL`；
  Stripe webhook → `<API地址>/webhooks/stripe`
- 改了表结构：`pnpm --filter @ai-learn/api db:generate --name <说明>` 生成新迁移并提交

## 写一节新课

在 `packages/content/courses/th/lessons/` 新建 `s<阶段>-<两位序号>.json`，步骤类型：

| type | 用途 | 要点 |
|---|---|---|
| explain | 讲解 | `body` 支持 `**加粗**`、`-` 列表、`1.` 列表 |
| example | 示例 | `bad`（可选）、`prompt`、`output`（提前写好，不实时调用 AI） |
| quiz | 小测验 | `options`、`answer`（从 0 开始） |
| practice | AI 练习 | `task`、`rubric`（点评标准）、`maxChars` |

中文/英文版放在对应语言目录，id 相同；缺了会自动用泰语版。泰文上线前请母语者审校。
