# apps/worker — pg-boss 背景工作
#
# ADR-002 / ADR-008：worker 是**長駐服務**，不是 serverless function。
# 影片轉碼與 Vision 分析會超過 serverless 的時間上限。
#
# 用 tsx 直接跑 TS 原始碼而非先 tsc：
# workspace 套件以 TS 原始碼發佈（package.json 的 main 指向 .ts），
# tsc 的產物在執行時解析不到那些模組（會噴 ERR_MODULE_NOT_FOUND）。
# 長駐服務只在啟動時編譯一次，成本可忽略。
#
# build context 必須是 **repo 根目錄**，不是 apps/worker。

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# sharp 的預編譯二進位需要這些；缺了會在執行時才失敗
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

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
RUN pnpm install --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker

# worker 沒有對外 port。存活狀態靠 job_records 與 pg-boss 的 monitor 觀察，
# 見 08-jobs-events.md §2.5 的 queue-health 檢查。
CMD ["pnpm", "--filter", "@snowrealm/worker", "start"]
