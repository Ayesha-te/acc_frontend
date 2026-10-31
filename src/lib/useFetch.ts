import { DependencyList, useCallback, useEffect, useState } from 'react'

/** Loads data when deps change; ignores stale responses so a slow earlier request can never overwrite a newer one. */
export function useFetch<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setLoading(true)
    load()
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(e.message ?? 'Something went wrong'))
      .finally(() => live && setLoading(false))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}
