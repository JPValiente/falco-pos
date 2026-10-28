# Falco POS: a static app (nuxt generate) served by nginx. There is no Node server: the NUXT_PUBLIC_*
# values are fixed when the image is built (see .env.example), so each environment builds its own.
#   docker build -t falco-pos --build-arg NUXT_PUBLIC_API_BASE=https://api.qa.example/api/v1 --build-arg NUXT_PUBLIC_APP_ENV=qa .
#   docker run -p 3000:3000 falco-pos

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
ARG NUXT_PUBLIC_API_BASE
ARG NUXT_PUBLIC_APP_ENV=production
RUN test -n "$NUXT_PUBLIC_API_BASE" || (echo "NUXT_PUBLIC_API_BASE is required: the POS is static and fixes it when built" && exit 1)
RUN pnpm exec nuxt prepare && pnpm build

FROM nginxinc/nginx-unprivileged:1.27-alpine
# The listening port comes from PORT (the image fills the template when it starts)
ENV PORT=3000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/.output/public /usr/share/nginx/html
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/manifest.webmanifest" || exit 1
