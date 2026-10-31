import { TriangleAlert } from 'lucide-react'
import { useRouteError } from 'react-router'
import { StatePanel } from '@/components/state-panel'
import { es } from '@/i18n/es'

/** Shown instead of a screen that crashed while rendering; the shell stays usable. */
export function RouteErrorPage() {
  // Logged for developers; the user gets a plain explanation and a way out.
  console.error(useRouteError())
  return (
    <StatePanel
      icon={TriangleAlert}
      title={es.crash.title}
      description={es.crash.description}
      action={{ label: es.crash.reload, onClick: () => location.reload() }}
    />
  )
}
