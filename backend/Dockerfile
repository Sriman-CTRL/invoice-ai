# Multi-stage production build for Node.js / Express backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies including devDependencies for TypeScript compilation
RUN npm ci

# Generate Prisma client and compile TypeScript to dist/
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ── Production Runtime Image ──────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy package descriptors and install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npx prisma generate

# Copy compiled JavaScript output
COPY --from=builder /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/server.js"]
