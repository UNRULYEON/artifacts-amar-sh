import type { MouseEvent, ReactNode } from 'react'
import { FormError } from '#/components/form-error'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Spinner } from '#/components/ui/spinner'
import { useMutation } from '#/lib/use-mutation'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: ReactNode
  title: ReactNode
  description: ReactNode
  action: string
  run: () => Promise<unknown>
  onDone?: () => void
}

// A destructive confirmation. The dialog stays open while the request runs
// and shows the error in place when it fails.
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  action,
  run,
  onDone,
}: ConfirmDialogProps) {
  const { mutate, error, busy } = useMutation()

  async function confirm(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    const ok = await mutate(run)
    if (ok) {
      onOpenChange(false)
      onDone?.()
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <FormError error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={confirm}>
            {busy ? <Spinner data-icon="inline-start" /> : null}
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
