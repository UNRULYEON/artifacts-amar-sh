// Fixed locale so server and client render the same text.
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso))
}
