import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { Lightbox, useLightbox, type LightboxItem } from '@frontendsupply/lightbox'
import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'

export const LightboxTrigger = Lightbox.Trigger

const chromeButton = 'rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white'

// Full screen viewer with pinch zoom, swipe, and pull to dismiss. Wrap
// the images in <LightboxTrigger index={i}> to open it at that item.
export function ImageLightbox({
  items,
  onIndexChange,
  children,
}: {
  items: LightboxItem[]
  onIndexChange?: (index: number) => void
  children: ReactNode
}) {
  return (
    <Lightbox.Root items={items} onIndexChange={onIndexChange}>
      {children}
      <Lightbox.Portal>
        <Lightbox.Backdrop className="fixed inset-0 bg-black" />
        <Lightbox.Popup className="group fixed inset-0 outline-none">
          <Lightbox.Viewport />
          <Chrome />
        </Lightbox.Popup>
      </Lightbox.Portal>
    </Lightbox.Root>
  )
}

// The controls fade with the morph and hide on a tap of the image.
function Chrome() {
  const { item, index, count } = useLightbox()
  return (
    <div className="pointer-events-none absolute inset-0 opacity-(--lightbox-presence)">
      <div className="flex size-full flex-col justify-between p-3 pt-[max(--spacing(3),env(safe-area-inset-top))] pb-[max(--spacing(3),env(safe-area-inset-bottom))] text-white transition-opacity [transition-duration:var(--duration-fast)] group-data-ui-hidden:opacity-0 motion-reduce:transition-none [&_button]:pointer-events-auto group-data-ui-hidden:[&_button]:pointer-events-none">
        <div className="flex items-center justify-between gap-3">
          <Lightbox.Title className="truncate rounded-full bg-black/40 px-3 py-1 text-xs font-medium">
            {item?.alt}
            {count > 1 ? (
              <span className="text-white/60 tabular-nums">
                {' '}
                · {index + 1} of {count}
              </span>
            ) : null}
          </Lightbox.Title>
          <Lightbox.Close
            render={<Button variant="ghost" size="icon-lg" className={chromeButton} />}
            aria-label="Close"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </Lightbox.Close>
        </div>
        {count > 1 ? (
          <div className="flex justify-center gap-2">
            <Lightbox.Prev
              render={<Button variant="ghost" size="icon-lg" className={chromeButton} />}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Lightbox.Prev>
            <Lightbox.Next
              render={<Button variant="ghost" size="icon-lg" className={chromeButton} />}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
            </Lightbox.Next>
          </div>
        ) : null}
      </div>
    </div>
  )
}
