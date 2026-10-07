import { describe, expect, it } from "vitest"
import { matchProfileKey } from "./detector"

describe("matchProfileKey", () => {
  it("maps personal fields from the label or input type", () => {
    expect(matchProfileKey("First name", "text", "")).toBe("firstName")
    expect(matchProfileKey("Family name", "text", "")).toBe("lastName")
    expect(matchProfileKey("", "email", "user_email")).toBe("email")
    expect(matchProfileKey("Mobile phone", "tel", "")).toBe("phone")
    expect(matchProfileKey("City", "text", "")).toBe("city")
  })

  it("maps links, files, and equal-employment questions", () => {
    expect(matchProfileKey("GitHub URL", "url", "")).toBe("github")
    expect(matchProfileKey("Upload your resume", "file", "")).toBe("resumeFile")
    expect(matchProfileKey("Cover letter", "file", "")).toBe("coverLetterFile")
    expect(matchProfileKey("Will you need visa sponsorship?", "text", "")).toBe(
      "ee.requireSponsorship",
    )
    expect(matchProfileKey("Sexual orientation", "select", "")).toBe("ee.sexualOrientation")
  })

  it("returns null when the field is not recognized", () => {
    expect(matchProfileKey("Favorite color", "text", "custom_field")).toBe(null)
  })
})
