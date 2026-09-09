import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { authClient } from '#/lib/auth-client'
import { getSession } from '#/lib/session'

export const Route = createFileRoute('/')({
  async beforeLoad() {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
    return { session }
  },
  component: Home,
})

function Home() {
  const { session } = Route.useRouteContext()
  const router = useRouter()

  async function signOut() {
    await authClient.signOut()
    await router.invalidate()
    await router.navigate({ to: '/login' })
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Artifacts</h1>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={session.user.image ?? undefined} alt="" />
            <AvatarFallback>{session.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-sm">{session.user.name}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <p className="text-muted-foreground">No projects yet.</p>
    </main>
  )
}
