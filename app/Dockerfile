FROM oven/bun:1
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN bun run build

# Expose port
EXPOSE 9999

# Environment variables
ENV PORT=9999
ENV NODE_ENV=production

# Start
CMD ["bun", "run", "start"]
