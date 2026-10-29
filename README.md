# Mis Eventos — Sistema de gestión de eventos

> Estado: MVP en desarrollo · Última actualización: 2026-10-29

**Mis Eventos** es una plataforma API-first para organizar eventos, administrar conferencias y salas, gestionar inscripciones con capacidad limitada y lista de espera, y ofrecer datos confiables a organizadores y asistentes.

## ¿Qué problema resuelve?

La organización manual mediante hojas de cálculo, correos y documentos dispersos dificulta conocer los cupos reales, coordinar charlas y salas, controlar permisos y ofrecer una inscripción simple. El sistema centraliza los datos en PostgreSQL, automatiza las reglas de negocio y expone operaciones a través de una API REST con FastAPI.

## Documentación

Cada tipo de documentación responde a una pregunta distinta y vive en un solo lugar:

| Pregunta | Dónde |
|---|---|
| ¿Cómo configuro, ejecuto y pruebo el backend? | [backend/README.md](backend/README.md) |
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
- **Ejecución local:** imagen Docker de la API + Docker Compose.
- **Arquitectura de aplicación:** monolito modular, API REST.

## Principios de diseño

- Las reglas de negocio se aplican en el backend; no se delegan al frontend.
- La inscripción confirmada al **evento** reserva un cupo. La manifestación de interés por una **charla** no reserva un asiento.
- Cuando se llena el evento, la solicitud entra en lista de espera; las promociones mantienen el orden de llegada.
- Un organizador únicamente modifica sus eventos; un administrador puede administrar cualquier evento y charla.
- Las salas no pueden asignarse a sesiones superpuestas y su capacidad debe ser suficiente para la capacidad configurada para la sesión.
- Se permite indicar interés por charlas simultáneas, porque este registro tiene finalidad estadística.
- El mismo sistema debe ejecutarse en desarrollo, pruebas y producción mediante configuración externa; **Dev Container no es un mecanismo de despliegue**.

## Estructura del repositorio

```text
.
├── backend/          # API: código, tests, migraciones, Dockerfile → backend/README.md
├── frontend/         # (pendiente)
├── docs/             # Diseño y decisiones (01–04) y estado del trabajo (PROGRESO)
├── compose.yaml      # Stack local: PostgreSQL + migraciones + API
├── docker/postgres/  # Script que crea la BD de tests al iniciar PostgreSQL
└── .devcontainer/    # Entorno de desarrollo (VS Code Dev Containers), con su propio compose
```

## Levantar en local

Con Docker basta. Desde la raíz del repositorio:

```bash
cp -n backend/.env.example backend/.env   # y pon un JWT_SECRET_KEY de 32+ caracteres
docker compose up --build -d              # API en http://localhost:8000/docs
```

Los pasos completos están en [backend/README.md](backend/README.md):
- crear el primer administrador;
- recorrer un flujo de prueba;
- ejecutar los tests con su reporte de cobertura;
- desarrollar en el Dev Container.

## Estado actual

Implementado:
- esquema de base de datos completo, con sus migraciones;
- autenticación: registro y login con JWT;
- usuarios y roles;
- sedes, salas y ponentes;
- eventos;
- inscripciones con lista de espera;
- charlas: salas y ponentes sin solapes, interés y métricas por charla;
- health check.

El stack local se levanta con Docker Compose. El despliegue a producción queda fuera del alcance actual. El detalle y el siguiente paso están en [docs/PROGRESO.md](docs/PROGRESO.md).
