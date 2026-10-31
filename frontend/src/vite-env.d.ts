/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `true` to include the test lab in a production build (always on in `vite dev`). */
  readonly VITE_ENABLE_LAB?: string
  /** Swagger UI of the API; it is not proxied, so it keeps its own origin. */
  readonly VITE_API_DOCS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
