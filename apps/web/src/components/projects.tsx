import { HugeiconsIcon } from '@hugeicons/react'
import { MoreHorizontalIcon, PlusSignIcon } from '@hugeicons/core-free-icons'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Project } from '@artifacts/api'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
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
import { useMutation } from '#/lib/use-mutation'

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

function readProjectForm(form: FormData) {
  const displayName = String(form.get('displayName')).trim()
  return {
    name: String(form.get('name')),
    displayName: displayName === '' ? null : displayName,
    ttlSeconds: daysToSeconds(String(form.get('ttlDays'))),
  }
}

function ProjectFields({ project, idPrefix }: { project?: Project; idPrefix: string }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          defaultValue={project?.name}
          placeholder="my-project"
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-display`}>Display name</Label>
        <Input
          id={`${idPrefix}-display`}
          name="displayName"
          defaultValue={project?.displayName ?? ''}
          placeholder="Optional"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-ttl`}>Retention in days</Label>
        <Input
          id={`${idPrefix}-ttl`}
          name="ttlDays"
          type="number"
          min={1}
          max={90}
          defaultValue={project?.ttlSeconds == null ? '' : project.ttlSeconds / DAY}
          placeholder="Default"
        />
      </div>
    </>
  )
}

export function CreateProjectButton() {
  const [open, setOpen] = useState(false)
  const { mutate, error, busy } = useMutation()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = readProjectForm(new FormData(event.currentTarget))
    const ok = await mutate(() =>
      api('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
    )
    if (ok) {
      setOpen(false)
      toast.success(`Project "${input.displayName ?? input.name}" created.`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>The name is the slug you use in uploads.</DialogDescription>
          </DialogHeader>
          <ProjectFields idPrefix="new" />
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">No projects yet.</p>
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
    const input = readProjectForm(new FormData(event.currentTarget))
    const ok = await mutate(() =>
      api(`/api/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify(input) }),
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
          <ProjectFields project={project} idPrefix={project.id} />
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
