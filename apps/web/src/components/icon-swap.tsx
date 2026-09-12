import { HugeiconsIcon } from '@hugeicons/react'
import type { ComponentProps } from 'react'
import { cn } from 'cn'

type Icon = ComponentProps<typeof HugeiconsIcon>['icon']

// Two icons in one slot. The active one is visible; the other fades out with
// blur and scale. Styles live in styles.css under .t-icon-swap.
export function IconSwap({
  state,
  a,
  b,
  className,
}: {
  state: 'a' | 'b'
  a: Icon
  b: Icon
  className?: string
}) {
  return (
    <span className={cn('t-icon-swap', className)} data-state={state} aria-hidden="true">
      <HugeiconsIcon icon={a} strokeWidth={2} className="t-icon" data-icon="a" />
      <HugeiconsIcon icon={b} strokeWidth={2} className="t-icon" data-icon="b" />
    </span>
  )
}
