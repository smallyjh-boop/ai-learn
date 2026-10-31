FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @ai-learn/api...
RUN pnpm --filter @ai-learn/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/drizzle ./drizzle
COPY --from=build /repo/packages/content/courses ./courses
ENV CONTENT_DIR=/app/courses
EXPOSE 4000
CMD ["node", "dist/server.js"]
