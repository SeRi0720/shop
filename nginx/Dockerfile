# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.22.1-trixie-slim
ARG WAF_IMAGE=owasp/modsecurity-crs:4.25.2-nginx-alpine-202610180210-lts@sha256:57fd215e2894638a02d235f88510fa2a129d64740f0edb6798ca0e4aa2f02457

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV NODE_OPTIONS=--max-old-space-size=768
RUN npm run build

FROM ${WAF_IMAGE} AS runtime
USER root

RUN rm -f /etc/nginx/templates/conf.d/default.conf.template \
          /etc/nginx/templates/conf.d/logging.conf.template \
          /etc/nginx/templates/conf.d/modsecurity.conf.template \
 && echo '# stub: entrypoint 93/96 của image sed file này' > /etc/nginx/templates/conf.d/default.conf.template \
 && mkdir -p /var/log/modsec && chown nginx:nginx /var/log/modsec
COPY nginx/nginx.conf /etc/nginx/templates/nginx.conf.template
COPY nginx/conf.d/shop.conf /etc/nginx/templates/conf.d/shop.conf.template
COPY nginx/snippets/ /etc/nginx/snippets/
COPY --chown=nginx:nginx nginx/modsec/ /opt/owasp-crs/rules/
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080