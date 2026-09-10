import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, Download04Icon } from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button'
import { UserMenu } from '#/components/user-menu'
import { getArtifact, type ArtifactView } from '#/lib/artifacts'
import { formatBytes, formatDate } from '#/lib/format'
import { getSession } from '#/lib/session'

export const Route = createFileRoute('/a/$id')({
  async beforeLoad({ params }) {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login', search: { redirect: `/a/${params.id}` } })
    return { session }
  },
  async loader({ params }) {
    const artifact = await getArtifact({ data: params.id })
    if (!artifact) throw notFound()
    // Reports open as a site under the signed prefix.
    if (artifact.kind === 'bundle' && artifact.hasIndex) {
      throw redirect({ href: `${artifact.base}/index.html` })
    }
    return artifact
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? 'Artifact'} · Artifacts` }],
  }),
  notFoundComponent: () => (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">This artifact is gone or has expired.</p>
      <Link to="/" className="text-sm underline">
        Back to projects
      </Link>
    </main>
  ),
  component: Viewer,
})

function fileUrl(artifact: ArtifactView, path: string) {
  return `${artifact.base}/${path.split('/').map(encodeURIComponent).join('/')}`
}

function Viewer() {
  const { session } = Route.useRouteContext()
  const artifact = Route.useLoaderData()
  const src = fileUrl(artifact, artifact.name)

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            {artifact.project ? (
              <Link
                to="/projects/$id"
                params={{ id: artifact.project.id }}
                aria-label="Back to project"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
              </Link>
            ) : (
              <Link to="/" aria-label="Back to projects">
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
              </Link>
            )}
          </Button>
          <h1 className="truncate text-xl font-semibold">{artifact.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <a href={`${src}?download`}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
              Download
            </a>
          </Button>
          <UserMenu user={session.user} />
        </div>
      </header>

      <p className="text-xs text-muted-foreground">
        {artifact.project ? `${artifact.project.displayName ?? artifact.project.name} · ` : ''}
        {formatBytes(artifact.size)} · uploaded {formatDate(artifact.createdAt)} · expires{' '}
        {formatDate(artifact.expiresAt)}
      </p>

      <Preview artifact={artifact} src={src} />
    </main>
  )
}

function Preview({ artifact, src }: { artifact: ArtifactView; src: string }) {
  switch (artifact.kind) {
    case 'image':
      return (
        <img
          src={src}
          alt={artifact.name}
          className="max-h-[80vh] w-fit max-w-full rounded-lg ring-1 ring-foreground/10"
        />
      )
    case 'video':
      return <video src={src} controls className="max-h-[80vh] w-full rounded-lg bg-black" />
    case 'page':
      return (
        <iframe
          src={src}
          title={artifact.name}
          sandbox="allow-scripts"
          className="h-[80vh] w-full rounded-lg bg-white ring-1 ring-foreground/10"
        />
      )
    case 'bundle':
      return (
        <ul className="divide-y divide-border rounded-lg ring-1 ring-foreground/10">
          {artifact.files.map((file) => (
            <li key={file.path} className="flex items-center gap-4 px-4 py-2 text-sm">
              <a
                href={fileUrl(artifact, file.path)}
                className="min-w-0 flex-1 truncate font-mono hover:underline"
              >
                {file.path}
              </a>
              <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
      )
    default:
      return (
        <p className="text-sm text-muted-foreground">No preview for this file. Use Download.</p>
      )
  }
}
