# 02 · Arquitectura técnica, Dev Containers y despliegue

**Producto:** Mis Eventos  
**Estado:** propuesta de arquitectura para el MVP  
**Fecha:** 2026-10-27

## 1. Decisión principal

Usaremos **un monolito modular en FastAPI**, con PostgreSQL como fuente de verdad, un entorno de desarrollo reproducible mediante **Dev Containers**, y **una imagen de aplicación de producción separada del entorno de desarrollo**.

**Un Dev Container es un entorno de trabajo para desarrolladores; no es un sistema para desplegar el servicio al público.** Docker construye imágenes y ejecuta contenedores; Compose define servicios relacionados; un registro almacena imágenes; y un entorno de despliegue ejecuta esas imágenes. En producción, PostgreSQL se recomienda como servicio gestionado cuando la infraestructura y el presupuesto lo permitan.

## 2. Qué componente administra cada cosa

| Componente | Responsabilidad | Dónde se usa |
|---|---|---|
| `.devcontainer/devcontainer.json` | Configura editor, extensiones, usuario y servicio donde se desarrolla | Desarrollo |
| `Dockerfile` | Define etapas de build: desarrollo y runtime mínimo | Desarrollo / CI / Producción |
| `compose.yaml` | Define el servicio API y opciones compartidas, sin dependencias exclusivas de desarrollo | Base para entornos |
| `compose.dev.yaml` | Añade PostgreSQL local, montajes de código, recarga y puertos de desarrollo | Desarrollo |
| `compose.prod.yaml` | Configura imagen publicada, restart, red y opciones de operación | Servidor único / producción pequeña |
| PostgreSQL local en Compose | Base efímera/persistente por volumen para cada desarrollador | Desarrollo |
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
Docker Compose (compose.yaml + compose.dev.yaml)
       ├── api-dev: Python 3.14 + uv + FastAPI + pytest + Alembic
       │            código fuente montado desde el repositorio
       └── postgres-dev: PostgreSQL, healthcheck, volumen local
                     │
                     └── Red interna de Compose (api-dev -> postgres-dev:5432)
```

- Solo se abre el servicio `api-dev` en el editor; PostgreSQL corre como servicio auxiliar.
- La base de datos tiene un volumen **de desarrollo**, nunca compartido con producción.
- El puerto PostgreSQL no necesita exponerse al host salvo que se requiera un cliente externo.
- La API puede publicar `localhost:8000` para Swagger, o usar reenvío de puertos del editor.
- `depends_on: condition: service_healthy` evita empezar la app antes de que PostgreSQL esté listo; la app también debe manejar reconexión ante fallos posteriores.
- `uv.lock` se versiona y se usa para instalaciones reproducibles.
- Cambios de código con volumen y `--reload` **solo en desarrollo**.

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

Adecuado para un MVP con tráfico predecible, un servidor y presupuesto limitado. Se despliega **la imagen publicada** de la API con `compose.yaml + compose.prod.yaml`, y se conecta a una base gestionada si es posible.

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

```text
mis-eventos/
├── .devcontainer/
│   └── devcontainer.json
├── app/
│   ├── main.py
│   ├── core/
│   └── modules/
│       ├── auth/
│       ├── users/
│       ├── events/
│       ├── venues/
│       ├── sessions/
│       ├── speakers/
│       └── registrations/
├── migrations/
├── tests/
├── docs/
│   ├── 01-problema-solucion-y-alcance.md
│   └── 02-arquitectura-y-contenedores.md
├── Dockerfile                # etapas dev / runtime
├── compose.yaml             # base neutral: servicio API
├── compose.dev.yaml         # base local: DB y volúmenes
├── compose.prod.yaml        # ajustes de producción
├── .dockerignore
├── .env.example              # nombres de variables, sin secretos
├── alembic.ini
├── pyproject.toml
├── uv.lock
└── README.md
```

**Nota:** esta estructura expresa una decisión de diseño; los archivos de infraestructura y aplicación se crearán en la siguiente fase.

## 6. Ejemplos de composición (orientativos, no despliegue listo)

Las siguientes instrucciones ilustran la separación entre entornos; **no son comandos para ejecutar todavía**, porque los archivos aún no existen.

```bash
# Desarrollo con Dev Container (composición descrita por devcontainer.json)
docker compose -f compose.yaml -f compose.dev.yaml up -d

# Producción de un solo servidor, usando imagen previamente publicada
docker compose -f compose.yaml -f compose.prod.yaml up -d

# Validar cómo se fusionan archivos antes del despliegue
docker compose -f compose.yaml -f compose.prod.yaml config
```

El `compose.prod.yaml` **no** debe incluir PostgreSQL local por accidente. Por eso proponemos que solo `compose.dev.yaml` cree el servicio de base de datos. La base `compose.yaml` referencia una URL de conexión externa configurable y no depende obligatoriamente de un servicio `db` definido en el mismo Compose.

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
| Docker multi-stage | Propuesta | Separar herramientas de build de runtime |
| Compose base + overlays dev/prod | Propuesta | Evitar mezclar desarrollo y ejecución pública |
| PostgreSQL gestionado para producción | Recomendado | Menor riesgo operacional |
| Kubernetes | Fuera del MVP | Sobrecosto de complejidad |
| Servicio de email / cola asíncrona | Futuro | MVP puede consultar estados por API |

## 11. Referencias oficiales

- [Development Containers Specification](https://containers.dev/overview).
- [Docker — Use Compose in production](https://docs.docker.com/compose/how-tos/production/).
- [Docker — Multiple Compose files](https://docs.docker.com/compose/how-tos/multiple-compose-files/).
- [Docker — Manage secrets securely in Docker Compose](https://docs.docker.com/compose/how-tos/use-secrets/).
- [Docker — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/).
- [Docker — Control startup/shutdown order](https://docs.docker.com/compose/how-tos/startup-order/).
- [uv — Using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/).
- [AWS RDS — Automated backups](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html).
