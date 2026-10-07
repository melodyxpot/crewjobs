import mongoose, { Schema, Document } from "mongoose"

export type ScrapedJobStatus = "open" | "assigned" | "applied"

export interface IScrapedJob extends Document {
  workspaceId: mongoose.Types.ObjectId | null
  title: string
  company: string
  link: string | null
  platform: string
  location: string | null
  workLocation: string
  jobType: string | null
  notes: string | null
  assignedTo: mongoose.Types.ObjectId | null
  assignedName: string | null
  status: ScrapedJobStatus
  scrapedBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const scrapedJobSchema = new Schema<IScrapedJob>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null, index: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    link: { type: String, default: null },
    platform: { type: String, default: "Other" },
    location: { type: String, default: null },
    workLocation: { type: String, default: "Remote" },
    jobType: { type: String, default: null },
    notes: { type: String, default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedName: { type: String, default: null },
    status: { type: String, enum: ["open", "assigned", "applied"], default: "open" },
    scrapedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

scrapedJobSchema.index(
  { link: 1, workspaceId: 1 },
  {
    unique: true,
    partialFilterExpression: { link: { $type: "string" } },
    name: "scraped_job_link_workspace_unique",
  }
)
scrapedJobSchema.index({ company: 1, title: 1, workspaceId: 1 })

export const ScrapedJob = mongoose.model<IScrapedJob>("ScrapedJob", scrapedJobSchema)
