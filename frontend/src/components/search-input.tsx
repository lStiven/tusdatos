import { Search } from 'lucide-react'
import { useEffect, useEffectEvent, useState } from 'react'
import { Input } from '@/components/ui/input'

const DEBOUNCE_MS = 300

/** Search box that reports its value once the user stops typing. */
export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  // Re-renders of the parent must not restart the wait.
  const report = useEffectEvent(onChange)

  // Follows outside changes, such as "clear filters" or going back.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => report(draft), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, value])

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="pl-9"
      />
    </div>
  )
}
