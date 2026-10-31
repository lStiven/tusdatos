import { useEffect } from 'react'
import { es } from '@/i18n/es'

/** Each page announces itself in the tab title (and to screen readers on navigation). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${es.app.name}`
  }, [title])
}
