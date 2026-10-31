import { Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { StatePanel } from '@/components/state-panel'
import { es } from '@/i18n/es'

export function ComingSoonPage({
  title,
  phase,
}: {
  title: string
  phase: number
}) {
  return (
    <>
      <PageHeader title={title} />
      <StatePanel
        icon={Sparkles}
        title={es.comingSoon.title}
        description={es.comingSoon.description(phase)}
        heading="h2"
      />
    </>
  )
}
