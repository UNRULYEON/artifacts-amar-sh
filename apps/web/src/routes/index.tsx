import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppHeader, PageBody, Section } from '#/components/app-shell'
import { CreateProjectButton, ProjectList } from '#/components/projects'
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
    <>
      <AppHeader title="Artifacts" user={session.user} />
      <PageBody>
        <Section
          title="Projects"
          description="Uploads land in a project. Open one to see its artifacts."
          action={projects.length > 0 ? <CreateProjectButton /> : null}
        >
          <ProjectList projects={projects} />
        </Section>
      </PageBody>
    </>
  )
}
