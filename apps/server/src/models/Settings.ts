import mongoose, { Schema, Document } from "mongoose"

export interface ISettings extends Document {
  userId: mongoose.Types.ObjectId
  defaultPlatform: string
  defaultStatus: string
  followUpOffsetDays: number
  platformOptions: string[]
  locationOptions: string[]
  workLocationOptions: string[]
  defaultLocation: string
  defaultWorkLocation: string
  createdAt: Date
  updatedAt: Date
}

const settingsSchema = new Schema<ISettings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    defaultPlatform: { type: String, default: "LinkedIn" },
    defaultStatus: { type: String, default: "Applied" },
    followUpOffsetDays: { type: Number, default: 7 },
    platformOptions: { type: [String], default: ["LinkedIn", "Wellfound", "Indeed", "Company Website", "Other"] },
    locationOptions: { type: [String], default: ["US", "EU", "Asia"] },
    workLocationOptions: { type: [String], default: ["Remote", "Hybrid", "Onsite"] },
    defaultLocation: { type: String, default: "US" },
    defaultWorkLocation: { type: String, default: "Remote" },
  },
  { timestamps: true }
)

export const Settings = mongoose.model<ISettings>("Settings", settingsSchema)
