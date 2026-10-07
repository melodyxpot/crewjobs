import { Router } from "express"
import { authenticate, AuthRequest } from "../middleware/auth"
import { User } from "../models/User"
import { USER_ROLES, canApproveUsers, toPublicUser } from "../lib/roles"
import { isManager } from "../lib/roles"

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
    res.json({ users: users.map(toPublicUser) })
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
    if (user.isSuperAdmin) return res.status(400).json({ error: "The superadmin is already active" })

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
    if (user.isSuperAdmin) return res.status(400).json({ error: "The superadmin cannot be rejected" })
    if (user._id.toString() === req.userId) return res.status(400).json({ error: "You cannot reject yourself" })

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

    user.role = role
    await user.save()
    res.json({ user: toPublicUser(user) })
  } catch {
    res.status(500).json({ error: "Failed to update role" })
  }
})

export { router as usersRouter }
