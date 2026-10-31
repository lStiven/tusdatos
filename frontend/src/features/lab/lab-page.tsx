import { FlaskConical, TriangleAlert } from 'lucide-react'
import { useCallback } from 'react'
import { PageHeader } from '@/components/page-header'
import { StatePanel } from '@/components/state-panel'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCurrentUser } from '@/features/auth/api'
import { getToken } from '@/features/auth/session'
import { es } from '@/i18n/es'
import { hasRole } from '@/lib/permissions'
import { RaceCard } from './race-card'
import type { RaceId } from './races'
import { ScenarioCard } from './scenario-card'
import { scenarios, type ScenarioId } from './scenarios'
import { LAB_DOMAIN, newStamp } from './setup'

const l = es.lab
const raceIds: RaceId[] = ['lastSeat', 'retries', 'sameRoom']

export function LabPage() {
  const { data: user } = useCurrentUser()
  // Fresh accounts on every run; the admin token only grants roles.
  const env = useCallback(
    () => ({ adminToken: getToken() ?? '', stamp: newStamp() }),
    [],
  )

  if (user && !hasRole(user, 'ADMIN')) {
    return (
      <>
        <PageHeader title={l.title} />
        <StatePanel
          icon={FlaskConical}
          title={l.adminOnlyTitle}
          description={l.adminOnlyDescription}
          heading="h2"
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={l.title} description={l.subtitle} />
      <Alert className="mb-8 border-warning/40 bg-warning-soft text-warning">
        <TriangleAlert aria-hidden />
        <AlertDescription className="text-warning">
          {l.dataWarning(LAB_DOMAIN)}
        </AlertDescription>
      </Alert>

      <section aria-labelledby="lab-scenarios" className="mb-10 space-y-4">
        <div className="space-y-1">
          <h2 id="lab-scenarios" className="font-heading text-xl font-semibold">
            {l.scenariosTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{l.scenariosHint}</p>
        </div>
        {(Object.keys(scenarios) as ScenarioId[]).map((id) => (
          <ScenarioCard key={id} id={id} env={env} />
        ))}
      </section>

      <section aria-labelledby="lab-races" className="space-y-4">
        <div className="space-y-1">
          <h2 id="lab-races" className="font-heading text-xl font-semibold">
            {l.racesTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{l.racesHint}</p>
        </div>
        <div className="space-y-4">
          {raceIds.map((id) => (
            <RaceCard key={id} id={id} env={env} />
          ))}
        </div>
      </section>
    </>
  )
}
