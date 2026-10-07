import mongoose from "mongoose"
import { IUser } from "../models/User"
import { Workspace, IWorkspace } from "../models/Workspace"
import { isManager } from "./roles"

export async function resolveWorkspaceId(
  user: IUser,
  requested?: string | null,
  options?: { required?: boolean },
): Promise<{ workspaceId: mongoose.Types.ObjectId | null; error?: string }> {
  if (user.role === "bidder" && !user.isSuperAdmin) {
    const ws = await Workspace.findOne({ bidderIds: user._id }).select("_id")
    return { workspaceId: ws?._id ?? null }
  }

  if (requested) {
    if (!mongoose.isValidObjectId(requested)) {
      return { workspaceId: null, error: "Workspace not found" }
    }
    const ws = await Workspace.findById(requested)
    if (!ws) return { workspaceId: null, error: "Workspace not found" }
    const allowed = await canUseWorkspace(user, ws)
    if (!allowed) return { workspaceId: null, error: "You cannot use that workspace" }
    return { workspaceId: ws._id }
  }

  const list =
    user.role === "caller" && !isManager(user)
      ? await Workspace.find({ callerIds: user._id }).select("_id")
      : await Workspace.find().select("_id")

  if (list.length === 1) return { workspaceId: list[0]._id }
  if (options?.required && list.length > 1) {
    return { workspaceId: null, error: "Choose a workspace" }
  }
  return { workspaceId: null }
}

export async function canUseWorkspace(user: IUser, workspace: IWorkspace) {
  if (isManager(user) || user.role === "finance" || user.role === "developer") return true
  if (user.role === "bidder") {
    return workspace.bidderIds.some((id) => id.toString() === user._id.toString())
  }
  if (user.role === "caller") {
    return workspace.callerIds.some((id) => id.toString() === user._id.toString())
  }
  return false
}

export async function workspacesForUser(user: IUser) {
  if (isManager(user) || user.role === "finance" || user.role === "developer") {
    return Workspace.find().sort({ name: 1 })
  }
  if (user.role === "bidder") {
    return Workspace.find({ bidderIds: user._id }).sort({ name: 1 })
  }
  if (user.role === "caller") {
    return Workspace.find({ callerIds: user._id }).sort({ name: 1 })
  }
  return []
}
