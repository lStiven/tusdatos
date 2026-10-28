set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

# Mostrar comandos disponibles
default:
    @just --list

# Instalar dependencias
install:
    uv sync --locked

add packages:
    uv add {{ packages }}

# Ejecutar FastAPI
dev:
    uv run uvicorn app.main:app --reload --host 0.0.0.0

# Aplicar migraciones pendientes
migrate:
    uv run alembic upgrade head

# Crear migración desde los modelos: just migration "add events table"
migration message:
    uv run alembic revision --autogenerate -m "{{ message }}"
    uv run ruff check --fix --quiet migrations
    uv run ruff format --quiet migrations

# Revertir migraciones (por defecto la última): just downgrade base
downgrade revision="-1":
    uv run alembic downgrade {{ revision }}

# Ver revisión aplicada y fallar si hay cambios de modelos sin migración
migration-status:
    uv run alembic current
    uv run alembic check

# Crear un administrador; pide la contraseña (o la lee de ADMIN_PASSWORD): just create-admin admin@example.com "Ana Admin"
create-admin email full_name:
    uv run python -m app.modules.auth.cli create-admin --email "{{ email }}" --full-name "{{ full_name }}"

# Formatear código y organizar imports
format:
    uv run ruff check --fix .
    uv run ruff format .

# Validar formato e imports
lint:
    uv run ruff check .
    uv run ruff format --check .

# Validar tipos y deprecaciones estáticas
types:
    uv run pyright

# Ejecutar pruebas (exit 5 = no se recolectaron tests, se acepta mientras no existan)
test:
    uv run pytest || [ $? -eq 5 ]

# Comprobar archivo de dependencias
lock:
    uv lock --check

# Validaciones sin modificar archivos
check: lint types lock

# Preparar código antes de un commit
prepare: format check test
