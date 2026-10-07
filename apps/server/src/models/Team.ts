import mongoose, { Schema, Document } from "mongoose"

export interface ITeamMember {
  userId: mongoose.Types.ObjectId
  role: "leader" | "member"
  joinedAt: Date
}

export interface ITeam extends Document {
  name: string
  createdBy: mongoose.Types.ObjectId
  members: ITeamMember[]
  createdAt: Date
  updatedAt: Date
}

const teamMemberSchema = new Schema<ITeamMember>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["leader", "member"], default: "member" },
  joinedAt: { type: Date, default: Date.now },
}, { _id: false })

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [teamMemberSchema], default: [] },
  },
  { timestamps: true }
)

teamSchema.index({ "members.userId": 1 })

export const Team = mongoose.model<ITeam>("Team", teamSchema)
