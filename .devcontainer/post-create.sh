#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git config --global --add safe.directory "$PWD"

cd backend

echo "==> Instalando dependencias del backend"
uv sync --locked --all-groups

if [[ ! -s .env ]]; then
  echo "==> Creando backend/.env a partir de .env.example"
  cp .env.example .env
fi

if grep -q '^JWT_SECRET_KEY=$' .env; then
  echo "==> Generando JWT_SECRET_KEY en backend/.env"
  secret="$(uv run python -c 'import secrets; print(secrets.token_urlsafe(48))')"
  sed -i "s/^JWT_SECRET_KEY=$/JWT_SECRET_KEY=${secret}/" .env
fi

echo "==> Instalando hooks de pre-commit"
uv run pre-commit install --install-hooks

echo "==> Aplicando migraciones"
uv run alembic upgrade head

echo "==> Entorno listo. En backend/, ejecuta 'just' para ver los comandos disponibles."
