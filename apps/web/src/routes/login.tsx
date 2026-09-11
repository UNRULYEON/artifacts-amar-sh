import { createFileRoute, redirect } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { GithubIcon } from '@hugeicons/core-free-icons'
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
import { authClient } from '#/lib/auth-client'
import { getSession } from '#/lib/session'

export const Route = createFileRoute('/login')({
  validateSearch(search: Record<string, unknown>): { error?: string; redirect?: string } {
    return {
      ...(typeof search.error === 'string' ? { error: search.error } : {}),
      ...(typeof search.redirect === 'string' ? { redirect: search.redirect } : {}),
    }
  },
  async beforeLoad() {
    const session = await getSession()
    if (session) throw redirect({ to: '/' })
  },
  component: Login,
})

// Only a same-origin path may be the return target. An OAuth authorize query
// (sent here by the MCP login step) goes back to the authorize endpoint.
function returnPath(value: string | undefined) {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  const query = location.search.slice(1)
  if (new URLSearchParams(query).has('client_id')) return `/api/auth/oauth2/authorize?${query}`
  return '/'
}

function signIn(callbackURL: string) {
  void authClient.signIn.social({ provider: 'github', callbackURL, errorCallbackURL: '/login' })
}

function Login() {
  const { error, redirect: returnTo } = Route.useSearch()

  return (
    <main className="flex min-h-svh items-center justify-center px-safe-area-6 py-safe-area-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <img src="/icon.svg" alt="" className="mb-2 size-12 rounded-xl" />
          <CardTitle className="text-base">Artifacts</CardTitle>
          <CardDescription>Sign in to open artifacts and manage projects.</CardDescription>
        </CardHeader>
        {error ? (
          <CardContent>
            <FormError error={`Sign in failed: ${error.replaceAll('_', ' ')}`} />
          </CardContent>
        ) : null}
        <CardFooter>
          <Button size="lg" onClick={() => signIn(returnPath(returnTo))} className="w-full">
            <HugeiconsIcon icon={GithubIcon} strokeWidth={2} data-icon="inline-start" />
            Continue with GitHub
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
