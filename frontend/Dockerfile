FROM node:24-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# .npmrc を install より前に置き、Takumi Guard（npm.flatt.tech）経由で依存を取得する
COPY package.json pnpm-lock.yaml* .npmrc ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY . .

EXPOSE 5173

CMD ["pnpm", "dev"]
