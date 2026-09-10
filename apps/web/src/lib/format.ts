// Fixed locale so server and client render the same text.
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso))
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
