import { Router } from "express"
import { authenticate, AuthRequest } from "../middleware/auth"
import { JobApplication } from "../models/JobApplication"
import { ScrapedJob } from "../models/ScrapedJob"
import { isManager } from "../lib/roles"
import { workspacesForUser } from "../lib/workspace-scope"

function toDateStr(date: Date, tz: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: tz })
}

function periodStarts(now = new Date()) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return { startOfDay, startOfWeek, startOfMonth }
}

async function dashboardView(req: AuthRequest) {
  const user = req.user!
  if (isManager(user)) {
    return {
      applicationFilter: {} as Record<string, unknown>,
      scope: "all" as const,
      includeScraped: true,
    }
  }
  if (user.role === "finance") {
    return { applicationFilter: {}, scope: "all" as const, includeScraped: false }
  }
  if (user.role === "caller") {
    const workspaces = await workspacesForUser(user)
    return {
      applicationFilter: { workspaceId: { $in: workspaces.map((workspace) => workspace._id) } },
      scope: "workspace" as const,
      includeScraped: false,
    }
  }
  return {
    applicationFilter: { userId: req.userId },
    scope: "own" as const,
    includeScraped: false,
  }
}

function scrapedMatch(since: Date) {
  return {
    source: { $ne: "manual" },
    $expr: { $gte: [{ $ifNull: ["$scrapedAt", "$createdAt"] }, since] },
  }
}

async function scrapedSince(since: Date) {
  const rows = await ScrapedJob.aggregate<{ count: number }>([
    { $match: scrapedMatch(since) },
    {
      $group: {
        _id: { $ifNull: ["$link", { $concat: ["$company", "|", "$title"] }] },
      },
    },
    { $count: "count" },
  ])
  return rows[0]?.count || 0
}

const router = Router()
router.use(authenticate)

router.get("/stats", async (req: AuthRequest, res) => {
  try {
    const { applicationFilter, scope, includeScraped } = await dashboardView(req)
    const { startOfDay, startOfWeek, startOfMonth } = periodStarts()

    const [today, week, month, interviews, total, scrapedToday, scrapedThisWeek, scrapedThisMonth] =
      await Promise.all([
        JobApplication.countDocuments({ ...applicationFilter, appliedAt: { $gte: startOfDay } }),
        JobApplication.countDocuments({ ...applicationFilter, appliedAt: { $gte: startOfWeek } }),
        JobApplication.countDocuments({ ...applicationFilter, appliedAt: { $gte: startOfMonth } }),
        JobApplication.countDocuments({ ...applicationFilter, status: "Interview" }),
        JobApplication.countDocuments(applicationFilter),
        includeScraped ? scrapedSince(startOfDay) : Promise.resolve(undefined),
        includeScraped ? scrapedSince(startOfWeek) : Promise.resolve(undefined),
        includeScraped ? scrapedSince(startOfMonth) : Promise.resolve(undefined),
      ])

    const responseRate = total > 0 ? Math.round((interviews / total) * 100) : 0

    res.json({
      stats: {
        scope,
        applicationsToday: today,
        applicationsThisWeek: week,
        applicationsThisMonth: month,
        interviewsCount: interviews,
        responseRate,
        ...(includeScraped ? { scrapedToday, scrapedThisWeek, scrapedThisMonth } : {}),
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to get stats" })
  }
})

router.get("/chart", async (req: AuthRequest, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 14, 1), 90)
    const tz = (req.query.tz as string) || "UTC"
    const { applicationFilter, includeScraped } = await dashboardView(req)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const countsByDate: Record<string, number> = {}
    const scrapedByDate: Record<string, number> = {}
    for (let i = 0; i <= days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - (days - i))
      const key = toDateStr(date, tz)
      countsByDate[key] = 0
      scrapedByDate[key] = 0
    }

    const applications = await JobApplication.find({
      ...applicationFilter,
      appliedAt: { $gte: startDate },
    })
      .select("appliedAt")
      .sort({ appliedAt: 1 })
      .lean()

    applications.forEach((app) => {
      const dateStr = toDateStr(new Date(app.appliedAt), tz)
      if (countsByDate[dateStr] !== undefined) countsByDate[dateStr]++
    })

    if (includeScraped) {
      const jobs = await ScrapedJob.find({
        source: { $ne: "manual" },
        $or: [
          { scrapedAt: { $gte: startDate } },
          { scrapedAt: null, createdAt: { $gte: startDate } },
        ],
      })
        .select("createdAt scrapedAt link company title")
        .lean()
      const seen = new Set<string>()
      jobs.forEach((job) => {
        const dateStr = toDateStr(new Date(job.scrapedAt || job.createdAt), tz)
        if (scrapedByDate[dateStr] === undefined) return
        const identity = job.link || `${job.company}|${job.title}`
        const key = `${dateStr}|${identity}`
        if (seen.has(key)) return
        seen.add(key)
        scrapedByDate[dateStr]++
      })
    }

    const data = Object.entries(countsByDate).map(([date, count]) => ({
      date,
      count,
      ...(includeScraped ? { scraped: scrapedByDate[date] } : {}),
    }))
    res.json({ data })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to get chart data" })
  }
})

export { router as dashboardRouter }
