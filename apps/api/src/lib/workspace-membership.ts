import mongoose from "mongoose"
import { Workspace } from "../models/Workspace"

export class MembershipError extends Error {}

export function assignmentError(role: string, workspaceCount: number) {
  if (role !== "bidder" && role !== "caller") {
    return "Only bidders and callers are assigned to workspaces."
  }
  if (role === "bidder" && workspaceCount > 1) {
    return "A bidder can belong to only one workspace."
  }
  return null
}

export async function workspaceIdsForMember(userId: mongoose.Types.ObjectId | string) {
  const workspaces = await Workspace.find({
    $or: [{ bidderIds: userId }, { callerIds: userId }],
  })
    .select("name")
    .sort({ name: 1 })
    .lean()

  return workspaces.map((workspace) => ({
    id: workspace._id.toString(),
    name: workspace.name,
  }))
}

export async function clearUserWorkspaces(userId: mongoose.Types.ObjectId | string) {
  await Workspace.updateMany(
    { $or: [{ bidderIds: userId }, { callerIds: userId }] },
    { $pull: { bidderIds: userId, callerIds: userId } },
  )
}

export async function assignUserWorkspaces(
  user: { _id: mongoose.Types.ObjectId; role: string; status?: string },
  workspaceIds: string[],
) {
  const message = assignmentError(user.role, workspaceIds.length)
  if (message) throw new MembershipError(message)
  if (user.status && user.status !== "approved") {
    throw new MembershipError("Approve the account before assigning workspaces.")
  }

  const uniqueIds = [...new Set(workspaceIds)]
  if (uniqueIds.some((id) => !mongoose.isValidObjectId(id))) {
    throw new MembershipError("Workspace not found.")
  }

  const found = await Workspace.find({ _id: { $in: uniqueIds } }).select("_id")
  if (found.length !== uniqueIds.length) throw new MembershipError("Workspace not found.")

  await clearUserWorkspaces(user._id)
  if (uniqueIds.length) {
    const field = user.role === "bidder" ? "bidderIds" : "callerIds"
    await Workspace.updateMany({ _id: { $in: uniqueIds } }, { $addToSet: { [field]: user._id } })
  }

  return workspaceIdsForMember(user._id)
}
