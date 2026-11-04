FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --no-audit --no-fund
COPY . .
ARG INKSPECT_API_ORIGIN=http://api:3003
ENV INKSPECT_API_ORIGIN=$INKSPECT_API_ORIGIN NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3002
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
CMD ["node","server.js"]
