# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY packages/domain/package.json ./packages/domain/
COPY packages/application/package.json ./packages/application/
COPY packages/infrastructure/package.json ./packages/infrastructure/
COPY packages/config/package.json ./packages/config/
COPY apps/api/package.json ./apps/api/

# Set HUSKY=0 to skip husky install during pnpm install
ENV HUSKY=0

# Install dependencies WITHOUT cache mount (Alpine needs postinstall for esbuild)
RUN pnpm install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=deps /app/packages/application/node_modules ./packages/application/node_modules
COPY --from=deps /app/packages/infrastructure/node_modules ./packages/infrastructure/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy workspace config files
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/turbo.json ./turbo.json

# Copy source code
COPY packages/domain ./packages/domain
COPY packages/application ./packages/application
COPY packages/infrastructure ./packages/infrastructure
COPY packages/config ./packages/config
COPY apps/api ./apps/api

# Copy TypeScript configs from tooling
COPY tooling/typescript ./tooling/typescript

# Build and bundle
RUN pnpm exec turbo run build --filter=@workspace/api && \
    pnpm --filter=@workspace/api run bundle

# Prune the workspace for production
FROM base AS pruner
WORKDIR /app
COPY --from=builder /app ./
RUN pnpm exec turbo prune --scope=@workspace/api --docker

# Production image
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 apiuser

# Copy pruned workspace files
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install production dependencies and ignore scripts
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy built application
# Copy bundled application and sourcemap
COPY --from=builder /app/apps/api/dist/index.js ./apps/api/dist/index.js
COPY --from=builder /app/apps/api/dist/index.js.map ./apps/api/dist/index.js.map

# Set correct permissions
RUN chown -R apiuser:nodejs /app

# Switch to non-root user
USER apiuser

# Railway utilise PORT comme variable d'environnement
ENV PORT=3000
EXPOSE $PORT

# Start the application
CMD ["node", "apps/api/dist/index.js"]
