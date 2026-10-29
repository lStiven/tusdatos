# Backend · Mis Eventos API

API REST de Mis Eventos: FastAPI, SQLModel y PostgreSQL 18, con Python 3.14 gestionado con uv. El contexto del producto y del repositorio está en el [README principal](../README.md).

Hay dos formas de ejecutarlo, y son independientes: cada una tiene su propia base de datos.

| Forma | Para qué | Requisitos |
|---|---|---|
| [A. Docker Compose](#a-levantar-con-docker-compose) | Levantar la API y probarla tal como queda en la imagen | Docker con Compose v2 |
| [B. Dev Container](#b-desarrollar-en-el-dev-container) | Desarrollar: recarga automática, tests, migraciones nuevas | Docker y VS Code con la extensión Dev Containers |

## Configuración

Toda la configuración llega por variables de entorno. En local se escriben en `backend/.env`, que git ignora, a partir de [`.env.example`](.env.example).

| Variable | Por defecto | Qué hace |
|---|---|---|
| `JWT_SECRET_KEY` | (obligatoria) | Firma de los tokens de acceso. Cadena aleatoria de 32 caracteres o más: sin ella la API no arranca |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `mis_eventos` | Credenciales y base de datos de la aplicación |
| `POSTGRES_TEST_DB` | `mis_eventos_test` | Base de datos de los tests de integración y concurrencia. Se recrea en cada ejecución |
| `POSTGRES_HOST`, `POSTGRES_PORT` | `postgres`, `5432` | Dónde está PostgreSQL. `postgres` es el nombre del servicio en los dos compose |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Vida de un token de acceso |
| `CORS_ORIGINS` | `[]` | Orígenes del navegador permitidos, como lista JSON: `["http://localhost:5173"]`. Vacío por defecto: CORS cerrado |

PostgreSQL usa las credenciales solo al crear su volumen la primera vez. Para cambiarlas después, hay que borrar el volumen: con la opción A, `docker compose down -v`.

## A. Levantar con Docker Compose

Desde la raíz del repositorio:

```bash
cp -n backend/.env.example backend/.env   # -n: no pisa un .env que ya exista
# Edita backend/.env y pon en JWT_SECRET_KEY una cadena aleatoria de 32+ caracteres,
# por ejemplo la salida de: openssl rand -hex 32

docker compose up --build -d
docker compose ps
```

En `docker compose ps`, `api` debe aparecer como `healthy`; la primera vez tarda unos segundos más. Compose arranca los servicios en orden:

1. `postgres` arranca y crea las dos bases de datos.
2. `migrate` aplica las migraciones (`alembic upgrade head`) y termina.
3. `api` arranca cuando `migrate` terminó bien, y queda en http://localhost:8000.

Si el puerto 8000 está ocupado, usa otro: `API_PORT=8001 docker compose up --build -d`.

Crea el primer administrador. Pide la contraseña dos veces, de 8 caracteres como mínimo:

```bash
docker compose exec api python -m app.modules.auth.cli create-admin --email admin@example.com --full-name "Admin"
```

Sigue en [Primera prueba](#primera-prueba).

| Comando | Qué hace |
|---|---|
| `docker compose logs -f api` | Ver los logs de la API |
| `docker compose run --rm --build tests` | Ejecutar todos los tests con su reporte de cobertura, contra el PostgreSQL del stack ([Tests](#tests)) |
| `docker compose down` | Parar todo y conservar los datos |
| `docker compose down -v` | Parar todo y borrar la base de datos |
| `docker compose up --build -d` | Reconstruir tras cambiar el código: la imagen contiene el código, no lo monta |

## B. Desarrollar en el Dev Container

1. Abre el repositorio en VS Code y ejecuta **Dev Containers: Reopen in Container**.
2. Al crearse el contenedor, [`.devcontainer/post-create.sh`](../.devcontainer/post-create.sh):
   - instala las dependencias con `uv sync --locked --all-groups`;
   - crea `backend/.env` desde el ejemplo, con un `JWT_SECRET_KEY` generado;
   - instala los hooks de pre-commit;
   - aplica las migraciones.
3. La terminal se abre en `backend/`. Crea el administrador y arranca la API con recarga automática:

```bash
just create-admin admin@example.com "Admin"   # pide la contraseña
just dev                                      # http://localhost:8000
```

Si la opción A ya ocupa el puerto 8000, VS Code reenvía otro y lo muestra en el panel **Ports**.

| Comando | Qué hace |
|---|---|
| `just` | Lista todos los comandos |
| `just test` | Todos los tests |
| `just coverage` | Tests con reporte de cobertura: resumen en consola y detalle en `backend/htmlcov/index.html` |
| `just prepare` | Formato, lint, tipos, lock y tests con cobertura. Se ejecuta antes de dar una tarea por terminada |
| `just migration "mensaje"` / `just migrate` | Generar una migración desde los modelos, que se revisa a mano (docs/04 §10), y aplicarla |

## Primera prueba

1. Abre http://localhost:8000/docs, pulsa **Authorize** y entra con el email del administrador como `username`.
2. Ejecuta `GET /api/v1/users/me`: debe devolver los roles `ATTENDEE` y `ADMIN`.
3. Recorre el flujo principal:

| Paso | Quién | Endpoint |
|---|---|---|
| 1. Crear cuentas para un organizador y dos asistentes | cada cuenta | `POST /api/v1/auth/register` |
| 2. Dar el rol de organizador | admin | `PUT /api/v1/users/{id}/roles/ORGANIZER` |
| 3. Crear una sede y una sala | admin | `POST /api/v1/venues` y `POST /api/v1/venues/{id}/rooms` |
| 4. Crear un evento con `capacity: 1` y publicarlo | organizador | `POST /api/v1/events` y `POST /api/v1/events/{id}/publish` |
| 5. Crear una charla en la sala y programarla | organizador | `POST /api/v1/events/{id}/sessions` y `POST /api/v1/sessions/{id}/schedule` |
| 6. Inscribir a los dos asistentes: el primero queda `CONFIRMED` y el segundo `WAITLISTED` | cada asistente | `POST /api/v1/events/{id}/registrations` |
| 7. Marcar interés en la charla con el confirmado. El de la lista de espera recibe 409 `registration_not_confirmed` | cada asistente | `PUT /api/v1/sessions/{id}/interest` |
| 8. Cancelar la inscripción del confirmado: el de la lista de espera pasa a `CONFIRMED` | asistente confirmado | `POST /api/v1/events/{id}/registrations/me/cancel` |
| 9. Ver la ocupación | organizador | `GET /api/v1/events/{id}/occupancy` |

Las cuentas creadas con `POST /api/v1/auth/register` solo reciben `ATTENDEE`. `create-admin` es la única forma de crear un administrador sin que exista otro.

## Tests

| Tipo | Carpeta | Qué prueban | Base de datos |
|---|---|---|---|
| Unitarios | `tests/unit/` (refleja `app/`) | Servicios, routers, validaciones y documentación OpenAPI, con fakes | Ninguna |
| Integración | `tests/integration/` | Repositorios, restricciones, migraciones y flujos HTTP completos | `POSTGRES_TEST_DB`, cada test en una transacción que se revierte |
| Concurrencia | `tests/concurrency/` | Sobrecupo, lista de espera, salas y ponentes bajo peticiones simultáneas (docs/03) | `POSTGRES_TEST_DB`, con commits reales y varios hilos |

Para ejecutarlos:
- **Con la opción A:** `docker compose run --rm --build tests`.
- **En el Dev Container:** `just test`, o `just coverage` para el reporte.

**Cobertura:** el reporte mide líneas y ramas de `app/` con la suite completa, y falla por debajo del 90 %. Hoy da 97,6 %. Si se ejecutan solo los unitarios, los `repository.py` quedan bajos, y es a propósito: se prueban contra PostgreSQL real en los tests de integración, porque simular SQL con mocks solo prueba el mock.

## Estructura

```text
backend/
├── app/
│   ├── main.py               # Arranque: routers, OpenAPI, manejo de errores
│   ├── core/                 # Configuración, base de datos, seguridad (Argon2id, JWT)
│   ├── modules/<dominio>/    # auth, users, venues, speakers, events, registrations, sessions, health
│   │                         #   router.py → service.py (reglas) → repository.py (SQL) · models.py · schemas.py · exceptions.py
│   └── shared/               # Errores, paginación y utilidades comunes
├── migrations/               # Alembic
├── tests/                    # unit · integration · concurrency
├── Dockerfile                # Etapas runtime (imagen de la API) y test
├── justfile                  # Comandos del Dev Container
└── pyproject.toml / uv.lock  # Dependencias y configuración de ruff, pyright, pytest y coverage
```

## Documentación de la API

La API en marcha publica su contrato: [`/docs`](http://localhost:8000/docs) (Swagger), [`/redoc`](http://localhost:8000/redoc) y [`/openapi.json`](http://localhost:8000/openapi.json). Cada endpoint documenta sus reglas, sus permisos y cada error que puede devolver, con su `code`. La portada de `/docs` explica la autenticación, el formato de los errores y la paginación.

Por qué está diseñado así: [docs/](../docs/), del 01 al 04.
