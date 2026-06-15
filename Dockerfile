# ─────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# ─────────────────────────────────────────────
# Stage 2: Runtime image
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache poppler-utils

COPY --from=deps /app/node_modules ./node_modules
COPY index.js ./
COPY VERSION ./
COPY src/ ./src/

RUN mkdir -p /app/qr

ENV NODE_ENV=production
ENV BOT_NAME=BotGenZ
ENV RATE_LIMIT_PER_MINUTE=10

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD pgrep -f "node index.js" || exit 1

CMD ["node", "index.js"]
