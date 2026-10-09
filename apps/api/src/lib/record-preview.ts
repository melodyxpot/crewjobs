import { AuthRequest } from "../middleware/auth"
import { CalendarEvent } from "../models/CalendarEvent"
import { JobApplication } from "../models/JobApplication"
import { ScrapedJob } from "../models/ScrapedJob"
import { sourceLabel } from "./job-scraper/catalog"
import { displayName, isManager } from "./roles"
import { recordPath, type RecordLink } from "./record-link"
import type { LinkPreview } from "./unfurl"
import { workspacesForUser } from "./workspace-scope"

function clip(value?: string | null, max = 180) {
  const text = value?.trim() || ""
  if (!text) return ""
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

function formatDay(value?: string | Date | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatCalendarDay(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return value
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatClock(value: string) {
  const [hour, minute] = value.split(":").map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value
  const period = hour >= 12 ? "PM" : "AM"
  const twelve = hour % 12 || 12
  return `${twelve}:${String(minute).padStart(2, "0")} ${period}`
}

function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "All day"
  if (start && end) return `${formatClock(start)} – ${formatClock(end)}`
  if (start) return formatClock(start)
  return `Until ${formatClock(end || "")}`
}

function field(label: string, value?: string | null) {
  const text = value?.trim()
  if (!text) return null
  return { label, value: text }
}

function fields(...items: ({ label: string; value: string } | null)[]) {
  return items.filter((item): item is { label: string; value: string } => !!item)
}

function titled(status: string) {
  const text = status.trim()
  if (!text) return ""
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function preview(
  record: RecordLink,
  input: Omit<LinkPreview, "url" | "image" | "path">,
): LinkPreview {
  const path = recordPath(record.kind, record.id)
  return { ...input, url: path, image: "", path }
}

async function canReadApplication(req: AuthRequest, app: { userId: any; workspaceId?: any }) {
  const user = req.user!
  const ownerId = app.userId?._id?.toString?.() || app.userId?.toString?.()
  if (ownerId === req.userId) return true
  if (isManager(user) || user.role === "finance") return true
  if (user.role !== "caller" || !app.workspaceId) return false
  const workspaceId = app.workspaceId._id?.toString?.() || app.workspaceId.toString()
  const workspaces = await workspacesForUser(user)
  return workspaces.some((workspace) => workspace._id.toString() === workspaceId)
}

async function canReadJob(req: AuthRequest, job: any) {
  const user = req.user!
  if (job.workLocation !== "Remote") return false
  if (isManager(user) || user.role === "finance" || user.role === "developer") return true
  const workspaces = await workspacesForUser(user)
  const ids = new Set(workspaces.map((workspace) => workspace._id.toString()))
  const workspaceId = job.workspaceId?._id?.toString?.() || job.workspaceId?.toString?.() || ""
  if (user.role === "bidder") {
    const assigned = job.assignedTo?._id?.toString?.() || job.assignedTo?.toString?.()
    const scraped = job.scrapedBy?.toString?.()
    return (
      (!!workspaceId && ids.has(workspaceId)) || assigned === req.userId || scraped === req.userId
    )
  }
  return !!workspaceId && ids.has(workspaceId)
}

async function canReadEvent(req: AuthRequest, event: any) {
  const workspaceId = event.workspaceId?._id?.toString?.() || event.workspaceId?.toString?.() || ""
  if (!workspaceId) return false
  const workspaces = await workspacesForUser(req.user!)
  return workspaces.some((workspace) => workspace._id.toString() === workspaceId)
}

async function applicationPreview(req: AuthRequest, id: string): Promise<LinkPreview | null> {
  const app = await JobApplication.findById(id)
    .populate("userId", "email name username")
    .populate("workspaceId", "name")
    .lean()
  if (!app || !(await canReadApplication(req, app))) return null
  const row = app as any
  const user = row.userId && typeof row.userId === "object" ? row.userId : null
  const status = String(row.status || "Applied")
  const notes = clip(row.notes)
  const place = [row.location, row.workLocation]
    .map((value: string | null | undefined) => value?.trim())
    .filter((value, index, list): value is string => !!value && list.indexOf(value) === index)
    .join(" · ")
  return preview(
    { kind: "application", id },
    {
      title: `${row.title} · ${row.company}`,
      description: notes || `${status} application`,
      siteName: "Job application",
      provider: "application",
      status,
      fields: fields(
        field("Status", status),
        field("Workspace", row.workspaceId?.name),
        field("Bidder", row.bidderName || displayName(user || {})),
        field("Applied", formatDay(row.appliedAt)),
        field("Follow-up", formatDay(row.followUpAt)),
        field("Platform", row.platform),
        field("Location", place),
        field("Job type", row.jobType),
        field("Notes", notes),
      ),
    },
  )
}

async function jobPreview(req: AuthRequest, id: string): Promise<LinkPreview | null> {
  const job = await ScrapedJob.findById(id).populate("workspaceId", "name").lean()
  if (!job || !(await canReadJob(req, job))) return null
  const row = job as any
  const status = titled(String(row.status || "open"))
  const notes = clip(row.notes)
  return preview(
    { kind: "job", id },
    {
      title: `${row.title} · ${row.company}`,
      description: notes || `${status} remote job`,
      siteName: "Remote job",
      provider: "job",
      status,
      fields: fields(
        field("Status", status),
        field("Workspace", row.workspaceId?.name || "Unassigned"),
        field("Region", row.region),
        field(
          "Source",
          row.source === "manual" ? "Manual" : row.source ? sourceLabel(row.source) : "",
        ),
        field("Platform", row.platform),
        field("Location", row.location),
        field("Job type", row.jobType),
        field("Notes", notes),
      ),
    },
  )
}

async function eventPreview(req: AuthRequest, id: string): Promise<LinkPreview | null> {
  const event = await CalendarEvent.findById(id).populate("workspaceId", "name").lean()
  if (!event || !(await canReadEvent(req, event))) return null
  const row = event as any
  const when = formatCalendarDay(row.date)
  const time = formatTimeRange(row.startTime, row.endTime)
  const details = clip(row.details)
  const workspace = row.workspaceId?.name || ""
  return preview(
    { kind: "event", id },
    {
      title: row.client,
      description: details || `${when} · ${time}`,
      siteName: "Calendar event",
      provider: "event",
      fields: fields(
        field("Workspace", workspace),
        field("Date", when),
        field("Time", time),
        field("Client", row.client),
        field("Details", details),
      ),
    },
  )
}

export async function previewRecord(req: AuthRequest, record: RecordLink) {
  if (record.kind === "application") return applicationPreview(req, record.id)
  if (record.kind === "job") return jobPreview(req, record.id)
  return eventPreview(req, record.id)
}
