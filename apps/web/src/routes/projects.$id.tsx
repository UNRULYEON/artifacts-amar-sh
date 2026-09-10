import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { ArtifactList } from '#/components/artifacts'
import { Button } from '#/components/ui/button'
import { UserMenu } from '#/components/user-menu'
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
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <Link to="/" className="text-sm underline">
        Back to projects
      </Link>
    </main>
  ),
  component: ProjectPage,
})

function ProjectPage() {
  const { session } = Route.useRouteContext()
  const { origin, project, artifacts } = Route.useLoaderData()

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back to projects">
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-xl font-semibold">
              {project.displayName ?? project.name}
            </h1>
            <span className="truncate font-mono text-xs text-muted-foreground">{project.name}</span>
          </div>
        </div>
        <UserMenu user={session.user} />
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Artifacts</h2>
        {artifacts.length === 0 ? <EmptyState origin={origin} slug={project.name} /> : null}
        <ArtifactList artifacts={artifacts} />
      </section>
    </main>
  )
}

function EmptyState({ origin, slug }: { origin: string; slug: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg px-4 py-4 ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">
        Nothing here yet. Upload with a token from Settings:
      </p>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
        {`curl -X POST -H "Authorization: Bearer $ARTIFACTS_TOKEN" \\
  --data-binary @report.zip \\
  "${origin}/api/upload?project=${slug}&name=report.zip"`}
      </pre>
    </div>
  )
}
