FROM mcr.microsoft.com/devcontainers/python:3-3.14-bookworm

USER root

# uv
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /uvx /usr/local/bin/

# Just
ARG JUST_VERSION=1.58.0
ARG POSTGRES_CLIENT_VERSION=18

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
         https://www.postgresql.org/media/keys/ACCC4CF8.asc \
         -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && . /etc/os-release \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
         > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends "postgresql-client-${POSTGRES_CLIENT_VERSION}" \
    && curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
         https://just.systems/install.sh -o /tmp/install-just.sh \
    && bash /tmp/install-just.sh --to /usr/local/bin --tag "${JUST_VERSION}" \
    && rm /tmp/install-just.sh \
    && rm -rf /var/lib/apt/lists/* \
    && python --version \
    && uv --version \
    && psql --version \
    && just --version

USER vscode
