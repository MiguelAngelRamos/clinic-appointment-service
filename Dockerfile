# ============================================================
#  clinic-appointment-service — Dockerfile multi-stage
# ============================================================

FROM node:22.11.0-alpine3.20 AS deps
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@10.33.0
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store-appt,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM node:22.11.0-alpine3.20 AS builder
RUN npm install -g pnpm@10.33.0
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
RUN --mount=type=cache,id=pnpm-store-appt,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

FROM node:22.11.0-alpine3.20 AS runner
RUN apk add --no-cache dumb-init libc6-compat
WORKDIR /app
USER node
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
ENV NODE_ENV=production
ENV PORT=3005
ENV HOME=/app
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3005/appointments/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
