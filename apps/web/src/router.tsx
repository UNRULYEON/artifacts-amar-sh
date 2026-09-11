import { Link, createRouter as createTanStackRouter } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Unlink01Icon } from '@hugeicons/core-free-icons'
import { PageBody, PageSkeleton } from '#/components/app-shell'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { routeTree } from './route-tree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PageSkeleton,
    defaultNotFoundComponent: NotFound,
  })

  return router
}

function NotFound() {
  return (
    <PageBody>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Unlink01Icon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>There is nothing at this address.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link to="/">Back to projects</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </PageBody>
  )
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
