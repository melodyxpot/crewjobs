import type { ScrapeRegion } from "../../../models/ScrapedJob"
import { compactText } from "../filters"
import type { RawListing } from "../types"

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function listingLink(value: unknown): string | null {
  const link = text(value)
  return link || null
}

export function parseRemoteOk(payload: unknown): RawListing[] {
  if (!Array.isArray(payload)) return []
  return payload.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const title = text(row.position)
    const company = text(row.company)
    if (!title || !company) return []
    return [
      {
        title,
        company,
        link: listingLink(row.apply_url) || listingLink(row.url),
        platform: "Remote OK",
        location: text(row.location) || null,
        description: compactText(text(row.description)),
        remoteHint: true,
        source: "remoteok" as const,
        sourceIsRemoteBoard: true,
      },
    ]
  })
}

export function parseRemotive(payload: unknown): RawListing[] {
  const jobs = payload && typeof payload === "object" ? (payload as { jobs?: unknown }).jobs : null
  if (!Array.isArray(jobs)) return []
  return jobs.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const title = text(row.title)
    const company = text(row.company_name)
    if (!title || !company) return []
    return [
      {
        title,
        company,
        link: listingLink(row.url),
        platform: "Remotive",
        location: text(row.candidate_required_location) || null,
        description: compactText(text(row.description)),
        remoteHint: true,
        source: "remotive" as const,
        sourceIsRemoteBoard: true,
      },
    ]
  })
}

export function parseArbeitnow(payload: unknown): RawListing[] {
  const jobs = payload && typeof payload === "object" ? (payload as { data?: unknown }).data : null
  if (!Array.isArray(jobs)) return []
  return jobs.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const title = text(row.title)
    const company = text(row.company_name)
    if (!title || !company) return []
    return [
      {
        title,
        company,
        link: listingLink(row.url),
        platform: "Arbeitnow",
        location: text(row.location) || null,
        description: compactText(text(row.description)),
        remoteHint: row.remote === false ? false : true,
        source: "arbeitnow" as const,
        sourceIsRemoteBoard: true,
      },
    ]
  })
}

function jobicyLocation(geo: string): string | null {
  const value = geo.toLowerCase()
  if (!value) return null
  if (value.includes("usa") || value.includes("united states")) return "United States"
  if (value === "uk" || value.includes("united kingdom")) return "United Kingdom"
  if (value.includes("europe")) return "Europe"
  if (value.includes("asia")) return "Asia"
  if (value.includes("anywhere") || value.includes("worldwide")) return "Worldwide"
  return geo
}

export function parseJobicy(payload: unknown): RawListing[] {
  const jobs = payload && typeof payload === "object" ? (payload as { jobs?: unknown }).jobs : null
  if (!Array.isArray(jobs)) return []
  return jobs.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const title = text(row.jobTitle)
    const company = text(row.companyName)
    if (!title || !company) return []
    return [
      {
        title,
        company,
        link: listingLink(row.url),
        platform: "Jobicy",
        location: jobicyLocation(text(row.jobGeo)),
        description: compactText(text(row.jobExcerpt) || text(row.jobDescription)),
        remoteHint: true,
        source: "jobicy" as const,
        sourceIsRemoteBoard: true,
      },
    ]
  })
}

export function parseAdzuna(payload: unknown, fallbackLocation: string | null): RawListing[] {
  const results =
    payload && typeof payload === "object" ? (payload as { results?: unknown }).results : null
  if (!Array.isArray(results)) return []
  return results.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const company =
      row.company && typeof row.company === "object"
        ? text((row.company as { display_name?: unknown }).display_name)
        : ""
    const location =
      row.location && typeof row.location === "object"
        ? text((row.location as { display_name?: unknown }).display_name)
        : ""
    const title = text(row.title)
    if (!title || !company) return []
    return [
      {
        title,
        company,
        link: listingLink(row.redirect_url),
        platform: "Adzuna",
        location: location || fallbackLocation,
        description: compactText(text(row.description)),
        remoteHint: null,
        source: "adzuna" as const,
        sourceIsRemoteBoard: false,
      },
    ]
  })
}

export function parseJSearch(payload: unknown): RawListing[] {
  const jobs = payload && typeof payload === "object" ? (payload as { data?: unknown }).data : null
  if (!Array.isArray(jobs)) return []
  return jobs.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const title = text(row.job_title)
    const company = text(row.employer_name)
    if (!title || !company) return []
    const city = text(row.job_city)
    const country = text(row.job_country)
    const location = [city, country].filter(Boolean).join(", ")
    return [
      {
        title,
        company,
        link: listingLink(row.job_apply_link) || listingLink(row.job_google_link),
        platform: text(row.job_publisher) || "JSearch",
        location: location || null,
        description: compactText(text(row.job_description)),
        remoteHint: row.job_is_remote === true ? true : row.job_is_remote === false ? false : null,
        source: "jsearch" as const,
        sourceIsRemoteBoard: false,
      },
    ]
  })
}

export function parseTheMuse(payload: unknown): RawListing[] {
  const results =
    payload && typeof payload === "object" ? (payload as { results?: unknown }).results : null
  if (!Array.isArray(results)) return []
  return results.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const company =
      row.company && typeof row.company === "object"
        ? text((row.company as { name?: unknown }).name)
        : ""
    const title = text(row.name)
    if (!title || !company) return []
    const locations = Array.isArray(row.locations)
      ? row.locations
          .map((location) =>
            location && typeof location === "object"
              ? text((location as { name?: unknown }).name)
              : "",
          )
          .filter(Boolean)
      : []
    const location = locations.join(", ")
    const remote = locations.some((name) => /remote|flexible/i.test(name))
    const landing =
      row.refs && typeof row.refs === "object"
        ? listingLink((row.refs as { landing_page?: unknown }).landing_page)
        : null
    return [
      {
        title,
        company,
        link: landing,
        platform: "The Muse",
        location: location || null,
        description: compactText(text(row.contents)),
        remoteHint: locations.length === 0 ? null : remote,
        source: "themuse" as const,
        sourceIsRemoteBoard: false,
      },
    ]
  })
}

export const ADZUNA_COUNTRIES: Record<ScrapeRegion, string[]> = {
  US: ["us"],
  Europe: ["gb", "de", "nl", "fr", "ie", "es", "pl", "se"],
  Asia: ["in", "sg"],
}

export const JSEARCH_COUNTRIES: Record<ScrapeRegion, string[]> = {
  US: ["us"],
  Europe: ["gb", "de", "nl", "fr"],
  Asia: ["in", "sg", "jp"],
}

export const ADZUNA_LOCATION: Record<string, string> = {
  us: "United States",
  gb: "United Kingdom",
  de: "Germany",
  nl: "Netherlands",
  fr: "France",
  ie: "Ireland",
  es: "Spain",
  pl: "Poland",
  se: "Sweden",
  in: "India",
  sg: "Singapore",
}

export function countriesFor(regions: ScrapeRegion[], map: Record<ScrapeRegion, string[]>) {
  const countries: string[] = []
  for (const region of regions) {
    for (const country of map[region]) {
      if (!countries.includes(country)) countries.push(country)
    }
  }
  return countries
}

export function pageSizeFor(countryCount: number, cap = 50) {
  if (countryCount <= 0) return 0
  return Math.max(1, Math.min(50, Math.ceil(cap / countryCount)))
}
