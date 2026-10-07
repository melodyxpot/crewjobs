import mongoose from "mongoose"
import { ScrapedJob, IScrapedJob } from "../models/ScrapedJob"

type Assignee = { id: string; name: string }

export type RemoteListingInput = {
  title: string
  company: string
  link?: string | null
  platform?: string | null
  location?: string | null
  jobType?: string | null
  notes?: string | null
  workspaceId?: mongoose.Types.ObjectId | string | null
  userId: string
  bidderName: string
  mode: "bid" | "save"
  assignee?: Assignee | null
  replaceAssignee?: boolean
}

function duplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000
}

function listingIdentity(
  link: string | null,
  workspaceId: mongoose.Types.ObjectId | string | null,
  company: string,
  title: string,
) {
  return link ? { link, workspaceId } : { company, title, workspaceId, link: null }
}

function applyListing(existing: IScrapedJob, input: RemoteListingInput, link: string | null) {
  existing.title = input.title
  existing.company = input.company
  existing.platform = input.platform || existing.platform
  existing.location = input.location || existing.location
  existing.workLocation = "Remote"
  existing.jobType = input.jobType || existing.jobType
  if (input.notes) existing.notes = input.notes
  existing.link = link

  const nextAssignee =
    input.mode === "bid" ? { id: input.userId, name: input.bidderName } : input.assignee || null
  if (!nextAssignee) return

  const assigneeId = existing.assignedTo?.toString()
  const sameUser = assigneeId === nextAssignee.id
  const replace = input.mode === "save" && input.replaceAssignee
  if (assigneeId && !sameUser && !replace) return

  existing.assignedTo = nextAssignee.id as unknown as mongoose.Types.ObjectId
  existing.assignedName = nextAssignee.name
  if (input.mode === "bid") {
    existing.status = "applied"
  } else if (existing.status !== "applied") {
    existing.status = "assigned"
  }
}

export async function saveRemoteListing(
  input: RemoteListingInput,
): Promise<{ job: IScrapedJob; created: boolean }> {
  const link = typeof input.link === "string" && input.link.trim() ? input.link.trim() : null
  const workspaceId = input.workspaceId || null
  const identity = listingIdentity(link, workspaceId, input.company, input.title)

  const existing = await ScrapedJob.findOne(identity)
  if (existing) {
    applyListing(existing, input, link)
    try {
      await existing.save()
      return { job: existing, created: false }
    } catch (error) {
      if (!duplicateKey(error) || !link) throw error
      const winner = await ScrapedJob.findOne({ link, workspaceId })
      if (!winner) throw error
      applyListing(winner, input, link)
      await winner.save()
      return { job: winner, created: false }
    }
  }

  const assignee =
    input.mode === "bid" ? { id: input.userId, name: input.bidderName } : input.assignee || null

  try {
    const job = await ScrapedJob.create({
      title: input.title,
      company: input.company,
      link,
      platform: input.platform || "Other",
      location: input.location || null,
      workLocation: "Remote",
      jobType: input.jobType || null,
      notes: input.notes || null,
      workspaceId,
      assignedTo: assignee?.id || null,
      assignedName: assignee?.name || null,
      status: input.mode === "bid" ? "applied" : assignee ? "assigned" : "open",
      scrapedBy: input.userId,
    })
    return { job, created: true }
  } catch (error) {
    if (!duplicateKey(error)) throw error
    const raced = await ScrapedJob.findOne(identity)
    if (!raced) throw error
    applyListing(raced, input, link)
    await raced.save()
    return { job: raced, created: false }
  }
}
