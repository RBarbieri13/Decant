# ============================================================
# Decant - Multi-stage Docker Build
# ============================================================

# ============================================================
# Stage 1: Builder
# Install dependencies and build the application
# ============================================================
FROM node:20-alpine AS builder

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ sqlite-dev

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY tsconfig.json tsconfig.server.json vite.config.ts ./
COPY index.html ./
COPY src/ ./src/

# Build the application
# This builds both client (vite) and server (tsc)
RUN npm run build

# Prune devDependencies after build
RUN npm prune --production

# ============================================================
# Stage 2: Production
# Minimal runtime image with only production dependencies
# ============================================================
FROM node:20-alpine AS production

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache sqlite-libs

# Create non-root user for security
RUN addgroup -g 1001 -S decant && \
    adduser -u 1001 -S decant -G decant

WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create data directory with proper permissions
RUN mkdir -p /data && chown -R decant:decant /data

# Switch to non-root user
USER decant

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/decant.db

# Expose the application port
EXPOSE 3000

# Health check (Node has built-in fetch)
# Check the readiness endpoint which verifies database connectivity
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start the server
CMD ["node", "dist/server.js"]
