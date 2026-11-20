# Two targets from one file (docs/deployment.md):
#   dev  -- docker-compose.yml's frontend: the Vite dev server, source
#           bind-mounted.
#   prod -- the static build (npm run build) served by Nginx as a non-root
#           user on port 8080. The reverse proxy in front sends /api/ and
#           /media/ to the backend and everything else here.
# prod is the last stage, so a build without --target gets it.
#
# The build's output is static files, the same on every architecture: Node
# runs on the builder's own platform (no emulation for a multi-platform
# build), and only the Nginx stage is per target platform.

FROM --platform=$BUILDPLATFORM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


FROM deps AS dev

# git lets vite.config.ts read the commit About shows from the repository
# mounted read-only by docker-compose.yml.
RUN apk add --no-cache git

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


FROM deps AS build

# There is no repository in the build context: About's commit and date come
# from these (docker build --build-arg VITE_COMMIT_SHA=$(git rev-parse HEAD)
# --build-arg VITE_COMMIT_DATE=$(git log -1 --format=%cI)). A modified build
# sets VITE_SOURCE_URL to where its own source is offered (AGPL section 13).
ARG VITE_COMMIT_SHA=""
ARG VITE_COMMIT_DATE=""
ARG VITE_SOURCE_URL=""
ENV VITE_COMMIT_SHA=${VITE_COMMIT_SHA} \
    VITE_COMMIT_DATE=${VITE_COMMIT_DATE} \
    VITE_SOURCE_URL=${VITE_SOURCE_URL}

COPY . .
RUN npm run build
# Compressed once here, not on every request: a whole room downloads these at
# the same moment (gzip_static, nginx.conf).
RUN find dist/assets -type f \( -name '*.js' -o -name '*.css' \) -exec gzip -9 -k {} +


FROM nginxinc/nginx-unprivileged:1.30-alpine AS prod

# The base image is rebuilt upstream on its own schedule: take the fixes
# published since, at every build. Alpine's come with a plain upgrade. Nginx's
# don't: the base image installs it from nginx.org's stable repository, pins
# that exact version and doesn't keep the repository configured (its signing
# key stays in /etc/apk/keys). So the Nginx packages are upgraded from that
# repository alone, never from Alpine's own nginx, which is another build. The
# configuration the base image adapted to run unprivileged is kept (apk leaves
# the new defaults beside it as .apk-new, removed here). That repository
# follows the stable branch, so the build stops if the upgrade leaves 1.30:
# move the FROM tag and this check together. The image runs as uid 101.
USER root
RUN apk upgrade --no-cache \
 && apk add --no-cache --upgrade --repositories-file /dev/null \
      -X "https://nginx.org/packages/alpine/v$(cut -d. -f1,2 /etc/alpine-release)/main" \
      $(sed -n 's/^\(nginx[a-z-]*\)=.*/\1/p' /etc/apk/world) \
 && find /etc/nginx -name '*.apk-new' -delete \
 && nginx -v 2>&1 | grep -q 'nginx/1\.30\.'
USER 101

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/healthz"]
