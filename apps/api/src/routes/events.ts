import { Router } from "express"
import mongoose from "mongoose"
import { authenticate, AuthRequest } from "../middleware/auth"
import { CalendarEvent } from "../models/CalendarEvent"
import { Workspace } from "../models/Workspace"
import { eventScheduleError, isCalendarDate } from "../lib/calendar"
import { isManager } from "../lib/roles"
import { workspacesForUser } from "../lib/workspace-scope"

const router = Router()
router.use(authenticate)

function mapEvent(event: any) {
  const workspace =
    event.workspaceId && typeof event.workspaceId === "object" ? event.workspaceId : null
  return {
    _id: event._id.toString(),
    workspaceId: workspace?._id?.toString() || event.workspaceId?.toString?.() || event.workspaceId,
    workspaceName: workspace?.name || "",
    date: event.date,
    startTime: event.startTime || null,
    endTime: event.endTime || null,
    client: event.client,
    details: event.details || "",
  }
}

async function allowedWorkspaceIds(req: AuthRequest) {
  const workspaces = await workspacesForUser(req.user!)
  return new Set(workspaces.map((workspace) => workspace._id.toString()))
}

function readSchedule(body: any) {
  return {
    date: String(body.date || "").trim(),
    startTime: body.startTime ? String(body.startTime).trim() : null,
    endTime: body.endTime ? String(body.endTime).trim() : null,
    client: String(body.client || ""),
    details: String(body.details || ""),
  }
}

router.get("/", async (req: AuthRequest, res) => {
  try {
    const from = String(req.query.from || "")
    const to = String(req.query.to || "")
    if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) {
      return res.status(400).json({ error: "Choose a valid date range" })
    }

    const allowed = await allowedWorkspaceIds(req)
    const requested = String(req.query.workspaceId || "")
    let workspaceIds = [...allowed]
    if (requested && requested !== "all") {
      if (!mongoose.isValidObjectId(requested) || !allowed.has(requested)) {
        return res.json({ events: [] })
      }
      workspaceIds = [requested]
    }

    const events = await CalendarEvent.find({
      workspaceId: { $in: workspaceIds },
      date: { $gte: from, $lte: to },
    })
      .populate("workspaceId", "name")
      .sort({ date: 1, startTime: 1, client: 1 })
      .lean()

    res.json({ events: events.map(mapEvent) })
  } catch {
    res.status(500).json({ error: "Failed to fetch events" })
  }
})

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Event not found" })
    }
    const event = await CalendarEvent.findById(req.params.id).populate("workspaceId", "name").lean()
    if (!event) return res.status(404).json({ error: "Event not found" })
    const allowed = await allowedWorkspaceIds(req)
    const workspace = event.workspaceId as { _id?: { toString(): string } } | string | null
    const workspaceId =
      workspace && typeof workspace === "object"
        ? workspace._id?.toString()
        : String(workspace || "")
    if (!workspaceId || !allowed.has(workspaceId)) {
      return res.status(404).json({ error: "Event not found" })
    }
    res.json({ event: mapEvent(event) })
  } catch {
    res.status(500).json({ error: "Failed to fetch event" })
  }
})

router.post("/", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can add events" })
    }

    const workspaceId = String(req.body.workspaceId || "")
    if (!mongoose.isValidObjectId(workspaceId)) {
      return res.status(400).json({ error: "Choose a workspace" })
    }
    const workspace = await Workspace.findById(workspaceId).select("_id")
    if (!workspace) return res.status(400).json({ error: "Choose a workspace" })

    const schedule = readSchedule(req.body)
    const scheduleError = eventScheduleError(schedule)
    if (scheduleError) return res.status(400).json({ error: scheduleError })

    const event = await CalendarEvent.create({
      workspaceId: workspace._id,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      client: schedule.client.trim(),
      details: schedule.details.trim(),
      createdBy: req.userId,
    })
    const populated = await CalendarEvent.findById(event._id).populate("workspaceId", "name").lean()
    if (!populated) return res.status(500).json({ error: "Failed to create event" })
    res.status(201).json({ event: mapEvent(populated) })
  } catch {
    res.status(500).json({ error: "Failed to create event" })
  }
})

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can edit events" })
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Event not found" })
    }

    const event = await CalendarEvent.findById(req.params.id)
    if (!event) return res.status(404).json({ error: "Event not found" })

    const workspaceId = String(req.body.workspaceId || "")
    if (!mongoose.isValidObjectId(workspaceId)) {
      return res.status(400).json({ error: "Choose a workspace" })
    }
    const workspace = await Workspace.findById(workspaceId).select("_id")
    if (!workspace) return res.status(400).json({ error: "Choose a workspace" })

    const schedule = readSchedule(req.body)
    const scheduleError = eventScheduleError(schedule)
    if (scheduleError) return res.status(400).json({ error: scheduleError })

    event.workspaceId = workspace._id
    event.date = schedule.date
    event.startTime = schedule.startTime
    event.endTime = schedule.endTime
    event.client = schedule.client.trim()
    event.details = schedule.details.trim()
    await event.save()

    const populated = await CalendarEvent.findById(event._id).populate("workspaceId", "name").lean()
    if (!populated) return res.status(500).json({ error: "Failed to update event" })
    res.json({ event: mapEvent(populated) })
  } catch {
    res.status(500).json({ error: "Failed to update event" })
  }
})

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can delete events" })
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Event not found" })
    }
    const event = await CalendarEvent.findByIdAndDelete(req.params.id)
    if (!event) return res.status(404).json({ error: "Event not found" })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: "Failed to delete event" })
  }
})

export { router as eventsRouter }
