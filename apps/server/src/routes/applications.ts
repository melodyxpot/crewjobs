import { Router } from "express"
import mongoose from "mongoose"
import { authenticate, AuthRequest } from "../middleware/auth"
import { JobApplication } from "../models/JobApplication"
import { User } from "../models/User"
import { canFilterBids, displayName, isManager, isRemoteWorkLocation } from "../lib/roles"
import { saveRemoteListing } from "../lib/remote-job"
import { resolveWorkspaceId, workspacesForUser } from "../lib/workspace-scope"

const router = Router()
router.use(authenticate)

function mapApplication(app: any) {
  const user = app.userId && typeof app.userId === "object" ? app.userId : null
  return {
    ...app,
    userId: user?._id?.toString() || app.userId?.toString?.() || app.userId,
    bidderName: app.bidderName || displayName(user || {}),
    workspaceId: app.workspaceId?._id?.toString?.() || app.workspaceId?.toString?.() || app.workspaceId || null,
    workspaceName: app.workspaceId?.name || app.workspaceName || "",
  }
}

async function applicationScope(req: AuthRequest, query: Record<string, string>) {
  const user = req.user!
  const filter: any = {}

  if (!user.isSuperAdmin && (user.role === "bidder" || user.role === "developer")) {
    filter.userId = user._id
    return filter
  }

  if (!canFilterBids(user)) {
    filter.userId = user._id
    return filter
  }

  if (user.role === "caller") {
    const workspaces = await workspacesForUser(user)
    const ids = workspaces.map((workspace) => workspace._id)
    if (query.workspaceId && query.workspaceId !== "all") {
      const allowed = ids.some((id) => id.toString() === query.workspaceId)
      filter.workspaceId = allowed ? query.workspaceId : { $in: [] }
    } else {
      filter.workspaceId = { $in: ids }
    }
  } else if (query.workspaceId && query.workspaceId !== "all") {
    filter.workspaceId = query.workspaceId
  }

  if (query.bidderId && query.bidderId !== "all") {
    filter.userId = query.bidderId
  }

  return filter
}

async function canReadApplication(req: AuthRequest, app: { userId: any; workspaceId?: any }) {
  const user = req.user!
  const ownerId = app.userId?._id?.toString?.() || app.userId?.toString?.()
  if (ownerId === req.userId) return true
  if (isManager(user) || user.role === "finance") return true
  if (user.role === "caller") {
    if (!app.workspaceId) return false
    const workspaceId = app.workspaceId._id?.toString?.() || app.workspaceId.toString()
    const workspaces = await workspacesForUser(user)
    return workspaces.some((workspace) => workspace._id.toString() === workspaceId)
  }
  return false
}

function canEditApplication(req: AuthRequest, app: { userId: any }) {
  const ownerId = app.userId?._id?.toString?.() || app.userId?.toString?.()
  if (ownerId === req.userId) return true
  return isManager(req.user!)
}

async function stampApplication(req: AuthRequest, body: any) {
  const user = req.user!
  const resolved = await resolveWorkspaceId(user, body.workspaceId || null, { required: true })
  if (resolved.error) return { error: resolved.error }

  const payload = { ...body }
  delete payload.userId
  delete payload.bidderName
  delete payload._id
  if (!isManager(user)) delete payload.workspaceId

  return {
    data: {
      ...payload,
      userId: user._id,
      bidderName: displayName(user),
      workspaceId: resolved.workspaceId,
    },
  }
}

async function recordRemoteBid(data: any, userId: string, bidderName: string) {
  if (!isRemoteWorkLocation(data.workLocation)) return
  await saveRemoteListing({
    title: data.title,
    company: data.company,
    link: data.link,
    platform: data.platform,
    location: data.location,
    jobType: data.jobType,
    notes: data.notes,
    workspaceId: data.workspaceId || null,
    userId,
    bidderName,
    mode: "bid",
  })
}

router.get("/filters", async (req: AuthRequest, res) => {
  try {
    if (!canFilterBids(req.user!)) {
      return res.json({ bidders: [], workspaces: [] })
    }
    const workspaces = await workspacesForUser(req.user!)
    const bidderQuery: any = {
      status: "approved",
      role: { $in: ["bidder", "leader", "moderator"] },
    }
    const bidders = await User.find(bidderQuery).select("username name email role").sort({ username: 1 }).lean()
    res.json({
      bidders: bidders.map((bidder) => ({
        id: bidder._id.toString(),
        username: bidder.username,
        name: displayName(bidder),
        role: bidder.role,
      })),
      workspaces: workspaces.map((workspace) => ({ id: workspace._id.toString(), name: workspace.name })),
    })
  } catch {
    res.status(500).json({ error: "Failed to load filters" })
  }
})

router.get("/", async (req: AuthRequest, res) => {
  try {
    const query = req.query as Record<string, string>
    const {
      page = "1",
      pageSize = "20",
      search,
      status,
      platform,
      dateFrom,
      dateTo,
      sortBy = "appliedAt",
      sortOrder = "desc",
    } = query

    const filter = await applicationScope(req, query)

    if (search) {
      const searchFilter = [
        { company: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { bidderName: { $regex: search, $options: "i" } },
      ]
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchFilter }]
        delete filter.$or
      } else {
        filter.$or = searchFilter
      }
    }
    if (status && status !== "all") filter.status = status
    if (platform && platform !== "all") filter.platform = platform
    if (dateFrom || dateTo) {
      filter.appliedAt = {}
      if (dateFrom) filter.appliedAt.$gte = new Date(dateFrom)
      if (dateTo) filter.appliedAt.$lte = new Date(dateTo)
    }

    const pageNum = parseInt(page)
    const size = parseInt(pageSize)
    const skip = (pageNum - 1) * size
    const sort: any = { [sortBy]: sortOrder === "asc" ? 1 : -1 }

    const [data, count] = await Promise.all([
      JobApplication.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(size)
        .populate("userId", "email name username")
        .populate("workspaceId", "name")
        .lean(),
      JobApplication.countDocuments(filter),
    ])

    res.json({ data: data.map(mapApplication), count })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch applications" })
  }
})

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Application not found" })
    }
    const app = await JobApplication.findById(req.params.id).populate("userId", "email name username").populate("workspaceId", "name").lean()
    if (!app || !(await canReadApplication(req, app))) {
      return res.status(404).json({ error: "Application not found" })
    }
    res.json({ data: mapApplication(app) })
  } catch {
    res.status(500).json({ error: "Failed to fetch application" })
  }
})

router.post("/", async (req: AuthRequest, res) => {
  try {
    const stamped = await stampApplication(req, req.body)
    if (stamped.error || !stamped.data) return res.status(400).json({ error: stamped.error || "Invalid application" })
    await recordRemoteBid(stamped.data, req.userId!, stamped.data.bidderName)
    const app = await JobApplication.create(stamped.data)
    res.status(201).json({ data: app })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to create application" })
  }
})

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const existing = await JobApplication.findById(req.params.id)
    if (!existing || !canEditApplication(req, existing)) {
      return res.status(404).json({ error: "Application not found" })
    }
    const updates = { ...req.body }
    delete updates.userId
    delete updates.bidderName
    delete updates._id
    if (!isManager(req.user!)) delete updates.workspaceId

    const app = await JobApplication.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).lean()
    res.json({ data: app })
  } catch {
    res.status(500).json({ error: "Failed to update application" })
  }
})

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const existing = await JobApplication.findById(req.params.id)
    if (!existing || !canEditApplication(req, existing)) {
      return res.status(404).json({ error: "Application not found" })
    }
    await existing.deleteOne()
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: "Failed to delete application" })
  }
})

router.post("/bulk", async (req: AuthRequest, res) => {
  try {
    const { applications } = req.body
    if (!Array.isArray(applications) || applications.length === 0) {
      return res.status(400).json({ error: "No applications to save" })
    }
    const stamped = await stampApplication(req, { workspaceId: req.body.workspaceId || null })
    if (stamped.error || !stamped.data) return res.status(400).json({ error: stamped.error || "Invalid application" })

    const docs = applications.map((app: any) => {
      const copy = { ...app }
      delete copy.userId
      delete copy._id
      delete copy.workspaceId
      return {
        ...copy,
        userId: req.userId,
        bidderName: stamped.data!.bidderName,
        workspaceId: stamped.data!.workspaceId,
      }
    })
    for (const doc of docs) {
      await recordRemoteBid(doc, req.userId!, doc.bidderName)
    }
    const result = await JobApplication.insertMany(docs, { ordered: false })
    res.status(201).json({ insertedCount: result.length })
  } catch (error: any) {
    const insertedCount = error.insertedDocs?.length || 0
    res.status(207).json({ insertedCount, error: error.message })
  }
})

export { router as applicationsRouter }
