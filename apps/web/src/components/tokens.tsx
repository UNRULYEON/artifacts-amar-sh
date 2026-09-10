import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, PlusSignIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Token } from '@artifacts/api'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { api } from '#/lib/api'
import { formatDate } from '#/lib/format'
import { useMutation } from '#/lib/use-mutation'

type Created = Token & { token: string }

export function CreateTokenButton() {
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)
  const { mutate, error, busy } = useMutation()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('name'))
    let result: Created | null = null
    const ok = await mutate(async () => {
      result = await api<Created>('/api/tokens', { method: 'POST', body: JSON.stringify({ name }) })
    })
    if (ok && result) {
      setCreated(result)
      toast.success(`Token "${name}" created.`)
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setCreated(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
          New token
        </Button>
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Token "{created.name}"</DialogTitle>
              <DialogDescription>
                Copy it now. It is shown once and cannot be recovered.
              </DialogDescription>
            </DialogHeader>
            <SecretField secret={created.token} />
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New token</DialogTitle>
              <DialogDescription>
                Tokens can upload to every project. Name it after where it lives.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="token-name">Name</Label>
              <Input id="token-name" name="name" placeholder="github-ci" required autoFocus />
            </div>
            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Create
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SecretField({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.')
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={secret}
        className="font-mono"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copy token">
        <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} strokeWidth={2} />
      </Button>
    </div>
  )
}

export function TokenList({ tokens }: { tokens: Token[] }) {
  if (tokens.length === 0) {
    return <p className="text-sm text-muted-foreground">No tokens yet.</p>
  }
  return (
    <ul className="divide-y divide-border rounded-lg ring-1 ring-foreground/10">
      {tokens.map((token) => (
        <TokenRow key={token.id} token={token} />
      ))}
    </ul>
  )
}

function TokenRow({ token }: { token: Token }) {
  const [open, setOpen] = useState(false)
  const { mutate, error, busy } = useMutation()

  async function revoke() {
    const ok = await mutate(() => api(`/api/tokens/${token.id}`, { method: 'DELETE' }))
    if (ok) {
      setOpen(false)
      toast.success(`Token "${token.name}" revoked.`)
    }
  }

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{token.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          Created {formatDate(token.createdAt)}. Last used{' '}
          {token.lastUsedAt ? formatDate(token.lastUsedAt) : 'never'}.
        </span>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Revoke
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke "{token.name}"?</DialogTitle>
            <DialogDescription>
              Uploads with this token fail from now on. Other tokens are not affected.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={revoke} disabled={busy}>
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}
