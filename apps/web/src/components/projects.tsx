import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Delete02Icon,
  Folder01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PlusSignIcon,
} from '@hugeicons/core-free-icons'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Project } from '@artifacts/api'
import { ConfirmDialog } from '#/components/confirm-dialog'
import { Tip } from '#/components/tip'
import { FormError } from '#/components/form-error'
import { Badge } from '#/components/ui/badge'
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'
import { Spinner } from '#/components/ui/spinner'
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
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          defaultValue={project?.name}
          placeholder="my-project"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <FieldDescription>Lowercase letters, digits, and single dashes.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-display`}>Display name</FieldLabel>
        <Input
          id={`${idPrefix}-display`}
          name="displayName"
          defaultValue={project?.displayName ?? ''}
          placeholder="Optional"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-ttl`}>Retention in days</FieldLabel>
        <Input
          id={`${idPrefix}-ttl`}
          name="ttlDays"
          type="number"
          inputMode="numeric"
          min={1}
          max={90}
          defaultValue={project?.ttlSeconds == null ? '' : project.ttlSeconds / DAY}
          placeholder="Default"
        />
        <FieldDescription>Empty uses the default from Settings. Max 90.</FieldDescription>
      </Field>
    </FieldGroup>
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
          <FormError error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
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
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No projects yet</EmptyTitle>
          <EmptyDescription>
            Create one first. Its name is the slug that uploads point at.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <CreateProjectButton />
        </EmptyContent>
      </Empty>
    )
  }
  return (
    <ItemGroup className="gap-0 divide-y overflow-hidden rounded-lg border">
      {projects.map((project) => (
        <ProjectRow key={project.id} project={project} />
      ))}
    </ItemGroup>
  )
}

function ProjectRow({ project }: { project: Project }) {
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)

  return (
    <Item className="relative rounded-none hover:bg-muted/50 active:bg-muted">
      <ItemMedia variant="icon">
        <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <Link
            to="/projects/$id"
            params={{ id: project.id }}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {project.displayName ?? project.name}
          </Link>
        </ItemTitle>
        <ItemDescription className="font-mono">{project.name}</ItemDescription>
      </ItemContent>
      <ItemActions className="relative">
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {ttlLabel(project.ttlSeconds)}
        </Badge>
        <DropdownMenu>
          <Tip label="Actions">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${project.name}`}>
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
              </Button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => setDialog('edit')}>
                <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
      <EditProjectDialog
        project={project}
        open={dialog === 'edit'}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(next) => setDialog(next ? 'delete' : null)}
        title={`Delete ${project.displayName ?? project.name}?`}
        description="All artifacts in this project are removed on the next cleanup. This cannot be undone."
        action="Delete"
        run={() => api(`/api/projects/${project.id}`, { method: 'DELETE' })}
      />
    </Item>
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
          <FormError error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
