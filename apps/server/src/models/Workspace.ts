import mongoose, { Schema, Document } from "mongoose"

export interface IWorkspace extends Document {
  name: string
  createdBy: mongoose.Types.ObjectId
  bidderIds: mongoose.Types.ObjectId[]
  callerIds: mongoose.Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bidderIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    callerIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
  },
  { timestamps: true }
)

workspaceSchema.index({ bidderIds: 1 })
workspaceSchema.index({ callerIds: 1 })

export const Workspace = mongoose.model<IWorkspace>("Workspace", workspaceSchema)
