export const labEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_LAB === 'true'

export const apiDocsUrl =
  import.meta.env.VITE_API_DOCS_URL ?? 'http://localhost:8000/docs'
