import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeftRightIcon,
  BrowserIcon,
  Delete02Icon,
  File02Icon,
  Image01Icon,
  Link04Icon,
  MoreHorizontalIcon,
  Video01Icon,
  Zip01Icon,
} from '@hugeicons/core-free-icons'
import { useState } from 'react'
import { toast } from 'sonner'
import type { ArtifactSummary } from '@artifacts/api'
import { ConfirmDialog } from '#/components/confirm-dialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'
import { api } from '#/lib/api'
import { formatBytes, formatDate, formatExpiry } from '#/lib/format'

const kindIcons: Record<ArtifactSummary['kind'], typeof File02Icon> = {
  image: Image01Icon,
  video: Video01Icon,
  page: BrowserIcon,
  bundle: Zip01Icon,
  compare: ArrowLeftRightIcon,
  file: File02Icon,
}

export function ArtifactList({ artifacts }: { artifacts: ArtifactSummary[] }) {
  if (artifacts.length === 0) return null
  return (
    <ItemGroup className="gap-0 divide-y overflow-hidden rounded-lg border">
      {artifacts.map((artifact) => (
        <ArtifactRow key={artifact.id} artifact={artifact} />
      ))}
    </ItemGroup>
  )
}

function ArtifactRow({ artifact }: { artifact: ArtifactSummary }) {
  const [confirm, setConfirm] = useState(false)

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/a/${artifact.id}`)
      toast.success('Link copied.')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  return (
    <Item className="relative rounded-none hover:bg-muted/50 active:bg-muted">
      <ItemMedia variant="icon">
        <HugeiconsIcon icon={kindIcons[artifact.kind]} strokeWidth={2} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <Link
            to="/a/$id"
            params={{ id: artifact.id }}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {artifact.name}
          </Link>
        </ItemTitle>
        <ItemDescription>
          {formatBytes(artifact.size)} · {formatDate(artifact.createdAt)} · by {artifact.uploadedBy}{' '}
          · expires {formatExpiry(artifact.expiresAt)}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="relative">
        <Badge variant="outline" className="hidden capitalize sm:inline-flex">
          {artifact.kind}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${artifact.name}`}>
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={copyUrl}>
                <HugeiconsIcon icon={Link04Icon} strokeWidth={2} />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete "${artifact.name}"?`}
        description="The link stops working now. The bytes are removed on the next cleanup."
        action="Delete"
        run={() => api(`/api/artifacts/${artifact.id}`, { method: 'DELETE' })}
        onDone={() => toast.success(`Deleted "${artifact.name}".`)}
      />
    </Item>
  )
}
