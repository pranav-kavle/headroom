# Capstone deployment image — Next.js standalone + Prisma migrate-on-start.
#
# Requires next.config.ts to include:  output: 'standalone'
# The entrypoint runs `prisma migrate deploy` BEFORE the server starts — the
# Day 4 rule ("always migrate before deploying new code") encoded in the image.

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /src

# Clerk's publishable key is a NEXT_PUBLIC_* var — Next.js inlines it into the
# client bundle at build time, so it must be present during `next build`, not
# just at runtime. Passed in from the workflow via --build-arg. (It's public by
# design; the secret key is injected at runtime on the Container App instead.)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- runtime stage ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

# Next standalone output + static assets
COPY --from=build /src/.next/standalone ./
COPY --from=build /src/.next/static ./.next/static
COPY --from=build /src/public ./public

# Prisma schema + migrations, and the config file: Prisma 7 reads the migration
# datasource URL from prisma.config.ts (the schema no longer allows a `url`), so
# `migrate deploy` needs the config present at startup.
COPY --from=build /src/prisma ./prisma
COPY --from=build /src/prisma.config.ts ./prisma.config.ts

# Ship the full node_modules for the migrate step. The Prisma 7 CLI loads its
# config through @prisma/config, whose transitive closure (effect, c12, jiti,
# dotenv, …) is large and NOT traced into the Next standalone bundle. Copying
# the whole tree (a superset of standalone's trimmed node_modules) is reliable;
# hand-picking subtrees breaks on the next missing transitive dep.
COPY --from=build /src/node_modules ./node_modules

EXPOSE 3000
# Invoke the Prisma CLI at its real path (not via node_modules/.bin/prisma, whose
# symlink gets dereferenced by COPY into the wrong dir, breaking .wasm resolution)
# so `migrate deploy` finds the .wasm files sitting alongside it in prisma/build/.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
