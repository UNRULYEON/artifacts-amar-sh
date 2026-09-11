import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { FormError } from '#/components/form-error'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Spinner } from '#/components/ui/spinner'
import { getSession } from '#/lib/session'

// Better Auth sends the OAuth authorize query here, signed. We hand it back
// untouched to /oauth2/consent with the decision.
export const Route = createFileRoute('/consent')({
  validateSearch(search: Record<string, unknown>) {
    return search as { client_id?: string; scope?: string }
  },
  async beforeLoad({ location }) {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  head: () => ({ meta: [{ title: 'Allow access · Artifacts' }] }),
  component: Consent,
})

function Consent() {
  const { client_id: clientId, scope } = Route.useSearch()
  const [busy, setBusy] = useState<'allow' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(accept: boolean) {
    setBusy(accept ? 'allow' : 'deny')
    setError(null)
    try {
      const res = await fetch('/api/auth/oauth2/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accept, oauth_query: location.search.slice(1) }),
      })
      const body = (await res.json()) as { redirect_uri?: string; message?: string }
      if (!res.ok || !body.redirect_uri) throw new Error(body.message ?? 'Consent failed.')
      location.href = body.redirect_uri
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Consent failed.')
      setBusy(null)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-safe-area-6 py-safe-area-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Allow access?</CardTitle>
          <CardDescription>
            An MCP client wants to act as you on Artifacts. It can list projects and upload to any
            of them.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Client</dt>
            <dd className="truncate font-mono">{clientId ?? 'unknown'}</dd>
            <dt className="text-muted-foreground">Scopes</dt>
            <dd className="font-mono">{scope ?? 'default'}</dd>
          </dl>
          <FormError error={error} />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" onClick={() => decide(false)} disabled={busy !== null}>
            {busy === 'deny' ? <Spinner data-icon="inline-start" /> : null}
            Deny
          </Button>
          <Button onClick={() => decide(true)} disabled={busy !== null}>
            {busy === 'allow' ? <Spinner data-icon="inline-start" /> : null}
            Allow
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
