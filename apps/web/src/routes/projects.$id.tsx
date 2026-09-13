import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { CloudUploadIcon, Copy01Icon, FolderOpenIcon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { AppHeader, PageBody, Section } from '#/components/app-shell'
import { ArtifactList } from '#/components/artifacts'
import { Tip } from '#/components/tip'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Item, ItemActions, ItemContent } from '#/components/ui/item'
import { getProject } from '#/lib/project'
import { getSession } from '#/lib/session'

export const Route = createFileRoute('/projects/$id')({
  async beforeLoad({ params }) {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login', search: { redirect: `/projects/${params.id}` } })
    return { session }
  },
  async loader({ params }) {
    const view = await getProject({ data: params.id })
    if (!view) throw notFound()
    return view
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.project.displayName ?? loaderData?.project.name ?? 'Project'} · Artifacts`,
      },
    ],
  }),
  notFoundComponent: () => (
    <PageBody>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={FolderOpenIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>Project not found</EmptyTitle>
          <EmptyDescription>It was deleted, or the link is wrong.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link to="/">Back to projects</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </PageBody>
  ),
  component: ProjectPage,
})

function ProjectPage() {
  const { session } = Route.useRouteContext()
  const { origin, project, artifacts } = Route.useLoaderData()

  return (
    <>
      <AppHeader
        title={project.displayName ?? project.name}
        subtitle={<span className="font-mono">{project.name}</span>}
        back={{ to: '/', label: 'Back to projects' }}
        user={session.user}
      />
      <PageBody>
        <Section title="Artifacts" description="Newest first. Links need a signed-in session.">
          {artifacts.length === 0 ? (
            <EmptyState origin={origin} slug={project.name} />
          ) : (
            <ArtifactList artifacts={artifacts} />
          )}
        </Section>
      </PageBody>
    </>
  )
}

function EmptyState({ origin, slug }: { origin: string; slug: string }) {
  const command = `curl -X POST -H "Authorization: Bearer $ARTIFACTS_TOKEN" \\
  --data-binary @report.zip \\
  "${origin}/api/upload?project=${slug}&name=report.zip"`

  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      toast.success('Command copied.')
    } catch {
      toast.error('Could not copy the command.')
    }
  }

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>Nothing here yet</EmptyTitle>
        <EmptyDescription>Upload with a token from Settings, or through MCP.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-full">
        <Item variant="muted" size="sm" className="flex-nowrap items-start">
          <ItemContent className="min-w-0">
            <pre className="overflow-x-auto text-left font-mono text-xs/relaxed">{command}</pre>
          </ItemContent>
          <ItemActions>
            <Tip label="Copy command">
              <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy command">
                <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
              </Button>
            </Tip>
          </ItemActions>
        </Item>
      </EmptyContent>
    </Empty>
  )
}
