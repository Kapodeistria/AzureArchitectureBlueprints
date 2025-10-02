FROM node:20-slim

# Install dependencies for building native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the entire project (for CLI and agent code)
COPY package*.json ./
COPY src/ ./src/
COPY config/ ./config/
COPY foundry-agents/ ./foundry-agents/
COPY waf-knowledge-base/ ./waf-knowledge-base/

# Copy worker code
COPY worker/package*.json ./worker/
COPY worker/src/ ./worker/src/

# Install all dependencies (including CLI dependencies)
RUN npm install --omit=dev

# Install tsx globally for running TypeScript CLI
RUN npm install -g tsx

# Install worker dependencies
WORKDIR /app/worker
RUN npm install --omit=dev

# Back to root
WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Run the worker
CMD ["node", "/app/worker/src/worker.js"]
