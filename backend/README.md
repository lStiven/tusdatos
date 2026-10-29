# Backend · Mis Eventos API

API REST de Mis Eventos: FastAPI, SQLModel y PostgreSQL 18, con Python 3.14 gestionado con uv. El contexto del producto y del repositorio está en el [README principal](../README.md).

Hay dos formas de ejecutarlo, y son independientes: cada una tiene su propia base de datos.

| Forma | Para qué | Requisitos |
|---|---|---|
| [A. Docker Compose](#a-levantar-con-docker-compose) | Levantar la API y probarla tal como queda en la imagen | Docker con Compose v2 y `python3` (solo para generar `.env`) |
| [B. Dev Container](#b-desarrollar-en-el-dev-container) | Desarrollar: recarga automática, tests, migraciones nuevas | Docker, VS Code con la extensión Dev Containers y `python3` (solo para generar `.env`) |

## Configuración

Toda la configuración llega por variables de entorno. En local se escriben en `backend/.env`, que git ignora, a partir de [`.env.example`](.env.example).

| Variable | Por defecto | Qué hace |
|---|---|---|
| `JWT_SECRET_KEY` | (obligatoria) | Firma de los tokens de acceso. Cadena aleatoria de 32 caracteres o más: sin ella no arrancan ni la API ni las migraciones |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `mis_eventos` | Credenciales y base de datos de la aplicación |
| `POSTGRES_TEST_DB` | `mis_eventos_test` | Base de datos de los tests de integración y concurrencia. Se recrea en cada ejecución |
| `POSTGRES_HOST`, `POSTGRES_PORT` | `postgres`, `5432` | Dónde está PostgreSQL. `postgres` es el nombre del servicio en los dos compose |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Vida de un token de acceso |
| `CORS_ORIGINS` | `[]` | Orígenes del navegador permitidos, como lista JSON: `["http://localhost:5173"]`. Vacío por defecto: CORS cerrado |

PostgreSQL usa las credenciales solo al crear su volumen la primera vez. Para cambiarlas después, hay que borrar el volumen: con la opción A, `docker compose down -v`.

## A. Levantar con Docker Compose

Desde la raíz del repositorio:

```bash
python3 scripts/bootstrap_env.py   # crea backend/.env desde el ejemplo y genera JWT_SECRET_KEY
docker compose up --build -d
docker compose ps
```

`bootstrap_env.py` no pisa un `.env` que ya exista: solo rellena `JWT_SECRET_KEY` si está vacío.

En `docker compose ps`, `api` debe aparecer como `healthy`; la primera vez tarda unos segundos más. Compose arranca los servicios en orden:

1. `postgres` arranca y crea las dos bases de datos.
2. `migrate` aplica las migraciones (`alembic upgrade head`) y termina.
3. `api` arranca cuando `migrate` terminó bien, y queda en http://localhost:8000.

Si `up` termina con `service "migrate" didn't complete successfully: exit 1`, Compose no muestra el motivo: está en `docker compose logs migrate`. Lo habitual es un `JWT_SECRET_KEY` vacío o de menos de 32 caracteres en `backend/.env` (`ValidationError … jwt_secret_key`). Ejecuta `python3 scripts/bootstrap_env.py` y repite `docker compose up --build -d`.

Si el puerto 8000 está ocupado, usa otro: `API_PORT=8001 docker compose up --build -d`.

Crea el primer administrador. Pide la contraseña dos veces, de 8 caracteres como mínimo:

```bash
docker compose exec api python -m app.modules.auth.cli create-admin --email admin@example.com --full-name "Admin"
```

Sigue en [Primera prueba](#primera-prueba) o, si prefieres datos ya cargados, en [Datos de demo](#datos-de-demo-opcional).

| Comando | Qué hace |
|---|---|
| `docker compose exec api python -m app.modules.demo.cli seed` | Cargar los [datos de demo](#datos-de-demo-opcional) (opcional) |
| `docker compose logs -f api` | Ver los logs de la API |
| `docker compose run --rm --build tests` | Ejecutar todos los tests con su reporte de cobertura, contra el PostgreSQL del stack ([Tests](#tests)) |
| `docker compose down` | Parar todo y conservar los datos |
| `docker compose down -v` | Parar todo y borrar la base de datos |
| `docker compose up --build -d` | Reconstruir tras cambiar el código: la imagen contiene el código, no lo monta |

## B. Desarrollar en el Dev Container

1. Abre el repositorio en VS Code y ejecuta **Dev Containers: Reopen in Container**. Antes de crear el contenedor, VS Code ejecuta en tu máquina [`scripts/bootstrap_env.py`](../scripts/bootstrap_env.py), que crea `backend/.env` con un `JWT_SECRET_KEY` generado.
2. Al crearse el contenedor, [`.devcontainer/post-create.sh`](../.devcontainer/post-create.sh):
   - instala las dependencias con `uv sync --locked --all-groups`;
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
| `just seed` | Cargar los [datos de demo](#datos-de-demo-opcional) (opcional) |
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

## Datos de demo (opcional)

Sirven para probar sin crear nada a mano. Un comando carga cuentas, sedes, ponentes, eventos y charlas que cubren los requisitos del MVP ([docs/01](../docs/01-problema-solucion-y-alcance.md)) y los casos borde resueltos ([docs/04 §12](../docs/04-modelo-dominio-y-base-de-datos.md#12-riesgos-y-decisiones-por-cerrar)). Si prefieres recorrer el flujo desde cero, sigue con la [primera prueba](#primera-prueba).

```bash
docker compose exec api python -m app.modules.demo.cli seed   # opción A, desde la raíz
just seed                                                      # opción B, desde backend/
```

- Se crean con los mismos servicios que usa la API, así que cumplen todas sus reglas. Todo va en una sola transacción: si algo falla, no queda nada a medias.
- Las fechas son relativas al momento de ejecutarlo, así que los eventos siempre quedan en el futuro.
- Si los datos ya existen (la cuenta `admin@demo.example.com`), el comando no hace nada.
- Imprime las cuentas y el `id` de cada evento. Los `id` dependen de lo que ya hubiera en la base de datos: tómalos de esa salida o de `GET /api/v1/events?title=...`.
- Para quitarlos hay que vaciar la base de datos: `docker compose down -v` con la opción A, o `just downgrade base && just migrate` en el Dev Container.

### Cuentas

Todas usan la contraseña `demo1234` y tienen el rol `ATTENDEE`. En `/docs`, entra por **Authorize** con el email como `username`.

| Cuenta | Además | Qué representa |
|---|---|---|
| `admin@demo.example.com` | `ADMIN` | El único administrador |
| `ana@demo.example.com` | `ORGANIZER` | Dueña de PyData Bogotá, Software Architecture Summit, FastAPI Meetup y Lightning Talks |
| `bruno@demo.example.com` | `ORGANIZER` | Dueño de DevOps Day y Hackathon 2026; asiste al Summit de Ana |
| `irene@demo.example.com` | — | Fue organizadora: conserva su borrador Data Visualization Workshop, pero ya no tiene el rol |
| `carla@`, `diego@`, `elena@`, `felipe@`, `gabriela@`, `hugo@` (`demo.example.com`) | — | Asistentes. Su situación en cada evento está abajo |

### Sedes y ponentes

- **Ágora Convention Center**, activa, con las salas Main Auditorium (200 plazas), Room B (60) y Workshop Lab (20).
- **North Campus**, desactivada: ningún evento ni charla puede usarla.
- Ponentes: María José Núñez, Andrés Peña, Lucía Fernández, Tomás O'Connor y Sofía Ramírez, que no tiene charlas.

### Eventos

Las horas son de Bogotá. La API las devuelve en UTC, con la zona IANA del evento en `timezone`.

| Evento (dueño) | Estado | Qué tiene |
|---|---|---|
| **PyData Bogotá** (Ana) | `PUBLISHED`, dentro de 30 días | Aforo 3, lleno. Confirmados: Carla, Elena y Felipe. En espera: Gabriela (1.ª) y Diego (2.º). Diego estaba confirmado: canceló, Felipe subió desde la cola y Diego volvió a inscribirse con la misma inscripción, al final de la cola. Charlas: keynote con dos ponentes (9:00); taller de pandas (10:00–12:00), con capacidad 2 y 3 interesados; dataviz a la misma hora en otra sala, con Carla interesada en ambas; un Q&A en borrador, sin sala; un panel cancelado |
| **Software Architecture Summit** (Ana) | `PUBLISHED`, dentro de 45 días, dos días | Aforo 50, con plazas libres. Inscritos: Ana (la dueña), Bruno (otro organizador) y Carla; Hugo se inscribió y canceló. El primer día hay dos charlas a la vez, de 10:00 a 11:00: «Event-driven architecture in practice» en Main Auditorium, con Tomás, y «Modular monoliths» en Room B, con Lucía |
| **DevOps Day** (Bruno) | `PUBLISHED`, el mismo día y en la misma sede que el Summit | Inscripción ya cerrada (`registration_closes_at` en el pasado); Elena alcanzó a inscribirse. Charla CI/CD en Workshop Lab, de 11:00 a 12:00 |
| **FastAPI Meetup** (Ana) | `DRAFT`, dentro de 60 días, sin sede | Zona `America/Mexico_City`. Una charla en borrador, sin sala |
| **Hackathon 2026** (Bruno) | `CANCELLED` | Tenía 2 confirmados, 1 en espera y un interés. Al cancelarlo, todo quedó cancelado o retirado en la misma transacción |
| **Lightning Talks** (Ana) | `PUBLISHED`; empieza 2 minutos después de ejecutar el comando y dura 3 | Carla y Elena confirmadas; Carla, interesada en su charla. Sirve para ver qué cambia cuando un evento empieza y cuando termina |
| **Data Visualization Workshop** (Irene) | `DRAFT`, dentro de 70 días | Su dueña ya no es organizadora |

### Qué probar

Haz las filas de cada tabla en orden y las tablas también en orden: algunas cambian el estado que usa la siguiente. Los `id` salen de `GET /events`, `GET /events/{id}/sessions`, `GET /venues`, `GET /venues/{id}/rooms` y `GET /speakers`.

**Interés en charlas** (RF-15 y RF-16): el interés no reserva plaza.

| Cuenta | Qué hacer | Resultado |
|---|---|---|
| ana | Ver la agenda de PyData (`GET /events/{id}/sessions`) | El taller de pandas tiene 3 interesados con capacidad 2: `overdemand: true`. La keynote y el panel tienen 0, porque el interés se retira al cancelar la inscripción o la charla. Ana ve el Q&A en borrador |
| carla | Ver la misma agenda | No ve el Q&A en borrador; el panel cancelado, sí |
| gabriela | Marcar interés en el taller (`PUT /sessions/{id}/interest`), mientras está en espera | 409 `registration_not_confirmed` |
| carla | Marcar interés otra vez en el taller | 204 sin duplicar: sigue contando una vez |
| ana | Programar el Q&A (`POST /sessions/{id}/schedule`) | 409 `session_requires_room` |

**Cupos y lista de espera** (RF-06 a RF-10): nunca hay más confirmados que aforo y la cola es FIFO.

| Cuenta | Qué hacer | Resultado |
|---|---|---|
| hugo | Inscribirse en PyData (`POST /events/{id}/registrations`) | 201 `WAITLISTED`, `waitlist_position: 3` |
| hugo | Repetir la inscripción | 200 con la misma inscripción: no se duplica ni pierde su puesto |
| ana | Ver la cola (`GET /events/{id}/registrations?status=WAITLISTED`) | Gabriela, Diego y Hugo, en ese orden |
| carla | Cancelar en PyData (`POST /events/{id}/registrations/me/cancel`) | Gabriela, la primera de la cola, pasa a `CONFIRMED` (`GET /events/{id}/registrations/me` con su cuenta) |
| ana | Bajar el aforo a 1 (`PATCH /events/{id}` con `{"capacity": 1}`) | 409 `capacity_below_confirmed` |
| ana | Subirlo a 5 | Diego y Hugo pasan a `CONFIRMED`, en orden. `GET /events/{id}/occupancy`: 5 confirmados y 0 en espera |
| carla | Volver a inscribirse en PyData | 201 `WAITLISTED`: reactiva su inscripción, pero no recupera su plaza ni su antigüedad |
| hugo | Inscribirse otra vez en el Summit, donde había cancelado | 201 `CONFIRMED`, con la misma inscripción reactivada |
| carla | `GET /users/me/registrations` | Sus inscripciones en todos los eventos, incluidas las canceladas |

**Plazos**: inscribirse se puede hasta el cierre de inscripción o, si no hay cierre, hasta el inicio; cancelar, hasta el inicio.

| Cuenta | Qué hacer | Resultado |
|---|---|---|
| hugo | Inscribirse en DevOps Day | 409 `registration_closed` |
| elena | Repetir su inscripción en DevOps Day | 200 con su inscripción: un reintento no falla aunque el plazo haya cerrado |
| elena | Cancelar en DevOps Day | Permitido: la inscripción cerró, pero el evento no ha empezado |
| ana | Completar Lightning Talks antes de que termine (`POST /events/{id}/complete`) | 409 `event_not_ended` |
| hugo, carla, elena | Con Lightning Talks ya empezado: inscribirse, cancelar y marcar interés en su charla | 409 `registration_closed`, `cancellation_closed` y `session_not_open` |
| ana | Completarlo cuando ya terminó (5 minutos después del comando) | 200 `COMPLETED`. Después, editarlo da 409 `event_not_editable` e inscribirse, 409 `event_not_open` |

**Estados, permisos y propiedad** (RF-02, RF-03, RF-05 y HU-01)

| Cuenta | Qué hacer | Resultado |
|---|---|---|
| hugo | Inscribirse en Hackathon 2026 | 409 `event_not_open`. El evento sigue visible como `CANCELLED` |
| bruno | Ver FastAPI Meetup (`GET /events/{id}`) | 404 `event_not_found`: un borrador ajeno no revela que existe |
| ana | Publicar FastAPI Meetup (`POST /events/{id}/publish`) | 409 `event_requires_venue`. Tras un `PATCH` con el `venue_id` de Ágora, se publica |
| ana | Crear un evento en North Campus (`POST /events`) | 409 `venue_inactive` |
| ana | Editar DevOps Day | 403 `not_event_owner`. El admin sí puede |
| irene | `GET /events?mine=true` y editar su borrador | Lo ve, pero editarlo da 403 `not_event_owner`, y crear un evento, 403 `forbidden`. El admin sí puede editarlo |
| admin | Quitarse el rol `ADMIN` (`DELETE /users/{id}/roles/ADMIN`) | 409 `last_admin`: siempre queda un administrador activo |
| — | Registrarse con `CARLA@DEMO.EXAMPLE.COM` (`POST /auth/register`) | 409 `email_taken`: el email es único sin distinguir mayúsculas |
| carla, admin | Buscar `GET /events?title=data` | Carla ve PyData Bogotá; el admin ve además el borrador de Irene |

**Charlas, salas y ponentes** (RF-11 a RF-14 y HU-04). Bruno crea las charlas en DevOps Day (`POST /events/{id}/sessions`) y las programa (`POST /sessions/{id}/schedule`).

| Cuenta | Qué hacer | Resultado |
|---|---|---|
| bruno | Una charla en Main Auditorium a la misma hora que «Event-driven architecture in practice» | 409 `room_not_available`: ocupa la sala otro evento |
| bruno | Una en Workshop Lab, a esa misma hora, con Tomás de ponente | 409 `speaker_not_available`: Tomás habla en el Summit a esa hora |
| bruno | Una en Workshop Lab que termina justo cuando empieza su charla CI/CD | Se programa: dos charlas seguidas no se solapan |
| bruno | Una de capacidad 30 en Workshop Lab, que tiene 20 plazas | 409 `capacity_exceeds_room` |
| bruno | Una que empieza antes que el evento | 409 `session_outside_event` |
| ana | Editar la charla CI/CD de Bruno (`PATCH /sessions/{id}`) | 403 `not_event_owner` |
| admin | Bajar Main Auditorium a 100 plazas, desactivar Room B, desactivar Ágora (`PATCH /venues/...`) | 409 `room_capacity_below_sessions`, `room_has_scheduled_sessions` y `venue_has_scheduled_sessions`: tienen charlas programadas por delante |
| ana | Borrar a Sofía Ramírez y a Tomás O'Connor (`DELETE /speakers/{id}`) | 204 para Sofía; 409 `speaker_has_sessions` para Tomás |
| cualquiera | `GET /speakers?name=núñez` y `GET /speakers?name=%` | La primera encuentra a María José Núñez; la segunda no devuelve nada, porque `%` se busca como texto literal |

La concurrencia (dos personas por el último cupo, dos charlas en la misma sala a la vez) no se puede probar a mano: la cubren los tests de `tests/concurrency/`.

## Tests

| Tipo | Carpeta | Qué prueban | Base de datos |
|---|---|---|---|
| Unitarios | `tests/unit/` (refleja `app/`) | Servicios, routers, validaciones y documentación OpenAPI, con fakes | Ninguna |
| Integración | `tests/integration/` | Repositorios, restricciones, migraciones y flujos HTTP completos | `POSTGRES_TEST_DB`, cada test en una transacción que se revierte |
| Concurrencia | `tests/concurrency/` | Sobrecupo, lista de espera, salas y ponentes bajo peticiones simultáneas (docs/03) | `POSTGRES_TEST_DB`, con commits reales y varios hilos |

Para ejecutarlos:
- **Con la opción A:** `docker compose run --rm --build tests`.
- **En el Dev Container:** `just test`, o `just coverage` para el reporte.

**Cobertura:** el reporte mide líneas y ramas de `app/` con la suite completa, y falla por debajo del 90 %. Hoy da 97,9 %. Si se ejecutan solo los unitarios, los `repository.py` quedan bajos, y es a propósito: se prueban contra PostgreSQL real en los tests de integración, porque simular SQL con mocks solo prueba el mock.

## Estructura

```text
backend/
├── app/
│   ├── main.py               # Arranque: routers, OpenAPI, manejo de errores
│   ├── core/                 # Configuración, base de datos, seguridad (Argon2id, JWT)
│   ├── modules/<dominio>/    # auth, users, venues, speakers, events, registrations, sessions, health; demo (datos de demo)
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
