import { Router } from "express"
import { authenticate, AuthRequest } from "../middleware/auth"
import { Team } from "../models/Team"
import { User } from "../models/User"
import { JobApplication } from "../models/JobApplication"

function toDateStr(date: Date, tz: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: tz })
}

const router = Router()
router.use(authenticate)

// GET /api/teams - Get all teams the user belongs to
router.get("/", async (req: AuthRequest, res) => {
  try {
    const teams = await Team.find({ "members.userId": req.userId })
      .populate("members.userId", "email name")
      .lean()
    res.json({ teams })
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch teams" })
  }
})

// POST /api/teams - Create a new team
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) {
      return res.status(400).json({ error: "Team name is required" })
    }

    const team = await Team.create({
      name: name.trim(),
      createdBy: req.userId,
      members: [{ userId: req.userId, role: "leader", joinedAt: new Date() }],
    })

    const populated = await Team.findById(team._id)
      .populate("members.userId", "email name")
      .lean()

    res.status(201).json({ team: populated })
  } catch (error) {
    res.status(500).json({ error: "Failed to create team" })
  }
})

// GET /api/teams/:id - Get team details
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const team = await Team.findOne({
      _id: req.params.id,
      "members.userId": req.userId,
    })
      .populate("members.userId", "email name")
      .lean()

    if (!team) {
      return res.status(404).json({ error: "Team not found" })
    }

    res.json({ team })
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch team" })
  }
})

// PUT /api/teams/:id - Update team name (leader only)
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const team = await Team.findById(req.params.id)
    if (!team) return res.status(404).json({ error: "Team not found" })

    const member = team.members.find(m => m.userId.toString() === req.userId)
    if (!member || member.role !== "leader") {
      return res.status(403).json({ error: "Only leaders can update the team" })
    }

    if (req.body.name) team.name = req.body.name.trim()
    await team.save()

    const populated = await Team.findById(team._id)
      .populate("members.userId", "email name")
      .lean()

    res.json({ team: populated })
  } catch (error) {
    res.status(500).json({ error: "Failed to update team" })
  }
})

// DELETE /api/teams/:id - Delete team (leader only)
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const team = await Team.findById(req.params.id)
    if (!team) return res.status(404).json({ error: "Team not found" })

    const member = team.members.find(m => m.userId.toString() === req.userId)
    if (!member || member.role !== "leader") {
      return res.status(403).json({ error: "Only leaders can delete the team" })
    }

    await Team.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to delete team" })
  }
})

// POST /api/teams/:id/members - Add member by email (leader only)
router.post("/:id/members", async (req: AuthRequest, res) => {
  try {
    const { email, role = "member" } = req.body
    if (!email) return res.status(400).json({ error: "Email is required" })

    const team = await Team.findById(req.params.id)
    if (!team) return res.status(404).json({ error: "Team not found" })

    const requester = team.members.find(m => m.userId.toString() === req.userId)
    if (!requester || requester.role !== "leader") {
      return res.status(403).json({ error: "Only leaders can add members" })
    }

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) return res.status(404).json({ error: "User not found with that email" })

    const existing = team.members.find(m => m.userId.toString() === user._id.toString())
    if (existing) return res.status(400).json({ error: "User is already a member" })

    team.members.push({
      userId: user._id as any,
      role: role === "leader" ? "leader" : "member",
      joinedAt: new Date(),
    })
    await team.save()

    const populated = await Team.findById(team._id)
      .populate("members.userId", "email name")
      .lean()

    res.json({ team: populated })
  } catch (error) {
    res.status(500).json({ error: "Failed to add member" })
  }
})

// PUT /api/teams/:id/members/:userId/role - Change member role (leader only)
router.put("/:id/members/:userId/role", async (req: AuthRequest, res) => {
  try {
    const { role } = req.body
    if (!["leader", "member"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" })
    }

    const team = await Team.findById(req.params.id)
    if (!team) return res.status(404).json({ error: "Team not found" })

    const requester = team.members.find(m => m.userId.toString() === req.userId)
    if (!requester || requester.role !== "leader") {
      return res.status(403).json({ error: "Only leaders can change roles" })
    }

    const member = team.members.find(m => m.userId.toString() === req.params.userId)
    if (!member) return res.status(404).json({ error: "Member not found" })

    member.role = role
    await team.save()

    const populated = await Team.findById(team._id)
      .populate("members.userId", "email name")
      .lean()

    res.json({ team: populated })
  } catch (error) {
    res.status(500).json({ error: "Failed to update role" })
  }
})

// DELETE /api/teams/:id/members/:userId - Remove member (leader only)
router.delete("/:id/members/:userId", async (req: AuthRequest, res) => {
  try {
    const team = await Team.findById(req.params.id)
    if (!team) return res.status(404).json({ error: "Team not found" })

    const requester = team.members.find(m => m.userId.toString() === req.userId)
    if (!requester || requester.role !== "leader") {
      return res.status(403).json({ error: "Only leaders can remove members" })
    }

    if (req.params.userId === req.userId) {
      return res.status(400).json({ error: "Cannot remove yourself" })
    }

    team.members = team.members.filter(m => m.userId.toString() !== req.params.userId) as any
    await team.save()

    const populated = await Team.findById(team._id)
      .populate("members.userId", "email name")
      .lean()

    res.json({ team: populated })
  } catch (error) {
    res.status(500).json({ error: "Failed to remove member" })
  }
})

// POST /api/teams/:id/leave - Leave team (member only, not last leader)
router.post("/:id/leave", async (req: AuthRequest, res) => {
  try {
    const team = await Team.findById(req.params.id)
    if (!team) return res.status(404).json({ error: "Team not found" })

    const member = team.members.find(m => m.userId.toString() === req.userId)
    if (!member) return res.status(400).json({ error: "Not a member" })

    if (member.role === "leader") {
      const otherLeaders = team.members.filter(m => m.role === "leader" && m.userId.toString() !== req.userId)
      if (otherLeaders.length === 0) {
        return res.status(400).json({ error: "Cannot leave — you are the only leader. Promote someone else first." })
      }
    }

    team.members = team.members.filter(m => m.userId.toString() !== req.userId) as any
    await team.save()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to leave team" })
  }
})

// GET /api/teams/:id/dashboard - Team dashboard stats (leader only)
router.get("/:id/dashboard", async (req: AuthRequest, res) => {
  try {
    const team = await Team.findOne({
      _id: req.params.id,
      "members.userId": req.userId,
    }).populate("members.userId", "email name").lean()

    if (!team) return res.status(404).json({ error: "Team not found" })

    const requester = team.members.find((m: any) => {
      const uid = m.userId?._id?.toString() || m.userId?.toString()
      return uid === req.userId
    })
    if (!requester || (requester as any).role !== "leader") {
      return res.status(403).json({ error: "Only leaders can view team dashboard" })
    }

    const memberIds = team.members.map((m: any) => m.userId?._id || m.userId)
    const days = parseInt(req.query.days as string) || 14
    const tz = (req.query.tz as string) || "UTC"

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get all applications for all members in the date range
    const applications = await JobApplication.find({
      userId: { $in: memberIds },
      appliedAt: { $gte: startDate },
    }).select("userId appliedAt").lean()

    // Build per-member chart data
    const memberChartData: Record<string, Record<string, number>> = {}
    const memberInfo: Record<string, { email: string; name: string }> = {}

    for (const m of team.members) {
      const uid = (m.userId as any)?._id?.toString() || (m.userId as any)?.toString()
      memberInfo[uid] = {
        email: (m.userId as any)?.email || "",
        name: (m.userId as any)?.name || (m.userId as any)?.email || "",
      }
      memberChartData[uid] = {}
      for (let i = 0; i <= days; i++) {
        const d = new Date()
        d.setDate(d.getDate() - (days - i))
        memberChartData[uid][toDateStr(d, tz)] = 0
      }
    }

    for (const app of applications) {
      const uid = app.userId.toString()
      const dateStr = toDateStr(new Date(app.appliedAt), tz)
      if (memberChartData[uid]?.[dateStr] !== undefined) {
        memberChartData[uid][dateStr]++
      }
    }

    // Build chart data array: each date has counts per member
    const dates: string[] = []
    for (let i = 0; i <= days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (days - i))
      dates.push(toDateStr(d, tz))
    }

    const chartData = dates.map(date => {
      const entry: any = { date }
      for (const uid of Object.keys(memberChartData)) {
        const displayName = memberInfo[uid]?.name || memberInfo[uid]?.email || uid
        entry[displayName] = memberChartData[uid][date] || 0
      }
      return entry
    })

    // Monthly stats
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const monthlyApps = await JobApplication.find({
      userId: { $in: memberIds },
      appliedAt: { $gte: startOfMonth },
    }).select("userId").lean()

    const monthlyCounts: Record<string, number> = {}
    for (const uid of Object.keys(memberInfo)) {
      monthlyCounts[uid] = 0
    }
    for (const app of monthlyApps) {
      const uid = app.userId.toString()
      if (monthlyCounts[uid] !== undefined) monthlyCounts[uid]++
    }

    const memberStats = Object.entries(memberInfo).map(([uid, info]) => ({
      userId: uid,
      email: info.email,
      name: info.name,
      role: team.members.find((m: any) => ((m.userId as any)?._id?.toString() || (m.userId as any)?.toString()) === uid)?.role || "member",
      monthlyCount: monthlyCounts[uid] || 0,
    }))

    res.json({
      team: { _id: team._id, name: team.name },
      chartData,
      memberStats,
      memberNames: Object.values(memberInfo).map(m => m.name || m.email),
    })
  } catch (error) {
    console.error("Team dashboard error:", error)
    res.status(500).json({ error: "Failed to get team dashboard" })
  }
})

// GET /api/teams/:id/applications - All team member applications (leader only)
router.get("/:id/applications", async (req: AuthRequest, res) => {
  try {
    const team = await Team.findOne({
      _id: req.params.id,
      "members.userId": req.userId,
    }).populate("members.userId", "email name").lean()

    if (!team) return res.status(404).json({ error: "Team not found" })

    const requester = team.members.find((m: any) => {
      const uid = m.userId?._id?.toString() || m.userId?.toString()
      return uid === req.userId
    })
    if (!requester || (requester as any).role !== "leader") {
      return res.status(403).json({ error: "Only leaders can view team applications" })
    }

    const memberIds = team.members.map((m: any) => m.userId?._id || m.userId)

    const {
      page = "1",
      pageSize = "20",
      search,
      sortBy = "appliedAt",
      sortOrder = "desc",
      memberId,
    } = req.query as Record<string, string>

    const filter: any = { userId: { $in: memberIds } }
    if (memberId) filter.userId = memberId
    if (search) {
      filter.$or = [
        { company: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
      ]
    }

    const pageNum = parseInt(page)
    const size = parseInt(pageSize)
    const skip = (pageNum - 1) * size
    const sort: any = { [sortBy]: sortOrder === "asc" ? 1 : -1 }

    const [data, count] = await Promise.all([
      JobApplication.find(filter).sort(sort).skip(skip).limit(size).populate("userId", "email name").lean(),
      JobApplication.countDocuments(filter),
    ])

    // Remap userId to user info
    const mapped = data.map((app: any) => ({
      ...app,
      memberEmail: app.userId?.email || "",
      memberName: app.userId?.name || app.userId?.email || "",
      userId: app.userId?._id || app.userId,
    }))

    res.json({ data: mapped, count })
  } catch (error) {
    res.status(500).json({ error: "Failed to get team applications" })
  }
})

export { router as teamRouter }
