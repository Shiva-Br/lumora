# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1

RUN npm install --global pnpm@10
WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    HUSKY=0 pnpm install --frozen-lockfile

FROM base AS builder

# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so
# the identity provider must be chosen here, not at runtime.
ARG NEXT_PUBLIC_AUTH_MODE=local
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

ENV NEXT_PUBLIC_AUTH_MODE=${NEXT_PUBLIC_AUTH_MODE} \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Supabase configuration is required only when Supabase is the live provider;
# the local pilot never contacts it.
RUN if [ "$NEXT_PUBLIC_AUTH_MODE" = "supabase" ]; then \
      test -n "$NEXT_PUBLIC_SUPABASE_URL" \
      && test -n "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"; \
    fi \
    && pnpm build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENTRYPOINT ["node", "server.js"]
