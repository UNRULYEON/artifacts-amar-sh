import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeftRightIcon,
  Download04Icon,
  File02Icon,
  Link04Icon,
  LinkSquare02Icon,
  PackageOpenIcon,
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  VolumeOffIcon,
} from '@hugeicons/core-free-icons'
import type { ComparePair } from '@artifacts/api'
import { cn } from 'cn'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AppHeader, PageBody, type BackLink } from '#/components/app-shell'
import { IconSwap } from '#/components/icon-swap'
import { Tip } from '#/components/tip'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
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
  // A report keeps the app bar, so an installed app always has a way back.
  const report =
    artifact.kind === 'bundle' && artifact.hasIndex ? `${artifact.base}/index.html` : null

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
            {report ? (
              <Button variant="outline" asChild>
                <a href={report} target="_blank" rel="noreferrer">
                  <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} data-icon="inline-start" />
                  Open
                </a>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <a href={`${src}?download`}>
                <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
                Download
              </a>
            </Button>
          </>
        }
      />
      {report ? (
        <iframe
          src={report}
          title={artifact.name}
          sandbox="allow-scripts allow-popups allow-downloads allow-forms"
          className="block h-[calc(100svh-var(--header-height))] w-full bg-white"
        />
      ) : (
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
      )}
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
  const diff = pair.diff ? fileUrl(artifact, pair.diff) : null
  const snapshot = pair.snapshot ? fileUrl(artifact, pair.snapshot) : null
  const [view, setView] = useState<'side' | 'swipe'>('side')
  return (
    <section className="flex flex-col gap-3">
      {pair.label || pair.media === 'image' ? (
        <div className="flex h-7 items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{pair.label}</h2>
          {pair.media === 'image' ? (
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'side', label: 'Side by side' },
                { value: 'swipe', label: 'Swipe', tip: 'Drag to reveal the after image' },
              ]}
            />
          ) : null}
        </div>
      ) : null}
      {pair.media === 'video' ? (
        <VideoPair sides={sides} />
      ) : view === 'side' ? (
        <ImagePair sides={sides} diff={diff} />
      ) : (
        <SwipePair sides={sides} />
      )}
      {snapshot ? <SnapshotDiff src={snapshot} /> : null}
    </section>
  )
}

function SideLabel({ label }: { label: string }) {
  return <Badge variant={label === 'Before' ? 'outline' : 'secondary'}>{label}</Badge>
}

interface Option<T> {
  value: T
  label: string
  tip?: string
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border bg-card p-0.5">
      {options.map((option) => {
        const button = (
          <Button
            key={option.value}
            size="xs"
            variant={option.value === value ? 'secondary' : 'ghost'}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        )
        return option.tip ? (
          <Tip key={option.value} label={option.tip}>
            {button}
          </Tip>
        ) : (
          button
        )
      })}
    </div>
  )
}

const stacked = 'max-h-[70svh] max-w-full rounded-md [grid-area:1/1]'
const fade = `${stacked} transition-opacity [transition-duration:var(--duration-fast)] [transition-timing-function:var(--ease-in-out)] motion-reduce:transition-none`

// The after slot can swap to the diff image, so the eye stays in one place.
function ImagePair({ sides, diff }: { sides: Side[]; diff: string | null }) {
  const [showDiff, setShowDiff] = useState(false)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sides.map((side) => {
        const swappable = diff !== null && side.label === 'After'
        return (
          <figure key={side.label} className="flex min-w-0 flex-col gap-2">
            <figcaption className="flex h-7 items-center">
              {swappable ? (
                <Segmented
                  label="After view"
                  value={showDiff ? 'diff' : 'after'}
                  onChange={(v) => setShowDiff(v === 'diff')}
                  options={[
                    { value: 'after', label: 'After' },
                    { value: 'diff', label: 'Diff', tip: 'Changed pixels in red' },
                  ]}
                />
              ) : (
                <SideLabel label={side.label} />
              )}
            </figcaption>
            <div className="flex justify-center rounded-lg bg-muted/50 p-2 ring-1 ring-foreground/10">
              {swappable ? (
                <div className="grid">
                  <img
                    src={side.src}
                    alt="After"
                    className={fade}
                    style={{ opacity: showDiff ? 0 : 1 }}
                  />
                  <img
                    src={diff}
                    alt="Diff"
                    className={fade}
                    style={{ opacity: showDiff ? 1 : 0 }}
                  />
                </div>
              ) : (
                <img
                  src={side.src}
                  alt={side.label}
                  className="max-h-[70svh] max-w-full rounded-md"
                />
              )}
            </div>
          </figure>
        )
      })}
    </div>
  )
}

// Before and after in one frame. The after image is clipped at the handle;
// drag on the image or use the slider below it.
function SwipePair({ sides }: { sides: Side[] }) {
  const [before, after] = sides as [Side, Side]
  const [position, setPosition] = useState(50)
  const frame = useRef<HTMLDivElement>(null)

  function track(event: React.PointerEvent) {
    const rect = frame.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    setPosition(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center rounded-lg bg-muted/50 p-2 ring-1 ring-foreground/10">
        <div
          ref={frame}
          className="relative grid cursor-col-resize touch-none select-none"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            track(event)
          }}
          onPointerMove={(event) => {
            if (event.buttons) track(event)
          }}
        >
          <img src={before.src} alt="Before" draggable={false} className={stacked} />
          <img
            src={after.src}
            alt="After"
            draggable={false}
            className={stacked}
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          />
          <div className="pointer-events-none absolute top-2 left-2">
            <Badge variant="secondary">Before</Badge>
          </div>
          <div className="pointer-events-none absolute top-2 right-2">
            <Badge variant="secondary">After</Badge>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-background shadow-[0_0_0_1px_var(--color-foreground)]"
            style={{ left: `${position}%` }}
          >
            <div className="absolute top-1/2 left-1/2 flex size-7 -translate-1/2 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-foreground shadow-md">
              <HugeiconsIcon icon={ArrowLeftRightIcon} strokeWidth={2} className="size-3.5" />
            </div>
          </div>
        </div>
      </div>
      <Slider
        aria-label="Reveal the after image"
        value={[position]}
        max={100}
        step={0.5}
        onValueChange={([value]) => setPosition(value ?? 50)}
      />
    </div>
  )
}

function diffLineClass(line: string) {
  if (
    line.startsWith('+++') ||
    line.startsWith('---') ||
    line.startsWith('@@') ||
    line.startsWith('\\')
  ) {
    return 'text-muted-foreground'
  }
  if (line.startsWith('+')) return 'bg-green-500/10 text-green-700 dark:text-green-400'
  if (line.startsWith('-')) return 'bg-destructive/10 text-destructive'
  return ''
}

// The accessibility tree diff from agent-browser, as a unified diff. The
// summary line at the end is lifted into the heading.
function SnapshotDiff({ src }: { src: string }) {
  const [text, setText] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    fetch(src)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(res.statusText))))
      .then((body) => {
        if (live) setText(body)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [src])

  if (failed) return null
  if (text === null) return <Skeleton className="h-10 w-full rounded-lg" />
  const lines = text.replace(/\n+$/, '').split('\n')
  const summary = /^\d+ additions?, \d+ removals?/.test(lines.at(-1) ?? '') ? lines.pop() : null
  // Lines repeat, so the position is part of the key; the list never reorders.
  const rows = lines.map((line, position) => ({ line, key: `${position}:${line}` }))
  return (
    <details className="rounded-lg border bg-card">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs select-none">
        <span className="font-medium">Accessibility tree diff</span>
        {summary ? <span className="text-muted-foreground">{summary}</span> : null}
      </summary>
      <pre className="overflow-x-auto border-t px-3 py-2 font-mono text-xs leading-5">
        {rows.map((row) => (
          <span key={row.key} className={cn('block px-1 -mx-1', diffLineClass(row.line))}>
            {row.line || ' '}
          </span>
        ))}
      </pre>
    </details>
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
        <Tip label={playing ? 'Pause both' : 'Play both'}>
          <Button
            variant="ghost"
            size="icon"
            onClick={playing ? pause : play}
            aria-label={playing ? 'Pause both' : 'Play both'}
          >
            <IconSwap state={playing ? 'b' : 'a'} a={PlayIcon} b={PauseIcon} />
          </Button>
        </Tip>
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
        <Tip label={muted ? 'Unmute both' : 'Mute both'}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute both' : 'Mute both'}
          >
            <IconSwap state={muted ? 'a' : 'b'} a={VolumeOffIcon} b={VolumeHighIcon} />
          </Button>
        </Tip>
      </div>
    </div>
  )
}
