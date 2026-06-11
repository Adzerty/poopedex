FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.3.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY web ./web

# Injecté par docker-compose : ex. https://api.poopedex.tld
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter @poopedex/web build

# Image finale minuscule : juste le dist pour copie dans le volume
FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/web/dist ./web/dist
CMD ["sh", "-c", "cp -r /app/web/dist/. /out/"]
