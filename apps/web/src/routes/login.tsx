import { createFileRoute, redirect } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
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

// Only a same-origin path may be the return target.
function safePath(value: string | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function signIn(callbackURL: string) {
  void authClient.signIn.social({ provider: 'github', callbackURL, errorCallbackURL: '/login' })
}

function Login() {
  const { error, redirect: returnTo } = Route.useSearch()

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Artifacts</CardTitle>
          <CardDescription>Sign in to open artifacts and manage projects.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              Sign in failed: {error.replaceAll('_', ' ')}
            </p>
          ) : null}
          <Button onClick={() => signIn(safePath(returnTo))} className="w-full">
            Continue with GitHub
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
