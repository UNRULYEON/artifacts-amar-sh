import { useRouter } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { MoreHorizontalIcon } from '@hugeicons/core-free-icons'
import { useState, type FormEvent } from 'react'
import type { Project } from '@artifacts/api'
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
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { api } from '#/lib/api'

const DAY = 86400

function ttlLabel(ttlSeconds: number | null) {
  if (ttlSeconds === null) return 'Default retention'
  const days = ttlSeconds / DAY
  return Number.isInteger(days) ? `${days} day${days === 1 ? '' : 's'}` : `${ttlSeconds} s`
}

function daysToSeconds(value: string) {
  if (value.trim() === '') return null
  return Math.round(Number(value) * DAY)
}

function useMutation() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function mutate(run: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await run()
      await router.invalidate()
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

export function CreateProjectForm() {
  const [name, setName] = useState('')
  const { mutate, error, busy } = useMutation()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ok = await mutate(() =>
      api('/api/projects', { method: 'POST', body: JSON.stringify({ name }) }),
    )
    if (ok) setName('')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="new-project"
          aria-label="Project name"
          aria-invalid={error ? true : undefined}
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
        <Button type="submit" disabled={busy || name === ''}>
          Create
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">No projects yet. Create one above.</p>
  }
  return (
    <ul className="divide-y divide-border rounded-lg ring-1 ring-foreground/10">
      {projects.map((project) => (
        <ProjectRow key={project.id} project={project} />
      ))}
    </ul>
  )
}

function ProjectRow({ project }: { project: Project }) {
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{project.displayName ?? project.name}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">{project.name}</span>
      </div>
      <span className="hidden text-xs text-muted-foreground sm:block">
        {ttlLabel(project.ttlSeconds)}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${project.name}`}>
            <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('edit')}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditProjectDialog
        project={project}
        open={dialog === 'edit'}
        onClose={() => setDialog(null)}
      />
      <DeleteProjectDialog
        project={project}
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
      />
    </li>
  )
}

interface ProjectDialogProps {
  project: Project
  open: boolean
  onClose: () => void
}

function EditProjectDialog({ project, open, onClose }: ProjectDialogProps) {
  const { mutate, error, busy } = useMutation()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const displayName = String(form.get('displayName')).trim()
    const ok = await mutate(() =>
      api(`/api/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: String(form.get('name')),
          displayName: displayName === '' ? null : displayName,
          ttlSeconds: daysToSeconds(String(form.get('ttlDays'))),
        }),
      }),
    )
    if (ok) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>The name is the slug you use in uploads.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`name-${project.id}`}>Name</Label>
            <Input
              id={`name-${project.id}`}
              name="name"
              defaultValue={project.name}
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`display-${project.id}`}>Display name</Label>
            <Input
              id={`display-${project.id}`}
              name="displayName"
              defaultValue={project.displayName ?? ''}
              placeholder={project.name}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`ttl-${project.id}`}>Retention in days</Label>
            <Input
              id={`ttl-${project.id}`}
              name="ttlDays"
              type="number"
              min={1}
              max={90}
              defaultValue={project.ttlSeconds === null ? '' : project.ttlSeconds / DAY}
              placeholder="Default"
            />
          </div>
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteProjectDialog({ project, open, onClose }: ProjectDialogProps) {
  const { mutate, error, busy } = useMutation()

  async function confirm() {
    const ok = await mutate(() => api(`/api/projects/${project.id}`, { method: 'DELETE' }))
    if (ok) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {project.displayName ?? project.name}?</DialogTitle>
          <DialogDescription>
            All artifacts in this project are removed on the next cleanup. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={busy}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
