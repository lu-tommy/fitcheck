# Build once, run small. The standalone output carries only the server and the
# dependencies actually reached, so the final image has no node_modules tree and
# no build toolchain in it.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Wardrobes live here; docker-compose mounts a volume over it.
ENV OUTFITAI_DATA_DIR=/data

RUN addgroup -g 1001 -S outfitai && adduser -u 1001 -S outfitai -G outfitai
COPY --from=build /app/public ./public
COPY --from=build --chown=outfitai:outfitai /app/.next/standalone ./
COPY --from=build --chown=outfitai:outfitai /app/.next/static ./.next/static
RUN mkdir -p /data && chown outfitai:outfitai /data

USER outfitai
EXPOSE 3000
CMD ["node", "server.js"]
