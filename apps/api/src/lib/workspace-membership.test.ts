import { describe, expect, it } from "vitest"
import { assignmentError } from "./workspace-membership"

describe("workspace assignment rules", () => {
  it("keeps a bidder on at most one workspace", () => {
    expect(assignmentError("bidder", 0)).toBeNull()
    expect(assignmentError("bidder", 1)).toBeNull()
    expect(assignmentError("bidder", 2)).toBe("A bidder can belong to only one workspace.")
  })

  it("lets a caller belong to several workspaces", () => {
    expect(assignmentError("caller", 0)).toBeNull()
    expect(assignmentError("caller", 1)).toBeNull()
    expect(assignmentError("caller", 4)).toBeNull()
  })

  it("does not assign other roles to workspaces", () => {
    expect(assignmentError("leader", 1)).toBe(
      "Only bidders and callers are assigned to workspaces.",
    )
    expect(assignmentError("moderator", 0)).toBe(
      "Only bidders and callers are assigned to workspaces.",
    )
  })
})
