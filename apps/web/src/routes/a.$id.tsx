import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Download04Icon,
  File02Icon,
  Link04Icon,
  PackageOpenIcon,
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  VolumeOffIcon,
} from '@hugeicons/core-free-icons'
import type { ComparePair } from '@artifacts/api'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AppHeader, PageBody, type BackLink } from '#/components/app-shell'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Slider } from '#/components/ui/slider'
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
          <>
            {artifact.embedUrl ? <CopyEmbedLink url={artifact.embedUrl} /> : null}
            <Button variant="outline" asChild>
              <a href={`${src}?download`}>
                <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
                Download
              </a>
            </Button>
          </>
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

// The bytes link needs no login and lives until the artifact expires.
function CopyEmbedLink({ url }: { url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Embed link copied. Paste it as ![name](link) in Markdown.')
    } catch {
      toast.error('Could not copy the link.')
    }
  }
  return (
    <Button variant="outline" onClick={copy}>
      <HugeiconsIcon icon={Link04Icon} strokeWidth={2} data-icon="inline-start" />
      Embed link
    </Button>
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
    case 'compare':
      return artifact.compare ? (
        <div className="flex flex-col gap-8">
          {artifact.compare.map((pair) => (
            <PairPreview key={pair.label} artifact={artifact} pair={pair} />
          ))}
        </div>
      ) : null
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

interface Side {
  label: string
  src: string
}

function PairPreview({ artifact, pair }: { artifact: ArtifactView; pair: ComparePair }) {
  const sides: Side[] = [
    { label: 'Before', src: fileUrl(artifact, pair.before) },
    { label: 'After', src: fileUrl(artifact, pair.after) },
  ]
  return (
    <section className="flex flex-col gap-3">
      {pair.label ? <h2 className="text-sm font-semibold">{pair.label}</h2> : null}
      {pair.media === 'image' ? <ImagePair sides={sides} /> : <VideoPair sides={sides} />}
    </section>
  )
}

function SideLabel({ label }: { label: string }) {
  return <Badge variant={label === 'Before' ? 'outline' : 'secondary'}>{label}</Badge>
}

function ImagePair({ sides }: { sides: Side[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sides.map((side) => (
        <figure key={side.label} className="flex min-w-0 flex-col gap-2">
          <figcaption>
            <SideLabel label={side.label} />
          </figcaption>
          <div className="flex justify-center rounded-lg bg-muted/50 p-2 ring-1 ring-foreground/10">
            <img src={side.src} alt={side.label} className="max-h-[70svh] max-w-full rounded-md" />
          </div>
        </figure>
      ))}
    </div>
  )
}

function longest(videos: (HTMLVideoElement | null)[]) {
  return Math.max(0, ...videos.map((v) => (v && Number.isFinite(v.duration) ? v.duration : 0)))
}

function formatTime(seconds: number) {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// Two players driven by one control bar. Play, pause, and the scrubber act
// on both; the timeline spans the longer of the two.
function VideoPair({ sides }: { sides: Side[] }) {
  const refs = useRef<(HTMLVideoElement | null)[]>([])
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  function videos() {
    return refs.current.filter((v): v is HTMLVideoElement => v !== null)
  }

  function readDuration() {
    setDuration(longest(refs.current))
  }

  // Metadata can arrive before hydration, so the event above is not enough.
  useEffect(() => {
    setDuration(longest(refs.current))
  }, [])

  useEffect(() => {
    if (!playing) return
    let frame = requestAnimationFrame(function tick() {
      setTime(Math.max(0, ...refs.current.map((v) => v?.currentTime ?? 0)))
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [playing])

  function seek(value: number) {
    for (const v of videos()) {
      v.currentTime = Number.isFinite(v.duration) ? Math.min(value, v.duration) : value
    }
    setTime(value)
  }

  function play() {
    if (duration > 0 && time >= duration - 0.05) seek(0)
    setPlaying(true)
    for (const v of videos()) void v.play().catch(() => setPlaying(false))
  }

  function pause() {
    for (const v of videos()) v.pause()
    setPlaying(false)
  }

  function onEnded() {
    if (videos().every((v) => v.ended || v.paused)) {
      setPlaying(false)
      setTime(duration)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2">
        {sides.map((side, index) => (
          <figure key={side.label} className="flex min-w-0 flex-col gap-2">
            <figcaption>
              <SideLabel label={side.label} />
            </figcaption>
            <video
              ref={(el) => {
                refs.current[index] = el
              }}
              src={side.src}
              muted={muted}
              playsInline
              preload="metadata"
              onLoadedMetadata={readDuration}
              onEnded={onEnded}
              onClick={playing ? pause : play}
              className="max-h-[70svh] w-full cursor-pointer rounded-lg bg-black ring-1 ring-foreground/10"
            />
          </figure>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={playing ? pause : play}
          aria-label={playing ? 'Pause both' : 'Play both'}
        >
          <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} strokeWidth={2} />
        </Button>
        <span className="w-9 text-xs text-muted-foreground tabular-nums">{formatTime(time)}</span>
        <Slider
          aria-label="Timeline for both videos"
          value={[Math.min(time, duration)]}
          max={duration || 1}
          step={0.01}
          onValueChange={([value]) => seek(value ?? 0)}
          className="flex-1"
        />
        <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
          {formatTime(duration)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute both' : 'Mute both'}
        >
          <HugeiconsIcon icon={muted ? VolumeOffIcon : VolumeHighIcon} strokeWidth={2} />
        </Button>
      </div>
    </div>
  )
}
