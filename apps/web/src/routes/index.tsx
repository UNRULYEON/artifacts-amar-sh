import { createFileRoute, redirect } from '@tanstack/react-router'
import { CreateProjectButton, ProjectList } from '#/components/projects'
import { UserMenu } from '#/components/user-menu'
import { getProjects } from '#/lib/projects'
import { getSession } from '#/lib/session'

export const Route = createFileRoute('/')({
  async beforeLoad() {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
    return { session }
  },
  loader: () => getProjects(),
  component: Home,
})

function Home() {
  const { session } = Route.useRouteContext()
  const projects = Route.useLoaderData()

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Artifacts</h1>
        <UserMenu user={session.user} />
      </header>
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Projects</h2>
          <CreateProjectButton />
        </div>
        <ProjectList projects={projects} />
      </section>
    </main>
  )
}
