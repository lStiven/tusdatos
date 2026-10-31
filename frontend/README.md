# Frontend · Mis Eventos

SPA en React + Vite + TypeScript para usar y probar la API: navegar los endpoints, comprobar las reglas de negocio por rol y lanzar carreras de concurrencia.

Stack de UI: Tailwind v4 + shadcn/ui (Radix, accesible de serie), Motion para las animaciones (respetan `prefers-reduced-motion`), React Router, TanStack Query y React Hook Form + Zod.

El navegador habla con la API **en el mismo origen**: Vite (desarrollo) y nginx (imagen) redirigen `/api` y `/health` al backend. No hace falta configurar CORS.

## A. Levantar con Docker Compose

Desde la raíz del repositorio, con el stack completo:

```bash
docker compose up --build -d   # app en http://localhost:8080, API en http://localhost:8000/docs
```

El puerto se cambia con `WEB_PORT`. La imagen incluye el laboratorio de pruebas (`VITE_ENABLE_LAB=true` en `compose.yaml`).

## B. Desarrollar en el Dev Container

El Dev Container trae Node 26 y ejecuta `npm ci` al crearse. Con la API en marcha (`just dev` en `backend/`):

```bash
cd frontend
just dev   # http://localhost:5173
```

Para usar otra API: `API_URL=http://otra:8000 just dev`.

## Comandos

| Comando          | Qué hace                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `just install`   | Dependencias exactas del `package-lock.json` (`npm ci`)                                               |
| `just dev`       | Servidor de desarrollo con recarga en caliente                                                        |
| `just api-types` | Regenera `src/api/schema.d.ts` desde el `/openapi.json` de la API en marcha                           |
| `just api-check` | Falla si los tipos versionados no coinciden con el OpenAPI actual                                     |
| `just check`     | Formato (Prettier), lint (oxlint, con reglas de accesibilidad) y tipos (`tsc`) sin modificar archivos |
| `just test`      | Tests (Vitest + Testing Library)                                                                      |
| `just coverage`  | Tests con cobertura (líneas + ramas, falla bajo el 90 %); HTML en `coverage/`                         |
| `just prepare`   | format + check + coverage + build; correr antes de dar una tarea por terminada                        |

Las dependencias se añaden con `npm install <paquete>` (o `-D` para desarrollo), nunca editando `package-lock.json` a mano.

## Cliente de la API

`src/api/schema.d.ts` se genera desde el OpenAPI del backend y se versiona. Tras cambiar un endpoint en el backend, ejecuta `just api-types`: si el cambio rompe algo en el frontend, `tsc` lo señala.

```ts
import { api } from './api/client'

const { data, error } = await api.GET('/api/v1/events/{event_id}', {
    params: { path: { event_id: id } },
})
```

## Sesión, roles y errores

- **Sesión:** el token va en `sessionStorage`, que es por pestaña: abre una pestaña por cuenta para probar varios roles a la vez. Cuando la API rechaza el token (401), la sesión termina y el login explica por qué.
- **Roles:** el menú y las rutas se adaptan con `can()` (`src/lib/permissions.ts`, la tabla de docs/01 §3). Es comodidad, no protección: la API decide, y un 403 o 404 se muestra igual de bien.
- **Errores:** cada `code` de la API tiene su texto en `src/i18n/es.ts`. Los 422 van junto a su campo, los 503 se reintentan solos según `Retry-After` en las lecturas y las escrituras nunca se reintentan solas.
- **Inspector de peticiones** (icono de antena en la cabecera): las últimas 50 llamadas con estado, `code`, duración y cuerpos, sin contraseñas ni tokens.
- **Cuentas de demo:** con el laboratorio activo (siempre en `just dev`), el login ofrece entrar con un clic en las cuentas de `just seed`.

## Estructura

```text
frontend/
├── src/
│   ├── api/              # schema.d.ts (generado), cliente con middleware (auth + inspector), errores
│   ├── components/       # ui/ (shadcn, generado: no se edita a mano salvo textos), layout/ y piezas compartidas
│   ├── features/<área>/  # auth, home, inspector… una carpeta por área de la app
│   ├── lib/              # permisos, QueryClient (política de reintentos), entorno
│   ├── i18n/es.ts        # textos de la UI (en español); el código va en inglés
│   ├── routes.tsx        # rutas y guardas por rol
│   └── test/             # MSW (API falsa), fixtures y renderApp()
├── Dockerfile        # build (node) → runtime (nginx sin root, puerto 8080)
├── nginx.conf        # estáticos, rutas del cliente → index.html, proxy de /api
└── justfile
```
