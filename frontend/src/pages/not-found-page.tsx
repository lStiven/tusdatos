import { MapPinOff } from 'lucide-react'
import { StatePanel } from '@/components/state-panel'
import { es } from '@/i18n/es'
import { usePageTitle } from '@/lib/use-page-title'

export function NotFoundPage() {
  usePageTitle(es.notFound.title)
  return (
    <StatePanel
      icon={MapPinOff}
      title={es.notFound.title}
      description={es.notFound.description}
      action={{ label: es.notFound.back, to: '/' }}
    />
  )
}
