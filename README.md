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
| ¿Cómo ejecuto y desarrollo el frontend? | [frontend/README.md](frontend/README.md) |
| ¿Cómo llamo a un endpoint, qué reglas aplica y qué errores devuelve? | OpenAPI de la API en marcha: [`/docs`](http://localhost:8000/docs) (Swagger) o [`/redoc`](http://localhost:8000/redoc). Se genera desde el código |
| ¿Cómo funcionan la autenticación, los errores y la paginación? | Portada de `/docs` |
| ¿Por qué está diseñado así? | `docs/`, abajo |

1. [Problema, solución y alcance del MVP](docs/01-problema-solucion-y-alcance.md): contexto, actores, requisitos, flujos, reglas y criterios de aceptación.
2. [Arquitectura técnica, Dev Containers y despliegue](docs/02-arquitectura-y-contenedores.md): separación de entornos, contenedores, base de datos, seguridad y operaciones.
3. [Concurrencia, cupos y lista de espera](docs/03-concurrencia-cupos-y-lista-de-espera.md): cómo se evita el sobrecupo y se ordena la lista de espera.
4. [Modelo de dominio y base de datos](docs/04-modelo-dominio-y-base-de-datos.md): tablas, restricciones, bloqueos y reglas entre tablas.

## Stack decidido

- **Backend:** Python 3.14, FastAPI, SQLModel/SQLAlchemy, PostgreSQL.
- **Frontend:** React, Vite y TypeScript, con un cliente generado desde el OpenAPI de la API; nginx lo sirve en la imagen.
- **Gestión:** uv, Alembic, pytest, Swagger/OpenAPI.
- **Desarrollo reproducible:** Dev Containers + Docker Compose.
- **Ejecución local:** imágenes Docker de la API y del frontend + Docker Compose.
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
├── frontend/         # App web (SPA): código, tests, Dockerfile → frontend/README.md
├── docs/             # Diseño y decisiones (01–04)
├── compose.yaml      # Stack local: PostgreSQL + migraciones + API + frontend
├── docker/postgres/  # Script que crea la BD de tests al iniciar PostgreSQL
├── scripts/          # bootstrap_env.py: crea backend/.env con un JWT_SECRET_KEY generado
└── .devcontainer/    # Entorno de desarrollo (VS Code Dev Containers), con su propio compose
```

## Levantar en local

Con Docker basta. Desde la raíz del repositorio:

```bash
python3 scripts/bootstrap_env.py   # crea backend/.env con un JWT_SECRET_KEY generado
docker compose up --build -d       # app en http://localhost:8080 · API en http://localhost:8000/docs
```

Los pasos completos están en [backend/README.md](backend/README.md):
- crear el primer administrador;
- recorrer un flujo de prueba;
- o, si lo prefieres, cargar [datos de demo](backend/README.md#datos-de-demo-opcional) que cubren cada regla y caso borde, con una guía de qué probar;
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

En curso: el frontend. Hoy tiene su base (cliente de la API, imagen Docker y servicio en el stack local); las vistas por rol van a continuación.

El stack local se levanta con Docker Compose. El despliegue a producción queda fuera del alcance actual.
