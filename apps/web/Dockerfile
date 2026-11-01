FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
# NEXT_PUBLIC_* 在构建时写进网页，改了要重新构建
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CONTACT_EMAIL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL
RUN pnpm install --frozen-lockfile --filter @ai-learn/web...
# 课程页在构建时从 packages/content 生成静态 HTML
RUN pnpm --filter @ai-learn/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
USER node
CMD ["node", "apps/web/server.js"]
