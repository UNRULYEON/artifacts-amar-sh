import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
  MultiplicationSignCircleIcon,
} from '@hugeicons/core-free-icons'
import { useTheme } from '#/lib/theme'

// Keeps toasts clear of the home indicator and the rounded corners when installed.
function inset(side: 'top' | 'right' | 'bottom' | 'left', base: string) {
  return `calc(env(safe-area-inset-${side}) + ${base})`
}

function Toaster(props: ToasterProps) {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      offset={{ right: inset('right', '1.5rem'), bottom: inset('bottom', '1.5rem') }}
      mobileOffset={{
        left: inset('left', '1rem'),
        right: inset('right', '1rem'),
        bottom: inset('bottom', '1rem'),
      }}
      className="toaster group"
      icons={{
        success: <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />,
        info: <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-4" />,
        warning: <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4" />,
        error: (
          <HugeiconsIcon icon={MultiplicationSignCircleIcon} strokeWidth={2} className="size-4" />
        ),
        loading: (
          <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: 'cn-toast' } }}
      {...props}
    />
  )
}

export { Toaster }
