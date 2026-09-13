import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'

// A tooltip for icon-only controls. The child keeps its aria-label for touch and screen readers.
export function Tip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
