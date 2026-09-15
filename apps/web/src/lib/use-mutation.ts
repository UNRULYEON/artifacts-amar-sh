import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

// Runs a request, then reloads route data. Errors stay in state for the form.
export function useMutation() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function mutate(run: () => Promise<unknown>, { reload = true } = {}) {
    setBusy(true)
    setError(null)
    try {
      await run()
      if (reload) await router.invalidate()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      return false
    } finally {
      setBusy(false)
    }
  }

  return { mutate, error, busy }
}
