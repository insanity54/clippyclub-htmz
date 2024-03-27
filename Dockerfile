FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable
COPY package.json .
COPY pnpm-lock.yaml .
RUN pnpm install --frozen-lockfile
COPY . .



FROM base AS release
ENTRYPOINT ["pnpm"]
CMD ["start"]