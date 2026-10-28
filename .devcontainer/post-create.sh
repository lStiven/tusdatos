#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git config --global --add safe.directory "$PWD"

echo "==> Instalando dependencias del proyecto"
uv sync --locked --all-groups

if [[ ! -s .env && -f .env.example ]]; then
  echo "==> Creando .env a partir de .env.example"
  cp .env.example .env
fi

if grep -q '^JWT_SECRET_KEY=$' .env; then
  echo "==> Generando JWT_SECRET_KEY en .env"
  secret="$(uv run python -c 'import secrets; print(secrets.token_urlsafe(48))')"
  sed -i "s/^JWT_SECRET_KEY=$/JWT_SECRET_KEY=${secret}/" .env
fi

if [[ -s .pre-commit-config.yaml ]]; then
  echo "==> Instalando hooks de pre-commit"
  uv run pre-commit install --install-hooks
fi

if [[ -s alembic.ini && -f migrations/env.py ]]; then
  echo "==> Aplicando migraciones"
  uv run alembic upgrade head
fi

echo "==> Entorno listo. Ejecuta 'just' para ver los comandos disponibles."
