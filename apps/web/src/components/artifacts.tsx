import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { MoreHorizontalIcon } from '@hugeicons/core-free-icons'
import { useState } from 'react'
import { toast } from 'sonner'
import type { ArtifactSummary } from '@artifacts/api'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { api } from '#/lib/api'
import { formatBytes, formatDate, formatExpiry } from '#/lib/format'
import { useMutation } from '#/lib/use-mutation'

export function ArtifactList({ artifacts }: { artifacts: ArtifactSummary[] }) {
  if (artifacts.length === 0) return null
  return (
    <ul className="divide-y divide-border rounded-lg ring-1 ring-foreground/10">
      {artifacts.map((artifact) => (
        <ArtifactRow key={artifact.id} artifact={artifact} />
      ))}
    </ul>
  )
}

function ArtifactRow({ artifact }: { artifact: ArtifactSummary }) {
  const [confirm, setConfirm] = useState(false)
  const { mutate, error, busy } = useMutation()

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/a/${artifact.id}`)
      toast.success('Link copied.')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  async function remove() {
    const ok = await mutate(() => api(`/api/artifacts/${artifact.id}`, { method: 'DELETE' }))
    if (ok) {
      setConfirm(false)
      toast.success(`Deleted "${artifact.name}".`)
    }
  }

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <span className="w-14 shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-center text-[0.625rem] font-medium uppercase text-muted-foreground">
        {artifact.kind}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to="/a/$id"
          params={{ id: artifact.id }}
          className="truncate text-sm font-medium hover:underline"
        >
          {artifact.name}
        </Link>
        <span className="truncate text-xs text-muted-foreground">
          {formatBytes(artifact.size)} · {formatDate(artifact.createdAt)} · by {artifact.uploadedBy}{' '}
          · expires {formatExpiry(artifact.expiresAt)}
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${artifact.name}`}>
            <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={copyUrl}>Copy link</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{artifact.name}"?</DialogTitle>
            <DialogDescription>
              The link stops working now. The bytes are removed on the next cleanup.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={remove} disabled={busy}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}
