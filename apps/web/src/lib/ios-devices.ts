// One row per unique width x height @ dpr, in CSS points, portrait. Both the
// startup-image links and scripts/splash.ts read this table.
export const iosDevices = [
  [320, 568, 2],
  [375, 667, 2],
  [414, 736, 3],
  [375, 812, 3],
  [414, 896, 2],
  [414, 896, 3],
  [390, 844, 3],
  [428, 926, 3],
  [393, 852, 3],
  [430, 932, 3],
  [402, 874, 3],
  [440, 956, 3],
  [420, 912, 3],
  [768, 1024, 2],
  [810, 1080, 2],
  [820, 1180, 2],
  [744, 1133, 2],
  [834, 1112, 2],
  [834, 1194, 2],
  [834, 1210, 2],
  [1024, 1366, 2],
  [1032, 1376, 2],
] as const

export type Orientation = 'portrait' | 'landscape'
export type SplashTheme = 'light' | 'dark'

// Bump when the splash artwork changes. iOS caches the images per home-screen entry.
export const splashVersion = 1

export function splashFile(
  width: number,
  height: number,
  dpr: number,
  orientation: Orientation,
  theme: SplashTheme,
) {
  return `/splash/${width}x${height}-${dpr}x-${orientation}${theme === 'dark' ? '-dark' : ''}.png`
}

// Dark entries come first: iOS takes the first link whose media query matches.
export const splashLinks = (['dark', 'light'] as const).flatMap((theme) =>
  iosDevices.flatMap(([width, height, dpr]) =>
    (['portrait', 'landscape'] as const).map((orientation) => {
      const [w, h] = orientation === 'portrait' ? [width, height] : [height, width]
      const scheme = theme === 'dark' ? '(prefers-color-scheme: dark) and ' : ''
      return {
        rel: 'apple-touch-startup-image',
        href: `${splashFile(width, height, dpr, orientation, theme)}?v${splashVersion}`,
        media: `${scheme}(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})`,
      }
    }),
  ),
)
