# Dev + Prod multi-stage
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .

# Development image
FROM base AS dev
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=1
ENV WATCHPACK_POLLING=true
# Use existing node user or create a simple one
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["pnpm", "dev", "-p", "3000"]

# Production build
FROM base AS build
RUN pnpm build

FROM node:20-alpine AS prod
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
# Use existing node user or create a simple one
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["pnpm", "start", "-p", "3000"]
