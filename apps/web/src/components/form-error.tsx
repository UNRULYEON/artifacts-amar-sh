import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'
import { Alert, AlertDescription } from '#/components/ui/alert'

export function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}
