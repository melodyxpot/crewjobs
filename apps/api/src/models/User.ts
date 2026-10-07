import mongoose, { Schema, Document } from "mongoose"
import type { AccountStatus, UserRole } from "../lib/roles"

export interface IUser extends Document {
  email: string
  password: string
  name?: string
  username: string
  role: UserRole
  status: AccountStatus
  isSuperAdmin: boolean
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, trim: true },
    username: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    role: {
      type: String,
      enum: ["bidder", "caller", "finance", "leader", "moderator", "developer"],
      default: "bidder",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    isSuperAdmin: { type: Boolean, default: false },
  },
  { timestamps: true },
)

userSchema.index(
  { isSuperAdmin: 1 },
  { unique: true, partialFilterExpression: { isSuperAdmin: true } },
)

export const User = mongoose.model<IUser>("User", userSchema)
