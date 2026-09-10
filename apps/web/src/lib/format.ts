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

// "in 3 days", "in 5 hours", "soon". Day granularity keeps SSR and client equal.
export function formatExpiry(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 48) return `in ${Math.floor(hours / 24)} days`
  if (hours >= 1) return `in ${hours} hour${hours === 1 ? '' : 's'}`
  return 'soon'
}
