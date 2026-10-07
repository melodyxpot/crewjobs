import { randomUUID } from "node:crypto"
import { Router } from "express"
import mongoose from "mongoose"
import { authenticate, AuthRequest } from "../middleware/auth"
import { JOB_REGIONS, SCRAPE_REGIONS, SCRAPED_JOB_SOURCES, ScrapedJob } from "../models/ScrapedJob"
import type { ScrapeRegion } from "../models/ScrapedJob"
import { Settings } from "../models/Settings"
import { User } from "../models/User"
import { Workspace } from "../models/Workspace"
import {
  isScraperSourceId,
  sourceLabel,
  sourceReady,
  SCRAPER_CATALOG,
} from "../lib/job-scraper/catalog"
import { scrapeSources } from "../lib/job-scraper/run"
import { displayName, isManager, isRemoteWorkLocation } from "../lib/roles"
import { saveRemoteListing } from "../lib/remote-job"
import { resolveWorkspaceId, workspacesForUser } from "../lib/workspace-scope"

const router = Router()
router.use(authenticate)

async function visibleJobFilter(req: AuthRequest) {
  const user = req.user!
  const filter: Record<string, unknown> = { workLocation: "Remote" }
  if (isManager(user) || user.role === "finance" || user.role === "developer") return filter

  const workspaces = await workspacesForUser(user)
  const ids = workspaces.map((workspace) => workspace._id)
  if (user.role === "bidder") {
    filter.$or = [{ workspaceId: { $in: ids } }, { assignedTo: user._id }, { scrapedBy: user._id }]
    return filter
  }
  filter.workspaceId = { $in: ids }
  return filter
}

router.get("/", async (req: AuthRequest, res) => {
  try {
    const {
      page = "1",
      pageSize = "20",
      search,
      workspaceId,
      assignedTo,
      status,
      region,
      source,
    } = req.query as Record<string, string>
    const filter: any = await visibleJobFilter(req)

    if (workspaceId && workspaceId !== "all") {
      if (workspaceId === "unassigned") {
        const seesPool =
          isManager(req.user!) || req.user!.role === "finance" || req.user!.role === "developer"
        if (!seesPool) return res.status(403).json({ error: "You cannot view that workspace" })
        filter.workspaceId = null
      } else {
        const workspaces = await workspacesForUser(req.user!)
        const allowed =
          isManager(req.user!) ||
          req.user!.role === "finance" ||
          req.user!.role === "developer" ||
          workspaces.some((workspace) => workspace._id.toString() === workspaceId)
        if (!allowed) return res.status(403).json({ error: "You cannot view that workspace" })
        filter.workspaceId = workspaceId
      }
      delete filter.$or
    }
    if (region && region !== "all") {
      if (!JOB_REGIONS.includes(region as (typeof JOB_REGIONS)[number])) {
        return res.status(400).json({ error: "Unknown region" })
      }
      filter.region = region
    }
    if (source && source !== "all") {
      if (!SCRAPED_JOB_SOURCES.includes(source as (typeof SCRAPED_JOB_SOURCES)[number])) {
        return res.status(400).json({ error: "Unknown source" })
      }
      filter.source = source
    }
    if (assignedTo && assignedTo !== "all") {
      filter.assignedTo = assignedTo === "unassigned" ? null : assignedTo
    }
    if (status && status !== "all") filter.status = status
    if (search) {
      const searchFilter = [
        { company: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
      ]
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchFilter }]
        delete filter.$or
      } else {
        filter.$or = searchFilter
      }
    }

    const pageNum = Math.max(parseInt(page) || 1, 1)
    const size = Math.min(parseInt(pageSize) || 20, 100)
    const [data, count] = await Promise.all([
      ScrapedJob.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * size)
        .limit(size)
        .populate("workspaceId", "name")
        .populate("assignedTo", "username name email")
        .lean(),
      ScrapedJob.countDocuments(filter),
    ])

    res.json({
      data: data.map((job: any) => ({
        ...job,
        workspaceName: job.workspaceId?.name || "",
        workspaceId: job.workspaceId?._id || job.workspaceId || null,
        assignedName: job.assignedName || job.assignedTo?.username || job.assignedTo?.name || "",
        assignedTo: job.assignedTo?._id || job.assignedTo || null,
      })),
      count,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to fetch jobs" })
  }
})

router.post("/", async (req: AuthRequest, res) => {
  try {
    const { title, company, link, platform, location, workLocation, jobType, notes, assignedTo } =
      req.body
    if (!title?.trim() || !company?.trim()) {
      return res.status(400).json({ error: "Company and job title are required" })
    }
    if (!isRemoteWorkLocation(workLocation)) {
      return res.status(400).json({ error: "Only remote jobs can be saved" })
    }

    const resolved = await resolveWorkspaceId(req.user!, req.body.workspaceId || null)
    if (resolved.error) return res.status(400).json({ error: resolved.error })

    let assignee: { id: string; name: string } | null = null
    let replaceAssignee = false
    if (req.user!.role === "bidder") {
      assignee = { id: req.userId!, name: displayName(req.user!) }
    } else if (assignedTo) {
      if (!isManager(req.user!)) {
        return res.status(403).json({ error: "Only a leader or moderator can assign jobs" })
      }
      const bidder = await User.findOne({ _id: assignedTo, role: "bidder", status: "approved" })
      if (!bidder)
        return res.status(400).json({ error: "Jobs can only be assigned to an approved bidder" })
      if (resolved.workspaceId) {
        const workspace = await Workspace.findById(resolved.workspaceId)
        const inWorkspace = workspace?.bidderIds.some(
          (id) => id.toString() === bidder._id.toString(),
        )
        if (!inWorkspace) {
          return res.status(400).json({ error: "That bidder is not assigned to this workspace" })
        }
      }
      assignee = { id: bidder._id.toString(), name: displayName(bidder) }
      replaceAssignee = true
    }

    const saved = await saveRemoteListing({
      title: title.trim(),
      company: company.trim(),
      link,
      platform,
      location,
      jobType,
      notes,
      workspaceId: resolved.workspaceId,
      userId: req.userId!,
      bidderName: displayName(req.user!),
      mode: "save",
      assignee,
      replaceAssignee,
    })

    res.status(saved.created ? 201 : 200).json({ data: saved.job })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to save job" })
  }
})

router.get("/sources", async (req: AuthRequest, res) => {
  if (!isManager(req.user!)) {
    return res.status(403).json({ error: "Only a leader or moderator can scrape jobs" })
  }
  res.json({
    sources: SCRAPER_CATALOG.map((source) => ({
      ...source,
      ready: sourceReady(source.id),
    })),
  })
})

router.post("/scrape", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can scrape jobs" })
    }
    const regions = Array.isArray(req.body?.regions) ? req.body.regions : []
    const uniqueRegions = [
      ...new Set(regions.filter((region: unknown) => typeof region === "string")),
    ]
    if (
      uniqueRegions.length === 0 ||
      uniqueRegions.some((region) => !SCRAPE_REGIONS.includes(region as ScrapeRegion))
    ) {
      return res.status(400).json({ error: "Choose at least one region" })
    }

    const settings = await Settings.findOne({ userId: req.userId })
    const selected = (
      settings?.scraperSources?.length ? settings.scraperSources : ["public"]
    ).filter(isScraperSourceId)
    const ready = selected.filter((id) => sourceReady(id))
    if (ready.length === 0) {
      return res.status(400).json({
        error: "No selected job source is ready. Turn on Public remote boards or add an API key.",
      })
    }

    const harvested = await scrapeSources(uniqueRegions as ScrapeRegion[], ready)
    const failedSources = [
      ...selected
        .filter((id) => !sourceReady(id))
        .map((id) => ({ id, label: sourceLabel(id), error: "API key is not configured" })),
      ...harvested.failedSources,
    ]
    const batchId = randomUUID()
    const createdIds: string[] = []
    let duplicates = harvested.duplicates

    for (const listing of harvested.listings) {
      if (listing.link) {
        const existing = await ScrapedJob.findOne({ link: listing.link }).select("_id")
        if (existing) {
          duplicates += 1
          continue
        }
      }
      const saved = await saveRemoteListing({
        title: listing.title,
        company: listing.company,
        link: listing.link,
        platform: listing.platform,
        location: listing.location,
        workspaceId: null,
        userId: req.userId!,
        bidderName: displayName(req.user!),
        mode: "save",
        region: listing.region,
        source: listing.source,
        scrapeBatchId: batchId,
      })
      if (saved.created) createdIds.push(saved.job._id.toString())
      else duplicates += 1
    }

    res.json({
      created: createdIds.length,
      duplicates,
      rejected: harvested.rejected,
      failedSources,
      batchId,
      createdIds,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to scrape jobs" })
  }
})

router.post("/assign", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can assign jobs" })
    }
    const jobIds = [
      ...new Set(
        (Array.isArray(req.body?.jobIds) ? req.body.jobIds : []).filter(
          (id: unknown): id is string => typeof id === "string",
        ),
      ),
    ]
    const workspaceIds = [
      ...new Set(
        (Array.isArray(req.body?.workspaceIds) ? req.body.workspaceIds : []).filter(
          (id: unknown): id is string => typeof id === "string",
        ),
      ),
    ]
    if (jobIds.length === 0 || workspaceIds.length === 0) {
      return res.status(400).json({ error: "Choose jobs and at least one workspace" })
    }
    if (jobIds.length > 300) return res.status(400).json({ error: "Select 300 jobs or fewer" })
    if (
      jobIds.some((id) => !mongoose.isValidObjectId(id)) ||
      workspaceIds.some((id) => !mongoose.isValidObjectId(id))
    ) {
      return res.status(400).json({ error: "Job or workspace not found" })
    }

    const workspaces = await Workspace.find({ _id: { $in: workspaceIds } })
    if (workspaces.length !== workspaceIds.length) {
      return res.status(400).json({ error: "Workspace not found" })
    }

    let created = 0
    let skipped = 0
    let removed = 0
    for (const jobId of jobIds) {
      const job = await ScrapedJob.findById(jobId)
      if (!job) {
        skipped += 1
        continue
      }
      let copied = 0
      for (const workspace of workspaces) {
        const saved = await saveRemoteListing({
          title: job.title,
          company: job.company,
          link: job.link,
          platform: job.platform,
          location: job.location,
          jobType: job.jobType,
          notes: job.notes,
          workspaceId: workspace._id,
          userId: req.userId!,
          bidderName: displayName(req.user!),
          mode: "save",
          region: job.region,
          source: job.source,
          scrapeBatchId: job.scrapeBatchId,
        })
        if (saved.created) {
          created += 1
          copied += 1
        } else skipped += 1
      }
      if (!job.workspaceId && copied > 0) {
        await ScrapedJob.findByIdAndDelete(job._id)
        removed += 1
      }
    }

    res.json({ created, skipped, removed })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to assign jobs" })
  }
})

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res
        .status(403)
        .json({ error: "Only a leader or moderator can update job assignments" })
    }
    const job = await ScrapedJob.findById(req.params.id)
    if (!job) return res.status(404).json({ error: "Job not found" })

    if (req.body.workspaceId !== undefined) {
      if (!req.body.workspaceId) {
        job.workspaceId = null
      } else if (!mongoose.isValidObjectId(req.body.workspaceId)) {
        return res.status(400).json({ error: "Workspace not found" })
      } else {
        const workspace = await Workspace.findById(req.body.workspaceId)
        if (!workspace) return res.status(400).json({ error: "Workspace not found" })
        job.workspaceId = workspace._id
      }
    }

    if (req.body.assignedTo !== undefined) {
      if (!req.body.assignedTo) {
        job.assignedTo = null
        job.assignedName = null
        if (job.status !== "applied") job.status = "open"
      } else {
        const bidder = await User.findOne({
          _id: req.body.assignedTo,
          role: "bidder",
          status: "approved",
        })
        if (!bidder)
          return res.status(400).json({ error: "Jobs can only be assigned to an approved bidder" })
        if (job.workspaceId) {
          const workspace = await Workspace.findById(job.workspaceId)
          const inWorkspace = workspace?.bidderIds.some(
            (id) => id.toString() === bidder._id.toString(),
          )
          if (!inWorkspace) {
            return res.status(400).json({ error: "That bidder is not assigned to this workspace" })
          }
        }
        job.assignedTo = bidder._id
        job.assignedName = displayName(bidder)
        if (job.status !== "applied") job.status = "assigned"
      }
    }

    if (req.body.status && ["open", "assigned", "applied"].includes(req.body.status)) {
      job.status = req.body.status
    }

    await job.save()
    res.json({ data: job })
  } catch {
    res.status(500).json({ error: "Failed to update job" })
  }
})

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can delete jobs" })
    }
    const job = await ScrapedJob.findByIdAndDelete(req.params.id)
    if (!job) return res.status(404).json({ error: "Job not found" })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: "Failed to delete job" })
  }
})

export { router as jobsRouter }
