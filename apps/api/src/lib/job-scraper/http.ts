export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: "application/json",
      "User-Agent": "CrewJobs/1.0",
      ...(init?.headers || {}),
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

export function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed"
  return message.replace(/https?:\/\/\S+/gi, "request").slice(0, 180)
}
