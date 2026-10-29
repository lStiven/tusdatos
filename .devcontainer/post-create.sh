#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git config --global --add safe.directory "$PWD"

cd backend
if [[ ! -s .env ]]; then
    echo "[ERROR] backend/.env no existe"
    exit 1
fi
echo "==> Instalando dependencias del backend"
uv sync --locked --all-groups

echo "==> Instalando hooks de pre-commit"
uv run pre-commit install --install-hooks

echo "==> Aplicando migraciones"
uv run alembic upgrade head

echo "==> Entorno listo."
