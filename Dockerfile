# syntax=docker/dockerfile:1
# TekJobs in one container, for a machine that stays on (a NAS, a home server, a small VPS). It ships what the npm
# package ships: the CLI, the scraper, the server and the built app. deploy/docker has the compose file that puts it
# on your Tailscale network, and docs/docker explains the rest.
#
#   docker build -t tekjobs .
#
# The profile folder is mounted at /vault. The server answers only on 127.0.0.1 inside the container; the Tailscale
# container it shares a network with is the one way in (deploy/docker/docker-compose.yml).

# The app bundle is the same on every platform, so it builds once, natively, even when the image is for arm64.
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS app
WORKDIR /src
COPY app/package.json app/package-lock.json app/
RUN npm ci --ignore-scripts --prefix app
COPY . .
RUN npm run build --prefix app

FROM node:22-bookworm-slim
# The CLI that writes cover letters and tailored resumes and reads mail and calendar. Signed in at run time with
# CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY; without either, those features say so and everything else works.
ARG CLAUDE_CODE_VERSION=latest
RUN apt-get update  && apt-get install -y --no-install-recommends ca-certificates tzdata  && rm -rf /var/lib/apt/lists/*  && npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"  && npm cache clean --force

WORKDIR /app
# Runtime dependencies (pdf-parse and its native canvas) install for the image's own platform.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev && npm cache clean --force
COPY cli.mjs run.mjs run.sh README.md LICENSE ./
COPY scraper scraper
COPY app/server app/server
COPY samples/vault samples/vault
COPY deploy/docker/start.mjs deploy/docker/start.mjs
COPY --from=app /src/app/dist app/dist
RUN chmod +x cli.mjs  && ln -s /app/cli.mjs /usr/local/bin/tekjobs  && mkdir -p /vault /app/data /home/node/.tekjobs /home/node/.claude  && chown node:node /vault /app/data /home/node/.tekjobs /home/node/.claude

USER node
ENV NODE_ENV=production \
    TEKJOBS_PROFILE=/vault \
    PORT=8787 \
    TZ=UTC \
    TEKJOBS_SCAN_TIME=07:30 \
    TEKJOBS_DAILY=scan

HEALTHCHECK --interval=1m --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "/app/deploy/docker/start.mjs"]
