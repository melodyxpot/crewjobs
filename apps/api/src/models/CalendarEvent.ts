import mongoose, { Schema, Document } from "mongoose"

export interface ICalendarEvent extends Document {
  workspaceId: mongoose.Types.ObjectId
  date: string
  startTime: string | null
  endTime: string | null
  client: string
  details: string
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const calendarEventSchema = new Schema<ICalendarEvent>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    date: { type: String, required: true },
    startTime: { type: String, default: null },
    endTime: { type: String, default: null },
    client: { type: String, required: true, trim: true },
    details: { type: String, default: "", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
)

calendarEventSchema.index({ workspaceId: 1, date: 1 })

export const CalendarEvent = mongoose.model<ICalendarEvent>("CalendarEvent", calendarEventSchema)
