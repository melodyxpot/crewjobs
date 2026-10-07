import mongoose, { Schema, Document } from "mongoose"

export interface IJobApplication extends Document {
  userId: mongoose.Types.ObjectId
  appliedAt: Date
  company: string
  title: string
  platform: string
  status: string
  followUpAt: Date | null
  link: string | null
  location: string | null
  workLocation: string | null
  jobType: string | null
  notes: string | null
  resume: string | null
  workspaceId: mongoose.Types.ObjectId | null
  bidderName: string
  createdAt: Date
  updatedAt: Date
}

const jobApplicationSchema = new Schema<IJobApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    appliedAt: { type: Date, required: true, default: Date.now },
    company: { type: String, required: true },
    title: { type: String, required: true },
    platform: { type: String, required: true, default: "LinkedIn" },
    status: { type: String, required: true, default: "Applied" },
    followUpAt: { type: Date, default: null },
    link: { type: String, default: null },
    location: { type: String, default: null },
    workLocation: { type: String, default: null },
    jobType: { type: String, default: null },
    notes: { type: String, default: null },
    resume: { type: String, default: null },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null, index: true },
    bidderName: { type: String, default: "" },
  },
  { timestamps: true }
)

jobApplicationSchema.index({ userId: 1, appliedAt: -1 })
jobApplicationSchema.index({ userId: 1, status: 1 })

export const JobApplication = mongoose.model<IJobApplication>("JobApplication", jobApplicationSchema)
