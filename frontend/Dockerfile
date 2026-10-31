# syntax=docker/dockerfile:1

FROM node:26-bookworm-slim AS build

WORKDIR /app

# Dependencies before the code: editing the app does not invalidate this layer.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    npm ci

COPY . .

# Vite inlines VITE_* variables at build time: they are not runtime settings.
ARG VITE_ENABLE_LAB=false
ENV VITE_ENABLE_LAB=${VITE_ENABLE_LAB}

RUN npm run build


# Static files only: nginx serves the build and proxies the API on the same origin.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/"]
