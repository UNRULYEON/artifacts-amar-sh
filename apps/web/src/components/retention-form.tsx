import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
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
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Label htmlFor="default-ttl">Default retention in days</Label>
      <div className="flex gap-2">
        <Input
          id="default-ttl"
          type="number"
          min={1}
          max={90}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="30"
          className="max-w-32"
        />
        <Button type="submit" variant="outline" disabled={busy}>
          Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Used when an upload and its project set no retention. Empty means 30 days. Max 90.
      </p>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
