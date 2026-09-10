import { createFileRoute, redirect } from '@tanstack/react-router'
import { UserMenu } from '#/components/user-menu'
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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Artifacts</h1>
        <UserMenu user={session.user} />
      </header>
      <p className="text-muted-foreground">No projects yet.</p>
    </main>
  )
}
