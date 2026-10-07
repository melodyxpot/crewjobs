import mongoose, { Schema, Document } from "mongoose"

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[]
  lastMessage: string
  lastMessageAt: Date | null
  lastSenderId: mongoose.Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], required: true },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    lastSenderId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
)

conversationSchema.index({ participants: 1 })
conversationSchema.index({ lastMessageAt: -1 })

export const Conversation = mongoose.model<IConversation>("Conversation", conversationSchema)
