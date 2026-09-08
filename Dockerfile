# Multi-stage: the toolchain and devDependencies never reach the image that
# runs. The final stage carries production node_modules, the compiled dist and
# the .sql migration files, nothing else.

# ------------------------------------------------------------------ deps stage
FROM node:22-alpine AS deps
WORKDIR /app
# Copied on their own so this layer is only invalidated by a dependency change,
# not by a source edit.
COPY package.json package-lock.json ./
RUN npm ci

# ----------------------------------------------------------------- build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm run build
# tsc only emits .js, so the migration SQL has to be carried over by hand.
RUN cp -r src/db/migrations dist/db/migrations

# ------------------------------------------------------------------- run stage
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# --omit=dev drops typescript, tsx and the type packages.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# node:alpine ships an unprivileged `node` user; running as root would give a
# process that only needs to read its own files the run of the container.
USER node

EXPOSE 4000

# No shell form, so node is PID 1 and receives SIGTERM directly — which is
# what the graceful shutdown in index.ts depends on.
CMD ["node", "dist/index.js"]

# Compose owns the readiness gate for the API, but an image run on its own
# should still report its own health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
