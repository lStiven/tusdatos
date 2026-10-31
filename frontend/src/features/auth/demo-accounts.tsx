import { FlaskConical } from 'lucide-react'
import { es } from '@/i18n/es'

const PASSWORD = 'demo1234'
const accounts = Object.entries(es.auth.demoAccounts)

/** Accounts from `just seed` (backend/README.md); only in builds with the lab. */
export function DemoAccounts({
  onPick,
  disabled,
}: {
  onPick: (email: string, password: string) => void
  disabled: boolean
}) {
  return (
    <section
      aria-labelledby="demo-accounts"
      className="rounded-xl border border-dashed p-4"
    >
      <h2
        id="demo-accounts"
        className="flex items-center gap-2 text-sm font-medium"
      >
        <FlaskConical aria-hidden className="size-4 text-primary" />
        {es.auth.demoTitle}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{es.auth.demoHint}</p>
      <ul className="mt-3 grid gap-1.5">
        {accounts.map(([name, description]) => (
          <li key={name}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(`${name}@demo.example.com`, PASSWORD)}
              className="flex w-full items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-all duration-200 outline-none hover:translate-x-0.5 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <span className="font-medium capitalize">{name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {description}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
