import mongoose, { Schema, Document } from "mongoose"

export interface IConversationRead {
  userId: mongoose.Types.ObjectId
  readAt: Date
}

export interface IConversation extends Document {
  kind: "dm" | "channel"
  name: string
  createdBy: mongoose.Types.ObjectId | null
  participants: mongoose.Types.ObjectId[]
  lastMessage: string
  lastMessageAt: Date | null
  lastSenderId: mongoose.Types.ObjectId | null
  reads: IConversationRead[]
  createdAt: Date
  updatedAt: Date
}

const readSchema = new Schema<IConversationRead>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, required: true },
  },
  { _id: false },
)

const conversationSchema = new Schema<IConversation>(
  {
    kind: { type: String, enum: ["dm", "channel"], default: "dm" },
    name: { type: String, default: "", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    participants: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], required: true },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    lastSenderId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reads: { type: [readSchema], default: [] },
  },
  { timestamps: true },
)

conversationSchema.index({ participants: 1 })
conversationSchema.index({ lastMessageAt: -1 })
conversationSchema.index({ kind: 1, name: 1 })

export const Conversation = mongoose.model<IConversation>("Conversation", conversationSchema)
