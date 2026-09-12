import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { Button } from '#/components/ui/button'
import { Item, ItemContent, ItemGroup, ItemMedia } from '#/components/ui/item'
import { Skeleton } from '#/components/ui/skeleton'
import { UserMenu } from '#/components/user-menu'

type Width = 'default' | 'wide'

const widths: Record<Width, string> = {
  default: 'max-w-3xl',
  wide: 'max-w-5xl',
}

// Installed apps hide the browser back button, so every page below the root links back itself.
export type BackLink =
  | { to: '/'; label: string }
  | { to: '/projects/$id'; params: { id: string }; label: string }

interface AppHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  back?: BackLink
  user: { name: string; email: string; image: string | null }
  actions?: ReactNode
  width?: Width
}

function BackButton({ back }: { back: BackLink }) {
  return (
    <Button variant="ghost" size="icon" asChild className="-ml-1.5 shrink-0">
      {back.to === '/' ? (
        <Link to="/" aria-label={back.label}>
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Link>
      ) : (
        <Link to={back.to} params={back.params} aria-label={back.label}>
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Link>
      )}
    </Button>
  )
}

// Sticky bar with its own background: Safari samples it for the status-bar tint,
// and the top safe-area padding keeps it clear of the clock when installed.
function HeaderBar({ width = 'default', children }: { width?: Width; children: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 pt-safe-area-0 backdrop-blur-md select-none">
      <div
        className={cn(
          'mx-auto flex h-14 w-full items-center gap-2 px-safe-area-4 sm:px-safe-area-6',
          widths[width],
        )}
      >
        {children}
      </div>
    </header>
  )
}

export function AppHeader({
  title,
  subtitle,
  back,
  user,
  actions,
  width = 'default',
}: AppHeaderProps) {
  return (
    <HeaderBar width={width}>
      {back ? <BackButton back={back} /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-base/tight font-semibold">{title}</h1>
        {subtitle ? (
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      <UserMenu user={user} />
    </HeaderBar>
  )
}

// Shown by the router while a slow page loads. Same bar and row shapes as the real page.
export function PageSkeleton() {
  return (
    <>
      <HeaderBar>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-auto size-8 rounded-full" />
      </HeaderBar>
      <PageBody>
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-4 w-24" />
          <ItemGroup className="gap-0 divide-y overflow-hidden rounded-lg border">
            {[0, 1, 2].map((row) => (
              <Item key={row} className="rounded-none">
                <ItemMedia>
                  <Skeleton className="size-4 rounded-sm" />
                </ItemMedia>
                <ItemContent className="gap-1.5">
                  <Skeleton className="h-3 w-2/5 max-w-40" />
                  <Skeleton className="h-3 w-3/5 max-w-64" />
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </div>
      </PageBody>
    </>
  )
}

export function PageBody({ width = 'default', children }: { width?: Width; children: ReactNode }) {
  return (
    <main
      className={cn(
        't-page-enter mx-auto flex w-full flex-col gap-8 px-safe-area-4 pt-6 pb-safe-area-12 sm:px-safe-area-6',
        widths[width],
      )}
    >
      {children}
    </main>
  )
}

interface SectionProps {
  title: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
}

export function Section({ title, description, action, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
