import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Download04Icon, File02Icon, PackageOpenIcon } from '@hugeicons/core-free-icons'
import { AppHeader, PageBody, type BackLink } from '#/components/app-shell'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'
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
      throw redirect({ href: `${artifact.base}/index.html`, reloadDocument: true })
    }
    return artifact
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? 'Artifact'} · Artifacts` }],
  }),
  notFoundComponent: () => (
    <PageBody>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={PackageOpenIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>Artifact not found</EmptyTitle>
          <EmptyDescription>It is gone or has expired.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link to="/">Back to projects</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </PageBody>
  ),
  component: Viewer,
})

function fileUrl(artifact: ArtifactView, path: string) {
  return `${artifact.base}/${path.split('/').map(encodeURIComponent).join('/')}`
}

function backLink(artifact: ArtifactView): BackLink {
  if (artifact.project) {
    return { to: '/projects/$id', params: { id: artifact.project.id }, label: 'Back to project' }
  }
  return { to: '/', label: 'Back to projects' }
}

function Viewer() {
  const { session } = Route.useRouteContext()
  const artifact = Route.useLoaderData()
  const src = fileUrl(artifact, artifact.name)

  return (
    <>
      <AppHeader
        width="wide"
        title={artifact.name}
        subtitle={artifact.project ? (artifact.project.displayName ?? artifact.project.name) : null}
        back={backLink(artifact)}
        user={session.user}
        actions={
          <Button variant="outline" asChild>
            <a href={`${src}?download`}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
              Download
            </a>
          </Button>
        }
      />
      <PageBody width="wide">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="capitalize">
            {artifact.kind}
          </Badge>
          <span>{formatBytes(artifact.size)}</span>
          <span aria-hidden="true">·</span>
          <span>Uploaded {formatDate(artifact.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <span>Expires {formatDate(artifact.expiresAt)}</span>
        </div>
        <Preview artifact={artifact} src={src} />
      </PageBody>
    </>
  )
}

function Preview({ artifact, src }: { artifact: ArtifactView; src: string }) {
  switch (artifact.kind) {
    case 'image':
      return (
        <div className="flex justify-center rounded-lg bg-muted/50 p-2 ring-1 ring-foreground/10">
          <img src={src} alt={artifact.name} className="max-h-[80svh] max-w-full rounded-md" />
        </div>
      )
    case 'video':
      return (
        <video
          src={src}
          controls
          playsInline
          className="max-h-[80svh] w-full rounded-lg bg-black"
        />
      )
    case 'page':
      return (
        <iframe
          src={src}
          title={artifact.name}
          sandbox="allow-scripts"
          className="h-[80svh] w-full rounded-lg bg-white ring-1 ring-foreground/10"
        />
      )
    case 'bundle':
      return (
        <ItemGroup className="gap-0 divide-y overflow-hidden rounded-lg border">
          {artifact.files.map((file) => (
            <Item key={file.path} size="sm" className="rounded-none" asChild>
              <a href={fileUrl(artifact, file.path)}>
                <ItemMedia variant="icon">
                  <HugeiconsIcon icon={File02Icon} strokeWidth={2} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="font-mono font-normal">{file.path}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatBytes(file.size)}
                  </span>
                </ItemActions>
              </a>
            </Item>
          ))}
        </ItemGroup>
      )
    default:
      return (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={File02Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No preview for this file</EmptyTitle>
            <EmptyDescription>Use Download to open it on your device.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
  }
}
