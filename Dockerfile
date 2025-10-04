# Multi-stage build for TMI-UX on Google Cloud Run
# Uses hosted-container configuration (environment.hosted-container.ts)

# Stage 1: Build the Angular application
FROM cgr.dev/chainguard/node:latest-dev AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (pnpm is pre-installed in the -dev image)
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Build the application with hosted-container configuration
RUN pnpm run build:hosted-container

# Stage 2: Production server
FROM cgr.dev/chainguard/node:latest

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

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Set environment variable for Cloud Run
ENV PORT=8080
ENV NODE_ENV=production

# Start the server (entrypoint is already set to /usr/bin/node in base image)
CMD ["server.js"]
