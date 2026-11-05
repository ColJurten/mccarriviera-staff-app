FROM node:22.21.1-bookworm-slim
RUN npm install --global pnpm@12.16.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @mccarriviera/api...
COPY api api
COPY packages/shared packages/shared
# pnpm may create checkout manifests as mode 600. Normalize copied source
# and configuration so the unprivileged runtime can read them.
RUN chmod -R a+rX /app
USER node
EXPOSE 3001
CMD ["pnpm", "--filter", "@mccarriviera/api", "start"]
