import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppHeader, PageBody, Section } from '#/components/app-shell'
import { RetentionForm } from '#/components/retention-form'
import { CreateTokenButton, TokenList } from '#/components/tokens'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'
import { initials } from '#/components/user-menu'
import { getSession } from '#/lib/session'
import { formatBytes } from '#/lib/format'
import { getSettingsView } from '#/lib/settings'

export const Route = createFileRoute('/settings')({
  async beforeLoad() {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
    return { session }
  },
  async loader() {
    const view = await getSettingsView()
    if (!view) throw redirect({ to: '/login', search: { redirect: '/settings' } })
    return view
  },
  head: () => ({ meta: [{ title: 'Settings · Artifacts' }] }),
  component: Settings,
})

function Settings() {
  const { session } = Route.useRouteContext()
  const { settings, tokens } = Route.useLoaderData()
  const { artifacts, bytes } = settings.usage

  return (
    <>
      <AppHeader
        title="Settings"
        back={{ to: '/', label: 'Back to projects' }}
        user={session.user}
      />
      <PageBody>
        <Section title="Account" description="Signed in with GitHub.">
          <Item variant="outline">
            <ItemMedia>
              <Avatar>
                <AvatarImage src={session.user.image ?? undefined} alt="" />
                <AvatarFallback>{initials(session.user.name)}</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{session.user.name}</ItemTitle>
              <ItemDescription>{session.user.email}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="secondary">
                {artifacts} artifact{artifacts === 1 ? '' : 's'} · {formatBytes(bytes)}
              </Badge>
            </ItemActions>
          </Item>
        </Section>

        <Section
          title="Retention"
          description="How long an artifact stays when its upload and project set no retention."
        >
          <RetentionForm defaultTtlSeconds={settings.defaultTtlSeconds} />
        </Section>

        <Section
          title="API tokens"
          description={
            <>
              Send one as <code className="font-mono">Authorization: Bearer art_…</code> on uploads.
              Every token can upload to every project.
            </>
          }
          action={tokens.length > 0 ? <CreateTokenButton /> : null}
        >
          <TokenList tokens={tokens} />
        </Section>
      </PageBody>
    </>
  )
}
