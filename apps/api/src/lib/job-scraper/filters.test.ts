import { describe, expect, it } from "vitest"
import type { RawListing } from "./types"
import {
  classifyRegion,
  evaluateListing,
  isDeveloperJob,
  isRemoteListing,
  normalizeLink,
} from "./filters"

function listing(overrides: Partial<RawListing> = {}): RawListing {
  return {
    title: "Senior Frontend Engineer",
    company: "Acme",
    link: "https://example.com/jobs/1",
    platform: "Remotive",
    location: "United States",
    description: null,
    remoteHint: true,
    source: "remotive",
    sourceIsRemoteBoard: true,
    ...overrides,
  }
}

describe("isDeveloperJob", () => {
  it("keeps software, frontend, backend, mobile, devops, qa, data, and ml roles", () => {
    for (const title of [
      "Senior Software Engineer",
      "Frontend Developer",
      "Back-end Engineer",
      "Full Stack Developer",
      "iOS Developer",
      "DevOps Engineer",
      "Site Reliability Engineer",
      "QA Engineer",
      "SDET",
      "Data Engineer",
      "Machine Learning Engineer",
      "React Engineer",
      "Staff Software Engineer, Platform",
    ]) {
      expect(isDeveloperJob(title), title).toBe(true)
    }
  })

  it("drops non-developer titles, including engineer titles outside software", () => {
    for (const title of [
      "Sales Engineer",
      "Product Manager",
      "Product Designer",
      "Marketing Lead",
      "Technical Recruiter",
      "Customer Support",
      "Project Manager",
      "HR Business Partner",
      "Data Analyst",
      "Engineering Manager",
      "Account Executive",
    ]) {
      expect(isDeveloperJob(title), title).toBe(false)
    }
  })
})

describe("classifyRegion", () => {
  it("maps a single region and leaves worldwide or mixed locations open", () => {
    expect(classifyRegion("San Francisco, United States")).toBe("US")
    expect(classifyRegion("Remote - US")).toBe("US")
    expect(classifyRegion("London, UK")).toBe("Europe")
    expect(classifyRegion("Berlin, Germany")).toBe("Europe")
    expect(classifyRegion("EMEA")).toBe("Europe")
    expect(classifyRegion("Bangalore, India")).toBe("Asia")
    expect(classifyRegion("Singapore")).toBe("Asia")
    expect(classifyRegion("APAC")).toBe("Asia")
    expect(classifyRegion("Worldwide")).toBe("Worldwide")
    expect(classifyRegion("Canada")).toBe("Worldwide")
    expect(classifyRegion("")).toBe("Worldwide")
    expect(classifyRegion("Remote, US or Europe")).toBe("Worldwide")
  })

  it("does not treat nearby country names as a listed region", () => {
    expect(classifyRegion("Australia")).toBe("Worldwide")
    expect(classifyRegion("Austria")).toBe("Europe")
    expect(classifyRegion("Indiana, United States")).toBe("US")
  })
})

describe("isRemoteListing", () => {
  it("trusts a remote board unless the listing is hybrid or onsite only", () => {
    expect(isRemoteListing(listing({ location: "United States", description: null }))).toBe(true)
    expect(isRemoteListing(listing({ description: "Hybrid schedule in Austin" }))).toBe(false)
    expect(isRemoteListing(listing({ remoteHint: false, source: "arbeitnow" }))).toBe(false)
  })

  it("requires a remote mark on search-api listings and drops hybrid and onsite", () => {
    const adzuna = listing({
      source: "adzuna",
      sourceIsRemoteBoard: false,
      remoteHint: null,
      platform: "Adzuna",
    })
    expect(isRemoteListing({ ...adzuna, description: "This role is fully remote." })).toBe(true)
    expect(isRemoteListing({ ...adzuna, description: "Hybrid, three days in office." })).toBe(false)
    expect(
      isRemoteListing({ ...adzuna, title: "Backend Engineer", description: "Onsite in London" }),
    ).toBe(false)
    expect(isRemoteListing({ ...adzuna, remoteHint: true, description: "Office optional." })).toBe(
      true,
    )
  })
})

describe("normalizeLink", () => {
  it("strips tracking params, hashes, and a trailing slash", () => {
    expect(
      normalizeLink("https://Jobs.Example.com/roles/1/?utm_source=board&ref=homepage#apply"),
    ).toBe("https://jobs.example.com/roles/1")
    expect(normalizeLink("https://example.com/jobs/1?gh_jid=42")).toBe(
      "https://example.com/jobs/1?gh_jid=42",
    )
    expect(normalizeLink("  ")).toBeNull()
    expect(normalizeLink("not a url")).toBe("not a url")
  })
})

describe("evaluateListing", () => {
  it("keeps a remote developer job in a selected region and worldwide jobs", () => {
    expect(evaluateListing(listing(), ["US"])).toMatchObject({ keep: true, region: "US" })
    expect(evaluateListing(listing({ location: "Worldwide" }), ["Asia"])).toMatchObject({
      keep: true,
      region: "Worldwide",
    })
  })

  it("drops other regions, non-developer titles, and onsite roles", () => {
    expect(evaluateListing(listing({ location: "Berlin, Germany" }), ["US"]).keep).toBe(false)
    expect(evaluateListing(listing({ title: "Sales Engineer" }), ["US"]).keep).toBe(false)
    expect(
      evaluateListing(
        listing({
          source: "adzuna",
          sourceIsRemoteBoard: false,
          remoteHint: null,
          description: "Onsite only",
        }),
        ["US"],
      ).keep,
    ).toBe(false)
  })
})
