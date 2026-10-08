export type CalendarEvent = {
  _id: string
  workspaceId: string
  workspaceName: string
  date: string
  startTime: string | null
  endTime: string | null
  client: string
  details: string
}

export type EventDraft = {
  id?: string
  workspaceId: string
  date: string
  startTime: string
  endTime: string
  client: string
  details: string
}

export type WorkspaceOption = { _id: string; name: string }

const PALETTE = [
  "#1a73e8",
  "#039be5",
  "#33b679",
  "#0b8043",
  "#8e24aa",
  "#d50000",
  "#e67c73",
  "#f4511e",
  "#f6bf26",
  "#7986cb",
  "#616161",
  "#3f51b5",
]

export function workspaceColor(id: string) {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

export function formatClock(value: string) {
  const [hour, minute] = value.split(":").map(Number)
  const suffix = hour < 12 ? "AM" : "PM"
  const hour12 = hour % 12 || 12
  if (!minute) return `${hour12} ${suffix}`
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`
}
