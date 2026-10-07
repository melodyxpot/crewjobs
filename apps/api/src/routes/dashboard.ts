import { Router } from "express"
import { authenticate, AuthRequest } from "../middleware/auth"
import { JobApplication } from "../models/JobApplication"

function toDateStr(date: Date, tz: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: tz })
}

const router = Router()
router.use(authenticate)

// GET /api/dashboard/stats
router.get("/stats", async (req: AuthRequest, res) => {
  try {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfDay)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [today, week, month, interviews, total] = await Promise.all([
      JobApplication.countDocuments({ userId: req.userId, appliedAt: { $gte: startOfDay } }),
      JobApplication.countDocuments({ userId: req.userId, appliedAt: { $gte: startOfWeek } }),
      JobApplication.countDocuments({ userId: req.userId, appliedAt: { $gte: startOfMonth } }),
      JobApplication.countDocuments({ userId: req.userId, status: "Interview" }),
      JobApplication.countDocuments({ userId: req.userId }),
    ])

    const responseRate = total > 0 ? Math.round((interviews / total) * 100) : 0

    res.json({
      stats: {
        applicationsToday: today,
        applicationsThisWeek: week,
        applicationsThisMonth: month,
        interviewsCount: interviews,
        responseRate,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to get stats" })
  }
})

// GET /api/dashboard/chart?days=14
router.get("/chart", async (req: AuthRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 14
    const tz = (req.query.tz as string) || "UTC"
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const data = await JobApplication.find({
      userId: req.userId,
      appliedAt: { $gte: startDate },
    })
      .select("appliedAt")
      .sort({ appliedAt: 1 })
      .lean()

    const countsByDate: Record<string, number> = {}
    for (let i = 0; i <= days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - (days - i))
      countsByDate[toDateStr(date, tz)] = 0
    }

    data.forEach((app) => {
      const dateStr = toDateStr(new Date(app.appliedAt), tz)
      if (countsByDate[dateStr] !== undefined) {
        countsByDate[dateStr]++
      }
    })

    const chartData = Object.entries(countsByDate).map(([date, count]) => ({ date, count }))
    res.json({ data: chartData })
  } catch (error) {
    res.status(500).json({ error: "Failed to get chart data" })
  }
})

export { router as dashboardRouter }
