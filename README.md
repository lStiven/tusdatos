# Mis Eventos — Sistema de gestión de eventos

> Estado: MVP en desarrollo · Última actualización: 2026-10-28

**Mis Eventos** es una plataforma API-first para organizar eventos, administrar conferencias y salas, gestionar inscripciones con capacidad limitada y lista de espera, y ofrecer datos confiables a organizadores y asistentes.

## ¿Qué problema resuelve?

La organización manual mediante hojas de cálculo, correos y documentos dispersos dificulta conocer los cupos reales, coordinar charlas y salas, controlar permisos y ofrecer una inscripción simple. El sistema centraliza los datos en PostgreSQL, automatiza las reglas de negocio y expone operaciones a través de una API REST con FastAPI.

## Documentación

Cada tipo de documentación responde a una pregunta distinta y vive en un solo lugar:

| Pregunta | Dónde |
|---|---|
| ¿Cómo llamo a un endpoint, qué reglas aplica y qué errores devuelve? | OpenAPI de la API en marcha: [`/docs`](http://localhost:8000/docs) (Swagger) o [`/redoc`](http://localhost:8000/redoc). Se genera desde el código |
| ¿Cómo funcionan la autenticación, los errores y la paginación? | Portada de `/docs` |
| ¿Por qué está diseñado así? | `docs/`, abajo |
| ¿Qué está hecho y qué sigue? | [docs/PROGRESO.md](docs/PROGRESO.md) |

1. [Problema, solución y alcance del MVP](docs/01-problema-solucion-y-alcance.md): contexto, actores, requisitos, flujos, reglas y criterios de aceptación.
2. [Arquitectura técnica, Dev Containers y despliegue](docs/02-arquitectura-y-contenedores.md): separación de entornos, contenedores, base de datos, seguridad y operaciones.
3. [Concurrencia, cupos y lista de espera](docs/03-concurrencia-cupos-y-lista-de-espera.md): cómo se evita el sobrecupo y se ordena la lista de espera.
4. [Modelo de dominio y base de datos](docs/04-modelo-dominio-y-base-de-datos.md): tablas, restricciones, bloqueos y reglas entre tablas.

## Stack decidido

- **Backend:** Python 3.14, FastAPI, SQLModel/SQLAlchemy, PostgreSQL.
- **Gestión:** uv, Alembic, pytest, Swagger/OpenAPI.
- **Desarrollo reproducible:** Dev Containers + Docker Compose.
- **Arquitectura de aplicación:** monolito modular, API REST.

## Principios de diseño

- Las reglas de negocio se aplican en el backend; no se delegan al frontend.
- La inscripción confirmada al **evento** reserva un cupo. La manifestación de interés por una **charla** no reserva un asiento.
- Cuando se llena el evento, la solicitud entra en lista de espera; las promociones mantienen el orden de llegada.
- Un organizador únicamente modifica sus eventos; un administrador puede administrar cualquier evento y charla.
- Las salas no pueden asignarse a sesiones superpuestas y su capacidad debe ser suficiente para la capacidad configurada para la sesión.
- Se permite indicar interés por charlas simultáneas, porque este registro tiene finalidad estadística.
- El mismo sistema debe ejecutarse en desarrollo, pruebas y producción mediante configuración externa; **Dev Container no es un mecanismo de despliegue**.

## Entorno de desarrollo

Requisitos: Docker y VS Code con la extensión **Dev Containers**.

1. Clonar el repositorio y abrirlo en VS Code.
2. Ejecutar **Dev Containers: Reopen in Container**.
3. Al crearse el contenedor, [`.devcontainer/post-create.sh`](.devcontainer/post-create.sh) instala las dependencias con `uv sync --locked --all-groups`, crea `.env` desde `.env.example` y, cuando existan, instala los hooks de pre-commit y aplica las migraciones.

El contenedor incluye Python 3.14, uv y just. Ejecuta `just` para ver los comandos disponibles.

### Primera petición en 5 pasos

```bash
just migrate                                        # 1. esquema al día (el post-create ya lo hace)
just create-admin admin@example.com "Admin"         # 2. primer administrador; pide la contraseña
just dev                                            # 3. API en http://localhost:8000
```

4. Abrir [`http://localhost:8000/docs`](http://localhost:8000/docs), pulsar **Authorize** y entrar con el email como `username`.
5. Probar `GET /api/v1/users/me`: debe devolver los roles `ATTENDEE` y `ADMIN`.

Las cuentas creadas con `POST /api/v1/auth/register` solo reciben `ATTENDEE`; `just create-admin` es la única forma de crear un administrador sin otro administrador.

### Comandos habituales

| Comando | Qué hace |
|---|---|
| `just test` | Tests unitarios y de integración (estos usan la BD `POSTGRES_TEST_DB`, que se recrea en cada ejecución) |
| `just prepare` | Formato + lint + tipos + tests; obligatorio antes de dar una tarea por terminada |
| `just migration "mensaje"` | Genera una migración desde los modelos; revisarla a mano (ver docs/04 §10) |

## Estado actual

Implementados: esquema completo de base de datos con migraciones, autenticación (registro, login JWT, roles), administración de sedes y salas, y health check. En curso: eventos, inscripciones y lista de espera, charlas y ponentes. El detalle y el siguiente paso están en [docs/PROGRESO.md](docs/PROGRESO.md).

Los artefactos de producción que describe docs/02 (imagen final, compose de producción, despliegue) aún no existen: hoy solo hay entorno de desarrollo.
