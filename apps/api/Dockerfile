FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @ai-learn/api...
RUN pnpm --filter @ai-learn/api build
# 生成只含运行时依赖的独立目录（pnpm 的 node_modules 是软链接，不能直接复制）
RUN pnpm --filter @ai-learn/api deploy --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
COPY --from=build /repo/packages/content/courses ./courses
ENV CONTENT_DIR=/app/courses
ENV MIGRATIONS_DIR=/app/drizzle
EXPOSE 4000
USER node
CMD ["node", "dist/server.js"]
