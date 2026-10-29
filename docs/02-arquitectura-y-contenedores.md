# 02 · Arquitectura técnica, Dev Containers y despliegue

**Producto:** Mis Eventos  
**Estado:** desarrollo (Dev Container) y stack local (Compose) implementados; producción propuesta, fuera del alcance actual  
**Fecha:** 2026-10-27 · actualizado 2026-10-29

## 1. Decisión principal

Usaremos **un monolito modular en FastAPI**, con PostgreSQL como fuente de verdad, un entorno de desarrollo reproducible mediante **Dev Containers**, y **una imagen de aplicación de producción separada del entorno de desarrollo**.

**Un Dev Container es un entorno de trabajo para desarrolladores; no es un sistema para desplegar el servicio al público.** Docker construye imágenes y ejecuta contenedores; Compose define servicios relacionados; un registro almacena imágenes; y un entorno de despliegue ejecuta esas imágenes. En producción, PostgreSQL se recomienda como servicio gestionado cuando la infraestructura y el presupuesto lo permitan.

## 2. Qué componente administra cada cosa

| Componente | Responsabilidad | Dónde se usa |
|---|---|---|
| `.devcontainer/devcontainer.json` + `.devcontainer/compose.yaml` | Configuran editor, extensiones y el contenedor de trabajo con el código montado, más su PostgreSQL | Desarrollo |
| `backend/Dockerfile` | Etapas `runtime` (imagen de la API sin dependencias de desarrollo, usuario no root, healthcheck) y `test` (suite con cobertura) | Stack local / CI / Producción |
| `compose.yaml` (raíz) | Stack local construido desde el repositorio: PostgreSQL, migraciones una vez y API | Pruebas reales en local |
| `compose.prod.yaml` | Imagen publicada, restart, red y opciones de operación (propuesta, no existe) | Servidor único / producción pequeña |
| PostgreSQL local en Compose | Base persistente por volumen; el Dev Container y el stack local tienen cada uno el suyo | Desarrollo / stack local |
| PostgreSQL gestionado | Datos reales, respaldos y recuperación administrados por proveedor | Producción recomendada |
| Registro de contenedores (ej. GHCR) | Almacena la imagen versionada construida en CI | CI / Producción |
| CI (ej. GitHub Actions) | Tests, análisis, build, escaneo y publicación de imágenes | Integración |
| Servidor/PaaS/orquestador | Ejecuta la imagen publicada; gestiona red, reinicios y escalado | Producción |

## 3. Topología por entorno

### Desarrollo local

```text
VS Code / editor compatible
       │
       ▼
.devcontainer/devcontainer.json
       │
       ▼
Docker Compose (.devcontainer/compose.yaml, proyecto `mis-eventos`)
       ├── api: Python 3.14 + uv + just + pytest + Alembic
       │        código fuente montado desde el repositorio
       └── postgres: PostgreSQL 18, healthcheck, volumen local
                     │
                     └── Red interna de Compose (api -> postgres:5432)
```

- Solo se abre el servicio `api` en el editor; PostgreSQL corre como servicio auxiliar.
- El contenedor no recibe `env_file`: la app lee `backend/.env`, que `post-create.sh` crea después de que el compose ya arrancó. PostgreSQL toma las credenciales de `backend/.env.example`, y de `backend/.env` si existe, para que un clon nuevo arranque sin pasos previos.
- La base de datos tiene un volumen **de desarrollo**, nunca compartido con producción.
- El puerto PostgreSQL no necesita exponerse al host salvo que se requiera un cliente externo.
- La API puede publicar `localhost:8000` para Swagger, o usar reenvío de puertos del editor.
- `depends_on: condition: service_healthy` evita empezar la app antes de que PostgreSQL esté listo; la app también debe manejar reconexión ante fallos posteriores.
- `uv.lock` se versiona y se usa para instalaciones reproducibles.
- Cambios de código con volumen y `--reload` **solo en desarrollo**.

### Stack local (pruebas reales)

```text
docker compose up --build   (compose.yaml de la raíz, proyecto `mis-eventos-local`)
       ├── postgres: PostgreSQL 18 + BD de tests (docker/postgres/initdb)
       ├── migrate: imagen runtime → alembic upgrade head, y termina
       ├── api: imagen runtime → uvicorn sin --reload, :8000 publicado (API_PORT)
       └── tests (perfil test, solo con `docker compose run --rm --build tests`)
```

- Usa la misma imagen que usaría un despliegue: sin código montado ni dependencias de desarrollo. Lo que funciona aquí no depende del Dev Container.
- Las migraciones son un paso único (`migrate`) del que depende `api` con `service_completed_successfully`: si fallan, la API no arranca con un esquema a medias. Es la regla de §8 aplicada en pequeño, en lugar de migrar dentro del arranque de cada API.
- Los nombres de proyecto distintos (`mis-eventos` y `mis-eventos-local`) evitan que levantar el stack recree los contenedores del Dev Container o reutilice su volumen.
- Configuración en `backend/.env`, el mismo archivo que usa el Dev Container. Ver backend/README.md.

### Integración continua

```text
Push / Pull Request
      │
      ▼
Lint + tests unitarios + pruebas de integración con PostgreSQL aislado
      │
      ▼
Build de imagen runtime (sin dependencias de desarrollo)
      │
      ▼
Escaneo y publicación en registro con etiqueta de versión y commit SHA
```

La CI no necesita abrir una sesión de VS Code ni desplegar un Dev Container para compilar. Puede ejecutar tests en contenedores específicos. Si conviene, la especificación Dev Container también puede reutilizarse en CI, pero no es obligatoria para el pipeline.

### Producción recomendada

```text
Usuarios
   │ HTTPS/TLS
   ▼
Reverse proxy / Load Balancer / Plataforma gestionada
   │
   ▼
Contenedor FastAPI (imagen publicada, sin --reload)
   │            ├── Logs, healthchecks, métricas
   │            └── Configuración y secretos externos
   │
   ▼
PostgreSQL gestionado (red privada, backups, restauración, monitoreo)
```

- **No ejecutar** la configuración `.devcontainer` en producción.
- No montar el directorio de código fuente del host en el contenedor de producción.
- Ejecutar con un usuario no root, imagen pequeña, dependencias bloqueadas y tag/digest fijado.
- Gestionar TLS, logs, secretos, backups y migraciones como componentes operativos independientes.
- La base de datos no necesita exponerse a Internet; restringir acceso a la red de la aplicación.

## 4. ¿Cómo desplegar en la práctica?

### Opción A: Docker Compose en una máquina virtual

Adecuado para un MVP con tráfico predecible, un servidor y presupuesto limitado. Se despliega **la imagen publicada** de la API con un `compose.prod.yaml` propio (el `compose.yaml` de la raíz incluye PostgreSQL local y es solo para pruebas), y se conecta a una base gestionada si es posible.

**Ventajas:** simple, control del servidor, costos previsibles.  
**Limitaciones:** disponibilidad condicionada al servidor; despliegues, reinicios, certificados, vigilancia y escalado a cargo del equipo.

### Opción B: plataforma de contenedores gestionada (PaaS)

Adecuado si se quiere concentrar el esfuerzo en FastAPI. La plataforma ejecuta la imagen publicada, expone HTTPS, reinicia instancias y puede ofrecer escalado/telemetría. PostgreSQL sigue siendo un servicio aparte.

**Ventajas:** menor carga operativa.  
**Limitaciones:** costo, límites de plataforma y adaptación de red/configuración.

### Opción C: Kubernetes

No recomendado para el MVP, salvo que la organización ya opere un clúster y requiera despliegues complejos, autoscaling multi-servicio o políticas avanzadas de alta disponibilidad. Kubernetes añade recursos, observabilidad, controles y mantenimiento que el alcance inicial no justifica.

**Decisión propuesta:** desarrollar con Compose + Dev Containers; desplegar inicialmente en **PaaS con contenedores + PostgreSQL gestionado**, o, si manda el presupuesto, **VM + Compose + PostgreSQL gestionado**. No hay obligación de elegir ahora un proveedor.

## 5. Estrategia de archivos

Backend y frontend viven en carpetas separadas; cada uno con su README, su configuración y su Dockerfile. Lo que orquesta ambos (compose, Dev Container, docs) queda en la raíz.

```text
mis-eventos/
├── .devcontainer/
│   ├── devcontainer.json
│   ├── compose.yaml          # entorno de desarrollo: api (código montado) + postgres
│   ├── Dockerfile            # imagen de trabajo: Python, uv, just, cliente psql
│   └── post-create.sh
├── backend/
│   ├── app/                  # main.py, core/, modules/<dominio>/, shared/
│   ├── migrations/
│   ├── tests/                # unit, integration, concurrency
│   ├── Dockerfile            # etapas runtime / test
│   ├── .dockerignore
│   ├── .env.example          # nombres de variables, sin secretos
│   ├── alembic.ini · pyproject.toml · uv.lock · justfile
│   └── README.md
├── frontend/                 # pendiente
├── docker/postgres/initdb/   # crea la BD de tests en ambos compose
├── docs/
├── compose.yaml              # stack local: postgres + migrate + api
└── README.md
```

## 6. Ejemplos de composición

```bash
# Stack local: construye la imagen, migra y levanta la API
docker compose up --build -d

# Tests de la imagen contra el PostgreSQL del stack
docker compose run --rm --build tests

# Desarrollo: lo levanta VS Code desde devcontainer.json (no se lanza a mano)
```

**Producción (propuesta, fuera del alcance actual):** un `compose.prod.yaml` con la imagen publicada, sin PostgreSQL local y con la URL de una base gestionada. Se escribirá cuando haya un destino de despliegue. Las secciones 3 («Producción recomendada»), 4, 8 y 9 describen lo que debería cumplir.

## 7. Contenedor de la aplicación: desarrollo vs. producción

| Aspecto | Desarrollo | Producción |
|---|---|---|
| Código | Montado y editable | Incluido en imagen inmutable |
| Python | 3.14 | 3.14, misma versión menor compatible |
| Dependencias | Todas, incluyendo pytest y depurador | Solo necesarias para ejecutar |
| Comando | Uvicorn con `--reload` | Servidor ASGI sin `--reload` |
| Usuario | No root cuando sea posible | No root obligatorio en el diseño |
| Configuración | Variables/archivos locales no versionados | Variables y secretos del despliegue |
| Datos | PostgreSQL local y desechable | PostgreSQL persistente y respaldado |
| Red | Puertos locales útiles | Solo interfaz pública requerida, BD privada |

Usar Docker multi-stage y `uv sync --locked` ayuda a generar builds consistentes. Excluir `.venv`, `.env`, secretos y carpetas innecesarias mediante `.dockerignore`.

## 8. Administración de PostgreSQL

### Desarrollo

- Una instancia aislada por stack local; versionar la versión principal de PostgreSQL.
- Volumen nombrado para conservar datos entre reinicios; `docker compose down -v` **borra esos datos**.
- Mantener datos de prueba y datos de desarrollo separados.
- Aplicar migraciones con Alembic, no crear tablas improvisadamente al arrancar la aplicación.

### Producción

- Preferir servicio administrado (por ejemplo, AWS RDS, Google Cloud SQL, Azure Database for PostgreSQL o un servicio PostgreSQL equivalente): backups configurables, monitoreo y opciones de recuperación.
- Si se autogestiona PostgreSQL en un contenedor, definir por separado volúmenes, backups externos, restauraciones ensayadas, alertas, parches y actualizaciones; **un volumen no es un backup**.
- No ejecutar migraciones automáticamente desde cada réplica de la API: usar un paso de despliegue único, con control de fallos y rollback planificado.
- Mantener conexión cifrada cuando corresponda, roles de BD de mínimos permisos y credenciales rotables.
- Definir retención de respaldos y probar restauraciones, no solo verificar que exista un archivo de backup.

## 9. Seguridad y operación

- Secrets: nada de contraseñas o tokens en imágenes, código ni repositorio. Usar gestor de secretos del proveedor o secretos de Compose en despliegues pequeños; `.env` local se ignora en Git.
- Autenticación JWT y comprobación de rol/propiedad en servicios de aplicación.
- HTTPS externo, validaciones Pydantic, límites razonables de petición y logs sin contraseñas ni tokens.
- Health checks separados de readiness cuando sea útil; la salud de PostgreSQL no es suficiente para concluir que las migraciones están al día.
- Métricas y alertas iniciales: errores 5xx, latencia, CPU/memoria, disponibilidad, fallos de conexión a BD, tamaño de lista de espera y fallos de jobs.
- Copias de seguridad independientes del contenedor y pruebas periódicas de recuperación.
- CI: lint (ej. Ruff), pytest, test de migración, escaneo de dependencias e imagen, build y publicación.

## 10. Decisiones de arquitectura documentadas

| Decisión | Estado | Motivo |
|---|---|---|
| Monolito modular FastAPI | Aprobada para MVP | Dominio transaccional y tamaño del equipo |
| PostgreSQL como fuente de verdad | Aprobada | Integridad referencial, transacciones, bloqueos |
| uv + `uv.lock` | Aprobada | Reproducibilidad de dependencias |
| `.devcontainer` para desarrollo | Aprobada | Mismo entorno de trabajo |
| Backend en `backend/`, frontend en `frontend/` | Aprobada | Cada parte con su configuración, README y Dockerfile; la raíz solo orquesta |
| Dockerfile del backend con etapas `runtime` y `test` | Aprobada | La API corre sin dependencias de desarrollo y como usuario no root; los tests corren con solo Docker, sin Dev Container. El Dev Container mantiene su propia imagen de trabajo |
| Dos compose separados: Dev Container y stack local, cada uno con su volumen | Aprobada | Sustituye la propuesta de base + overlays: con un único entorno de ejecución (local), los overlays añadían fusión de archivos sin beneficio. Se revisa al abordar producción |
| Migraciones como servicio de una sola ejecución (`migrate`) | Aprobada | Un único paso que la API espera; un fallo de migración no deja la API sirviendo con el esquema viejo |
| PostgreSQL gestionado para producción | Recomendado | Menor riesgo operacional |
| Kubernetes | Fuera del MVP | Sobrecosto de complejidad |
| Servicio de email / cola asíncrona | Futuro | MVP puede consultar estados por API |
| Paginación `limit`/`offset` solo en colecciones que crecen con el uso (`events`, `users`, `speakers`) | Aprobada | Las acotadas por el negocio (sedes, salas de una sede) devuelven la lista completa: paginarlas obliga al cliente a gestionar páginas sin beneficio y añade un `COUNT` por petición. Orden total (`…, id`) para que las páginas no se solapen. Cursor (keyset) solo si se mide que `OFFSET` es un problema |

## 11. Referencias oficiales

- [Development Containers Specification](https://containers.dev/overview).
- [Docker — Use Compose in production](https://docs.docker.com/compose/how-tos/production/).
- [Docker — Multiple Compose files](https://docs.docker.com/compose/how-tos/multiple-compose-files/).
- [Docker — Manage secrets securely in Docker Compose](https://docs.docker.com/compose/how-tos/use-secrets/).
- [Docker — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/).
- [Docker — Control startup/shutdown order](https://docs.docker.com/compose/how-tos/startup-order/).
- [uv — Using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/).
- [AWS RDS — Automated backups](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html).
