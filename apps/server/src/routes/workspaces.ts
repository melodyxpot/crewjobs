import { Router } from "express"
import { authenticate, AuthRequest } from "../middleware/auth"
import { Workspace } from "../models/Workspace"
import { User } from "../models/User"
import { isManager } from "../lib/roles"
import { workspacesForUser } from "../lib/workspace-scope"

const router = Router()
router.use(authenticate)

function populateWorkspace(id: unknown) {
  return Workspace.findById(id)
    .populate("bidderIds", "email username name role")
    .populate("callerIds", "email username name role")
    .populate("createdBy", "email username name role")
    .lean()
}

router.get("/", async (req: AuthRequest, res) => {
  try {
    const workspaces = await workspacesForUser(req.user!)
    const ids = workspaces.map((workspace) => workspace._id)
    const populated = await Workspace.find({ _id: { $in: ids } })
      .sort({ name: 1 })
      .populate("bidderIds", "email username name role")
      .populate("callerIds", "email username name role")
      .populate("createdBy", "email username name role")
      .lean()
    res.json({ workspaces: populated })
  } catch {
    res.status(500).json({ error: "Failed to fetch workspaces" })
  }
})

router.post("/", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can create a workspace" })
    }
    const name = String(req.body.name || "").trim()
    if (!name) return res.status(400).json({ error: "Workspace name is required" })

    const workspace = await Workspace.create({
      name,
      createdBy: req.userId,
      bidderIds: [],
      callerIds: [],
    })
    const populated = await populateWorkspace(workspace._id)
    res.status(201).json({ workspace: populated })
  } catch {
    res.status(500).json({ error: "Failed to create workspace" })
  }
})

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const allowed = await workspacesForUser(req.user!)
    const workspace = allowed.find((item) => item._id.toString() === req.params.id)
    if (!workspace) return res.status(404).json({ error: "Workspace not found" })
    const populated = await populateWorkspace(workspace._id)
    res.json({ workspace: populated })
  } catch {
    res.status(500).json({ error: "Failed to fetch workspace" })
  }
})

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can rename a workspace" })
    }
    const workspace = await Workspace.findById(req.params.id)
    if (!workspace) return res.status(404).json({ error: "Workspace not found" })
    const name = String(req.body.name || "").trim()
    if (!name) return res.status(400).json({ error: "Workspace name is required" })
    workspace.name = name
    await workspace.save()
    res.json({ workspace: await populateWorkspace(workspace._id) })
  } catch {
    res.status(500).json({ error: "Failed to update workspace" })
  }
})

router.put("/:id/members", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can assign people" })
    }

    const workspace = await Workspace.findById(req.params.id)
    if (!workspace) return res.status(404).json({ error: "Workspace not found" })

    const bidderIds = [...new Set((req.body.bidderIds || []) as string[])]
    const callerIds = [...new Set((req.body.callerIds || []) as string[])]

    const bidders = await User.find({ _id: { $in: bidderIds }, role: "bidder", status: "approved" }).select("_id")
    if (bidders.length !== bidderIds.length) {
      return res.status(400).json({ error: "Each assigned bidder must be an approved user with the bidder role" })
    }

    const callers = await User.find({ _id: { $in: callerIds }, role: "caller", status: "approved" }).select("_id")
    if (callers.length !== callerIds.length) {
      return res.status(400).json({ error: "Each assigned caller must be an approved user with the caller role" })
    }

    if (bidderIds.length) {
      const conflict = await Workspace.findOne({
        _id: { $ne: workspace._id },
        bidderIds: { $in: bidderIds },
      }).select("name")
      if (conflict) {
        return res.status(400).json({
          error: `A bidder is already assigned to "${conflict.name}". Each bidder can belong to only one workspace.`,
        })
      }
    }

    workspace.bidderIds = bidderIds as any
    workspace.callerIds = callerIds as any
    await workspace.save()
    res.json({ workspace: await populateWorkspace(workspace._id) })
  } catch {
    res.status(500).json({ error: "Failed to update workspace members" })
  }
})

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can delete a workspace" })
    }
    const workspace = await Workspace.findByIdAndDelete(req.params.id)
    if (!workspace) return res.status(404).json({ error: "Workspace not found" })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: "Failed to delete workspace" })
  }
})

export { router as workspacesRouter }
