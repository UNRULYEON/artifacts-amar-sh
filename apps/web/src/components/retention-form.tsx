import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { FormError } from '#/components/form-error'
import { Button } from '#/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '#/components/ui/input-group'
import { Spinner } from '#/components/ui/spinner'
import { api } from '#/lib/api'
import { useMutation } from '#/lib/use-mutation'

const DAY = 86400

export function RetentionForm({ defaultTtlSeconds }: { defaultTtlSeconds: number | null }) {
  const [days, setDays] = useState(
    defaultTtlSeconds === null ? '' : String(defaultTtlSeconds / DAY),
  )
  const { mutate, error, busy } = useMutation()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ttl = days.trim() === '' ? null : Math.round(Number(days) * DAY)
    const ok = await mutate(() =>
      api('/api/settings', { method: 'PATCH', body: JSON.stringify({ defaultTtlSeconds: ttl }) }),
    )
    if (ok)
      toast.success(ttl === null ? 'Retention reset to 30 days.' : `Retention set to ${days} days.`)
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="default-ttl">Default retention</FieldLabel>
          <div className="flex gap-2">
            <InputGroup className="max-w-40">
              <InputGroupInput
                id="default-ttl"
                type="number"
                inputMode="numeric"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="30"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>days</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <Button type="submit" variant="outline" disabled={busy}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              Save
            </Button>
          </div>
          <FieldDescription>Empty means 30 days. Max 90.</FieldDescription>
        </Field>
        <FormError error={error} />
      </FieldGroup>
    </form>
  )
}
