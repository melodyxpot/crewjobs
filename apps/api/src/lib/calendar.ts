const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export function eventScheduleError(input: {
  date: string
  startTime?: string | null
  endTime?: string | null
  client: string
  details?: string | null
}) {
  if (!isCalendarDate(input.date)) return "Choose a valid date."

  const start = (input.startTime || "").trim()
  const end = (input.endTime || "").trim()
  if ((start && !end) || (!start && end)) {
    return "Set both a start and an end time, or leave both empty for an all-day event."
  }
  if (start && (!TIME.test(start) || !TIME.test(end))) return "Use a valid time."
  if (start && end <= start) return "The end time has to be after the start time."

  const client = input.client.trim()
  if (!client) return "Client is required."
  if (client.length > 120) return "Client name is too long."
  if ((input.details || "").trim().length > 4000) return "Details are too long."
  return null
}
