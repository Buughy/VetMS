# Multi-stage build: web -> api -> runtime

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.base.json schema.sql ./
COPY apps ./apps
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/schema.sql ./schema.sql
COPY --from=build /app/node_modules ./node_modules
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
