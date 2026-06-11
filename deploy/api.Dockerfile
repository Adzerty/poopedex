FROM node:22-alpine

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.3.0 --activate

# Installe les deps en cachant la couche tant que les manifests ne changent pas
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Source
COPY packages/shared ./packages/shared
COPY api ./api

ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/api
CMD ["pnpm", "start"]
