import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { CreateTokenButton, TokenList } from '#/components/tokens'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { UserMenu, initials } from '#/components/user-menu'
import { getSession } from '#/lib/session'
import { getTokens } from '#/lib/tokens'

export const Route = createFileRoute('/settings')({
  async beforeLoad() {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
    return { session }
  },
  loader: () => getTokens(),
  head: () => ({ meta: [{ title: 'Settings · Artifacts' }] }),
  component: Settings,
})

function Settings() {
  const { session } = Route.useRouteContext()
  const tokens = Route.useLoaderData()

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back to projects">
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>
        <UserMenu user={session.user} />
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Account</h2>
        <div className="flex items-center gap-3 rounded-lg px-4 py-3 ring-1 ring-foreground/10">
          <Avatar>
            <AvatarImage src={session.user.image ?? undefined} alt="" />
            <AvatarFallback>{initials(session.user.name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{session.user.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {session.user.email} · GitHub
            </span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">API tokens</h2>
          <CreateTokenButton />
        </div>
        <p className="text-xs text-muted-foreground">
          Send a token as <code className="font-mono">Authorization: Bearer art_…</code> on uploads.
          Every token can upload to every project.
        </p>
        <TokenList tokens={tokens} />
      </section>
    </main>
  )
}
