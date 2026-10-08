import { Router } from "express"
import { authenticate, AuthRequest } from "../middleware/auth"
import { User } from "../models/User"
import { Workspace } from "../models/Workspace"
import { USER_ROLES, canApproveUsers, isManager, toPublicUser } from "../lib/roles"
import {
  MembershipError,
  assignUserWorkspaces,
  clearUserWorkspaces,
  workspaceIdsForMember,
} from "../lib/workspace-membership"

const router = Router()
router.use(authenticate)

router.get("/", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "You cannot view the user directory" })
    }

    const { status, role } = req.query as Record<string, string>
    const filter: Record<string, unknown> = {}
    if (status && status !== "all") filter.status = status
    if (role && role !== "all") filter.role = role

    const users = await User.find(filter).select("-password").sort({ createdAt: -1 }).lean()
    const workspaces = await Workspace.find()
      .select("name bidderIds callerIds")
      .sort({ name: 1 })
      .lean()
    const memberships = new Map<string, { id: string; name: string }[]>()
    for (const workspace of workspaces) {
      const entry = { id: workspace._id.toString(), name: workspace.name }
      for (const memberId of [...workspace.bidderIds, ...workspace.callerIds]) {
        const key = memberId.toString()
        const list = memberships.get(key) || []
        if (!list.some((item) => item.id === entry.id)) list.push(entry)
        memberships.set(key, list)
      }
    }
    res.json({
      users: users.map((user) => ({
        ...toPublicUser(user),
        workspaces: memberships.get(user._id.toString()) || [],
      })),
    })
  } catch {
    res.status(500).json({ error: "Failed to fetch users" })
  }
})

router.post("/:id/approve", async (req: AuthRequest, res) => {
  try {
    if (!canApproveUsers(req.user!)) {
      return res.status(403).json({ error: "Only a leader can approve accounts" })
    }
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: "User not found" })
    if (user.isSuperAdmin)
      return res.status(400).json({ error: "The superadmin is already active" })

    user.status = "approved"
    await user.save()
    res.json({ user: toPublicUser(user) })
  } catch {
    res.status(500).json({ error: "Failed to approve user" })
  }
})

router.post("/:id/reject", async (req: AuthRequest, res) => {
  try {
    if (!canApproveUsers(req.user!)) {
      return res.status(403).json({ error: "Only a leader can reject accounts" })
    }
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: "User not found" })
    if (user.isSuperAdmin)
      return res.status(400).json({ error: "The superadmin cannot be rejected" })
    if (user._id.toString() === req.userId)
      return res.status(400).json({ error: "You cannot reject yourself" })

    user.status = "rejected"
    await user.save()
    res.json({ user: toPublicUser(user) })
  } catch {
    res.status(500).json({ error: "Failed to reject user" })
  }
})

router.put("/:id/role", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: "Only the superadmin can change roles" })
    }
    const role = req.body.role
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role" })
    }

    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: "User not found" })
    if (user.isSuperAdmin && role !== "leader") {
      return res.status(400).json({ error: "The superadmin stays a leader" })
    }

    const previous = user.role
    user.role = role
    await user.save()

    let assignmentNote: string | undefined
    if (previous !== role) {
      const current = await workspaceIdsForMember(user._id)
      if (role !== "bidder" && role !== "caller") {
        if (current.length) await clearUserWorkspaces(user._id)
      } else if (role === "bidder" && current.length > 1) {
        await clearUserWorkspaces(user._id)
        assignmentNote =
          "They were on several workspaces, so those assignments were cleared. A bidder can belong to one workspace."
      } else if (current.length) {
        await assignUserWorkspaces(
          user,
          current.map((workspace) => workspace.id),
        )
      }
    }

    res.json({ user: toPublicUser(user), assignmentNote })
  } catch {
    res.status(500).json({ error: "Failed to update role" })
  }
})

router.put("/:id/workspaces", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can assign people" })
    }
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: "User not found" })

    const workspaceIds = [...new Set((req.body.workspaceIds || []) as string[])]
    const workspaces = await assignUserWorkspaces(user, workspaceIds)
    res.json({ user: { ...toPublicUser(user), workspaces } })
  } catch (error) {
    if (error instanceof MembershipError) return res.status(400).json({ error: error.message })
    res.status(500).json({ error: "Failed to update workspace assignments" })
  }
})

export { router as usersRouter }
