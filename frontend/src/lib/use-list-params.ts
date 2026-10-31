import { useSearchParams } from 'react-router'

/**
 * List state kept in the URL, so it can be shared and "back" restores it:
 * `estado` (one of `statuses`, else `null`) and `desde` (the page offset).
 */
export function useListParams<T extends string>(statuses: readonly T[]) {
  const [params, setParams] = useSearchParams()
  const raw = params.get('estado')
  const status = statuses.includes(raw as T) ? (raw as T) : null
  const offset = Math.max(Number(params.get('desde')) || 0, 0)

  function setOffset(next: number) {
    const query = new URLSearchParams(params)
    if (next > 0) query.set('desde', String(next))
    else query.delete('desde')
    setParams(query, { preventScrollReset: true })
  }

  return { params, setParams, status, offset, setOffset }
}
