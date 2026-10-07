import mongoose, { Schema, Document } from "mongoose"

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId
  senderId: mongoose.Types.ObjectId
  body: string
  createdAt: Date
  updatedAt: Date
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 4000 },
  },
  { timestamps: true }
)

messageSchema.index({ conversationId: 1, createdAt: 1 })

export const Message = mongoose.model<IMessage>("Message", messageSchema)
