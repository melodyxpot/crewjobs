import { describe, expect, it } from "vitest"
import {
  canApproveUsers,
  canChatWith,
  canFilterBids,
  displayName,
  isManager,
  isRemoteWorkLocation,
  type RoleUser,
} from "./roles"

function user(overrides: Partial<RoleUser> = {}): RoleUser {
  return {
    id: "user-1",
    email: "ada@example.com",
    username: "ada",
    name: "Ada Lovelace",
    role: "bidder",
    ...overrides,
  }
}

describe("displayName", () => {
  it("prefers a trimmed name, then username, then email", () => {
    expect(displayName({ name: " Ada ", username: "ada", email: "a@b.co" })).toBe("Ada")
    expect(displayName({ name: "  ", username: "ada", email: "a@b.co" })).toBe("ada")
    expect(displayName({ email: "a@b.co" })).toBe("a@b.co")
    expect(displayName({})).toBe("Unknown")
  })
})

describe("role permissions", () => {
  it("treats leaders, moderators, and super admins as managers", () => {
    expect(isManager(user({ role: "leader" }))).toBe(true)
    expect(isManager(user({ role: "moderator" }))).toBe(true)
    expect(isManager(user({ role: "bidder", isSuperAdmin: true }))).toBe(true)
    expect(isManager(user({ role: "bidder" }))).toBe(false)
  })

  it("lets only leaders and super admins approve users", () => {
    expect(canApproveUsers(user({ role: "leader" }))).toBe(true)
    expect(canApproveUsers(user({ role: "bidder", isSuperAdmin: true }))).toBe(true)
    expect(canApproveUsers(user({ role: "moderator" }))).toBe(false)
  })

  it("lets managers, callers, and finance filter bids", () => {
    for (const role of ["leader", "moderator", "caller", "finance"] as const) {
      expect(canFilterBids(user({ role }))).toBe(true)
    }
    expect(canFilterBids(user({ role: "bidder" }))).toBe(false)
    expect(canFilterBids(user({ role: "developer" }))).toBe(false)
    expect(canFilterBids(user({ role: "bidder", isSuperAdmin: true }))).toBe(true)
  })
})

describe("canChatWith", () => {
  it("blocks a chat with yourself or an unknown user", () => {
    expect(canChatWith(user({ id: "a" }), user({ id: "a", role: "leader" }))).toBe(false)
    expect(canChatWith(user({ id: undefined }), user({ id: "b" }))).toBe(false)
  })

  it("lets a super admin chat with anyone else", () => {
    expect(
      canChatWith(user({ id: "a", isSuperAdmin: true }), user({ id: "b", role: "bidder" })),
    ).toBe(true)
  })

  it("keeps bidders and callers from chatting with each other", () => {
    expect(canChatWith(user({ id: "a", role: "bidder" }), user({ id: "b", role: "caller" }))).toBe(
      false,
    )
  })

  it("lets floor roles chat with management, and management chat with each other", () => {
    expect(canChatWith(user({ id: "a", role: "bidder" }), user({ id: "b", role: "leader" }))).toBe(
      true,
    )
    expect(
      canChatWith(user({ id: "a", role: "moderator" }), user({ id: "b", role: "leader" })),
    ).toBe(true)
    expect(canChatWith(user({ id: "a", role: "finance" }), user({ id: "b", role: "bidder" }))).toBe(
      false,
    )
  })
})

describe("isRemoteWorkLocation", () => {
  it("matches remote regardless of case and surrounding space", () => {
    expect(isRemoteWorkLocation("Remote")).toBe(true)
    expect(isRemoteWorkLocation("  REMOTE ")).toBe(true)
    expect(isRemoteWorkLocation("Hybrid")).toBe(false)
    expect(isRemoteWorkLocation(null)).toBe(false)
    expect(isRemoteWorkLocation(undefined)).toBe(false)
  })
})
