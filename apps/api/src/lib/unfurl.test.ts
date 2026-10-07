import { describe, expect, it } from "vitest"
import { classifyLink, isBlockedIp, meetingPreview } from "./unfurl"

describe("link previews", () => {
  it("blocks private addresses", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true)
    expect(isBlockedIp("10.1.2.3")).toBe(true)
    expect(isBlockedIp("192.168.1.20")).toBe(true)
    expect(isBlockedIp("172.16.0.4")).toBe(true)
    expect(isBlockedIp("8.8.8.8")).toBe(false)
  })

  it("builds a preview for Google Meet and Zoom even before the page is fetched", () => {
    const meet = meetingPreview(new URL("https://meet.google.com/abc-defg-hij"))
    expect(meet?.provider).toBe("google-meet")
    expect(meet?.title).toContain("abc-defg-hij")
    expect(meet?.siteName).toBe("Google Meet")

    const zoom = meetingPreview(new URL("https://us05web.zoom.us/j/12345678901"))
    expect(classifyLink(new URL("https://zoom.us/j/1"))).toBe("zoom")
    expect(zoom?.provider).toBe("zoom")
    expect(zoom?.title).toContain("12345678901")
  })
})
