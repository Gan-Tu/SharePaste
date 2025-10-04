## Multi-stage Dockerfile for Next.js on Cloud Run (standalone output)

FROM node:20-alpine AS deps
WORKDIR /app
ENV CI=1
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci
COPY . .
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOST=0.0.0.0 \
    PORT=8080
# Create non-root user
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Copy Next.js standalone server and static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
