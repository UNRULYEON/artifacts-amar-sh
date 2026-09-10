// Same-origin JSON calls. The browser adds the Origin header the API checks.
export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? res.statusText)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}
