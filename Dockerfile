# Multi-stage build for TMI-UX on Google Cloud Run
# Uses Heroku configuration (environment.heroku.ts)

# Stage 1: Build the Angular application
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Build the application with Heroku configuration
RUN pnpm run build:heroku

# Stage 2: Production server
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create minimal package.json for runtime dependencies only
RUN echo '{"name":"tmi-ux-server","version":"1.0.0","type":"module","dependencies":{"express":"^5.1.0","express-rate-limit":"^8.1.0"}}' > package.json

# Install only runtime dependencies
RUN npm install --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy server file
COPY server.js ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Set environment variable for Cloud Run
ENV PORT=8080
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.js"]
