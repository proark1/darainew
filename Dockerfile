FROM oven/bun:1.3.14-alpine AS build

WORKDIR /app

COPY package.json bun.lock .bun-version ./
RUN bun install --frozen-lockfile

COPY index.html vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js components.json capacitor.config.ts ./
COPY public ./public
COPY src ./src

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_ALLOW_PLACEHOLDER_CLIENT_ENV

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_ALLOW_PLACEHOLDER_CLIENT_ENV=$VITE_ALLOW_PLACEHOLDER_CLIENT_ENV

RUN bun run build

FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 8080
