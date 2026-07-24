# apps/web — Next.js
#
# 為什麼用 Dockerfile 而不是讓平台自動偵測：
# 這是 pnpm workspace monorepo，且 workspace 套件以 TS 原始碼發佈
# （沒有 build step）。自動偵測的建置器通常只安裝該 app 自己的 package.json，
# 會漏掉 packages/*，在 build 階段才炸。明確寫出來比較可靠。
#
# build context 必須是 **repo 根目錄**，不是 apps/web。

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# ── 依賴 ────────────────────────────────────────────────
# 先只複製 manifest，讓 Docker layer cache 在原始碼變動時仍能命中
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json                 apps/web/
COPY apps/worker/package.json              apps/worker/
COPY packages/shared-types/package.json    packages/shared-types/
COPY packages/validation/package.json      packages/validation/
COPY packages/db/package.json              packages/db/
COPY packages/storage/package.json         packages/storage/
COPY packages/analytics/package.json       packages/analytics/
COPY packages/theme-engine/package.json    packages/theme-engine/
COPY packages/widget-engine/package.json   packages/widget-engine/
COPY packages/daily-engine/package.json    packages/daily-engine/
COPY packages/ai-core/package.json         packages/ai-core/
COPY packages/provider-core/package.json   packages/provider-core/
RUN pnpm install --frozen-lockfile

# ── 建置 ────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .

# NEXT_PUBLIC_* 會在 build 時被 inline 進 client bundle，
# 因此必須在這個階段就存在 —— 平台的 build-time 變數要設好。
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @snowrealm/web build

# ── 執行 ────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

COPY --from=build /app ./

EXPOSE 8080

# /api/health 會回報 database / storage / queue 三者的連線狀態
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "--filter", "@snowrealm/web", "start"]
