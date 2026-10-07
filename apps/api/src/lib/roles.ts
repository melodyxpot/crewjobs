export const USER_ROLES = [
  "bidder",
  "caller",
  "finance",
  "leader",
  "moderator",
  "developer",
] as const
export type UserRole = (typeof USER_ROLES)[number]
export const SIGNUP_ROLES = ["bidder", "caller", "finance", "moderator", "developer"] as const
export type SignupRole = (typeof SIGNUP_ROLES)[number]
export type AccountStatus = "pending" | "approved" | "rejected"

export interface RoleUser {
  _id?: { toString(): string }
  id?: string
  email: string
  username?: string
  name?: string
  role: UserRole | string
  status?: AccountStatus | string
  isSuperAdmin?: boolean
}

export function displayName(user: {
  username?: string | null
  name?: string | null
  email?: string | null
}) {
  return user.name?.trim() || user.username?.trim() || user.email || "Unknown"
}

export function isManager(user: RoleUser) {
  return !!user.isSuperAdmin || user.role === "leader" || user.role === "moderator"
}

export function canApproveUsers(user: RoleUser) {
  return !!user.isSuperAdmin || user.role === "leader"
}

export function canFilterBids(user: RoleUser) {
  return !!user.isSuperAdmin || ["leader", "moderator", "caller", "finance"].includes(user.role)
}

export function canChatWith(a: RoleUser, b: RoleUser) {
  const aId = a._id?.toString() || a.id
  const bId = b._id?.toString() || b.id
  if (!aId || !bId || aId === bId) return false
  if (a.isSuperAdmin || b.isSuperAdmin) return true

  const floor = (role: string) => role === "bidder" || role === "caller"
  const management = (role: string) => role === "leader" || role === "moderator"

  if (floor(a.role) && floor(b.role)) return false
  if (floor(a.role)) return management(b.role)
  if (floor(b.role)) return management(a.role)
  return true
}

export function isRemoteWorkLocation(value?: string | null) {
  return (value || "").trim().toLowerCase() === "remote"
}

export function toPublicUser(user: any) {
  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username || "",
    name: user.name || user.username || "",
    role: user.role,
    status: user.status,
    isSuperAdmin: !!user.isSuperAdmin,
  }
}
