# Mis Eventos — Sistema de gestión de eventos

> Estado: diseño de MVP · Última actualización: 2026-10-27

**Mis Eventos** es una plataforma API-first para organizar eventos, administrar conferencias y salas, gestionar inscripciones con capacidad limitada y lista de espera, y ofrecer datos confiables a organizadores y asistentes.

## ¿Qué problema resuelve?

La organización manual mediante hojas de cálculo, correos y documentos dispersos dificulta conocer los cupos reales, coordinar charlas y salas, controlar permisos y ofrecer una inscripción simple. El sistema centraliza los datos en PostgreSQL, automatiza las reglas de negocio y expone operaciones a través de una API REST con FastAPI.

## Documentación

1. [Problema, solución y alcance del MVP](docs/01-problema-solucion-y-alcance.md): contexto, actores, requisitos, flujos, reglas y criterios de aceptación.
2. [Arquitectura técnica, Dev Containers y despliegue](docs/02-arquitectura-y-contenedores.md): separación de entornos, contenedores, base de datos, seguridad y operaciones.

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

El contenedor incluye Python 3.14, uv y just. Ejecuta `just` para ver los comandos disponibles (`just dev`, `just test`, `just check`, ...).

## Estado actual

Este repositorio contiene la documentación inicial y las decisiones de dominio. Los archivos de aplicación y de infraestructura descritos en la documentación son **propuestos**, no implementados todavía.

## Próximos entregables

Diseño del modelo entidad-relación y contratos OpenAPI, definición de decisiones pendientes, inicialización de FastAPI/uv y configuración de Docker/Dev Containers.
