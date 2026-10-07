import { describe, expect, it } from "vitest"
import { jobApplicationSchema, loginSchema, registerSchema, settingsSchema } from "./validation"

const validApplication = {
  company: "Acme",
  title: "Engineer",
  link: "https://example.com/jobs/1",
  platform: "LinkedIn",
  status: "Applied",
  appliedAt: "2026-10-07",
  followUpAt: null,
  location: "US",
  workLocation: "Remote",
  jobType: "Full-time",
  notes: "",
}

describe("jobApplicationSchema", () => {
  it("accepts a complete application", () => {
    expect(jobApplicationSchema.safeParse(validApplication).success).toBe(true)
  })

  it("accepts an empty or missing link", () => {
    expect(jobApplicationSchema.safeParse({ ...validApplication, link: "" }).success).toBe(true)
    expect(jobApplicationSchema.safeParse({ ...validApplication, link: null }).success).toBe(true)
  })

  it("rejects a missing company and an invalid link", () => {
    const missingCompany = jobApplicationSchema.safeParse({ ...validApplication, company: "" })
    const badLink = jobApplicationSchema.safeParse({
      ...validApplication,
      link: "not-a-url",
    })

    expect(missingCompany.success).toBe(false)
    expect(badLink.success).toBe(false)
  })
})

describe("loginSchema", () => {
  it("requires a valid email and a password of at least 6 characters", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "secret" }).success).toBe(true)
    expect(loginSchema.safeParse({ email: "not-an-email", password: "secret" }).success).toBe(false)
    expect(loginSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false)
  })
})

describe("registerSchema", () => {
  it("accepts signup roles and rejects unknown ones", () => {
    const base = {
      email: "a@b.co",
      username: "ada",
      password: "secret",
      role: "bidder",
    }

    expect(registerSchema.safeParse(base).success).toBe(true)
    expect(registerSchema.safeParse({ ...base, role: "leader" }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, username: "ab" }).success).toBe(false)
  })
})

describe("settingsSchema", () => {
  const validSettings = {
    defaultPlatform: "LinkedIn",
    defaultStatus: "Applied",
    followUpOffsetDays: 7,
    platformOptions: ["LinkedIn"],
    locationOptions: ["US"],
    workLocationOptions: ["Remote"],
  }

  it("accepts settings inside the follow-up window", () => {
    expect(settingsSchema.safeParse(validSettings).success).toBe(true)
    expect(settingsSchema.safeParse({ ...validSettings, followUpOffsetDays: 1 }).success).toBe(true)
    expect(settingsSchema.safeParse({ ...validSettings, followUpOffsetDays: 365 }).success).toBe(
      true,
    )
  })

  it("rejects an empty option list and a follow-up window outside 1-365 days", () => {
    expect(settingsSchema.safeParse({ ...validSettings, platformOptions: [] }).success).toBe(false)
    expect(settingsSchema.safeParse({ ...validSettings, followUpOffsetDays: 0 }).success).toBe(
      false,
    )
    expect(settingsSchema.safeParse({ ...validSettings, followUpOffsetDays: 366 }).success).toBe(
      false,
    )
  })
})
