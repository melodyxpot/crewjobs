const OBJECT_ID = /^[a-f0-9]{24}$/i

export type RecordKind = "application" | "job" | "event"

export type RecordLink = {
  kind: RecordKind
  id: string
}

const SEGMENTS: Record<string, RecordKind> = {
  applications: "application",
  jobs: "job",
  calendar: "event",
}

export function recordPath(kind: RecordKind, id: string) {
  const segment = kind === "application" ? "applications" : kind === "job" ? "jobs" : "calendar"
  return `/${segment}/${id}`
}

export function parseRecordUrl(raw: string): RecordLink | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null

  const parts = url.pathname.split("/").filter(Boolean)
  if (parts.length === 2) {
    const kind = SEGMENTS[parts[0].toLowerCase()]
    if (kind && OBJECT_ID.test(parts[1])) return { kind, id: parts[1] }
  }

  if (parts.length === 1) {
    const kind = SEGMENTS[parts[0].toLowerCase()]
    if (!kind) return null
    const named = kind === "job" ? "job" : kind === "event" ? "event" : "id"
    const id = url.searchParams.get(named) || url.searchParams.get("id") || ""
    if (OBJECT_ID.test(id)) return { kind, id }
  }

  return null
}
