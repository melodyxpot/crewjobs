import type { JobRegion, ScrapeRegion } from "../../models/ScrapedJob"
import type { RawListing } from "./types"

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "referrer",
  "source",
])

const EXCLUDE_TITLE = [
  /\bsales\b/i,
  /\bmarketing\b/i,
  /\brecruit/i,
  /\btalent acquisition\b/i,
  /\baccount executive\b/i,
  /\baccount manager\b/i,
  /\bbusiness development\b/i,
  /\bcustomer success\b/i,
  /\bcustomer support\b/i,
  /\btechnical support\b/i,
  /\bhelp ?desk\b/i,
  /\bsupport\b/i,
  /\bcopywriter\b/i,
  /\bcontent writer\b/i,
  /\bcontent marketing\b/i,
  /\bproduct manager\b/i,
  /\bproduct owner\b/i,
  /\bproduct designer\b/i,
  /\bproduct marketing\b/i,
  /\bproject manager\b/i,
  /\bprogram manager\b/i,
  /\bproject management\b/i,
  /\bhuman resources\b/i,
  /\bpeople operations\b/i,
  /\bhr\b/i,
  /\bdesigner\b/i,
]

const INCLUDE_TITLE = [
  /\bdeveloper\b/i,
  /\bprogrammer\b/i,
  /\bsoftware\b/i,
  /\bfront[- ]?end\b/i,
  /\bback[- ]?end\b/i,
  /\bfull[- ]?stack\b/i,
  /\bdevops\b/i,
  /\bdev ops\b/i,
  /\bsite reliability\b/i,
  /\bsre\b/i,
  /\bsdet\b/i,
  /\btest automation\b/i,
  /\b(ios|android|mobile)\s+(engineer|developer)\b/i,
  /\b(machine learning|ml|ai|data|platform|infrastructure|cloud|security|qa|quality assurance)\s+(engineer|developer)\b/i,
  /\b(react|vue|angular|node\.?js|python|golang|java|kotlin|swift|rust|ruby|php|scala)\s+(engineer|developer)\b/i,
]

const US_PLACES = [
  "united states",
  "u.s.a",
  "u.s",
  "usa",
  "us",
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
  "district of columbia",
  "san francisco",
  "seattle",
  "austin",
  "boston",
  "chicago",
  "los angeles",
  "denver",
  "atlanta",
  "miami",
  "dallas",
  "houston",
  "portland",
  "nyc",
]

const EUROPE_PLACES = [
  "europe",
  "european union",
  "emea",
  "eu",
  "united kingdom",
  "scotland",
  "uk",
  "ireland",
  "germany",
  "deutschland",
  "france",
  "netherlands",
  "holland",
  "spain",
  "portugal",
  "poland",
  "sweden",
  "norway",
  "denmark",
  "finland",
  "italy",
  "belgium",
  "austria",
  "switzerland",
  "czech republic",
  "czechia",
  "romania",
  "hungary",
  "greece",
  "ukraine",
  "croatia",
  "serbia",
  "bulgaria",
  "slovakia",
  "slovenia",
  "estonia",
  "latvia",
  "lithuania",
  "luxembourg",
  "iceland",
  "london",
  "berlin",
  "amsterdam",
  "paris",
  "dublin",
  "lisbon",
  "barcelona",
  "madrid",
  "munich",
  "stockholm",
  "copenhagen",
  "oslo",
  "helsinki",
  "warsaw",
  "prague",
  "vienna",
  "zurich",
  "brussels",
  "milan",
  "edinburgh",
]

const ASIA_PLACES = [
  "asia-pacific",
  "asia pacific",
  "apac",
  "asia",
  "india",
  "singapore",
  "japan",
  "south korea",
  "korea",
  "philippines",
  "vietnam",
  "indonesia",
  "thailand",
  "malaysia",
  "taiwan",
  "hong kong",
  "china",
  "bangladesh",
  "pakistan",
  "sri lanka",
  "nepal",
  "cambodia",
  "bangalore",
  "bengaluru",
  "hyderabad",
  "mumbai",
  "delhi",
  "pune",
  "chennai",
  "tokyo",
  "osaka",
  "seoul",
  "manila",
  "jakarta",
  "bangkok",
  "hanoi",
  "taipei",
  "shanghai",
  "beijing",
]

function placePattern(places: string[]) {
  const body = [...places]
    .sort((a, b) => b.length - a.length)
    .map((place) => place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"))
    .join("|")
  return new RegExp(`\\b(?:${body})\\b`, "i")
}

const US_PATTERN = placePattern(US_PLACES)
const EUROPE_PATTERN = placePattern(EUROPE_PLACES)
const ASIA_PATTERN = placePattern(ASIA_PLACES)

export function normalizeLink(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  try {
    const url = new URL(trimmed)
    url.hash = ""
    const kept = new URLSearchParams()
    for (const [key, param] of url.searchParams) {
      if (!TRACKING_PARAMS.has(key.toLowerCase())) kept.append(key, param)
    }
    const query = kept.toString()
    url.search = query ? `?${query}` : ""
    url.hostname = url.hostname.toLowerCase()
    url.pathname = url.pathname.replace(/\/+$/, "") || "/"
    return url.toString()
  } catch {
    return trimmed
  }
}

export function compactText(value: string | null | undefined, max = 2000): string | null {
  if (!value) return null
  const text = value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return null
  return text.slice(0, max)
}

export function isDeveloperJob(title: string): boolean {
  const value = title.trim()
  if (!value) return false
  if (EXCLUDE_TITLE.some((pattern) => pattern.test(value))) return false
  return INCLUDE_TITLE.some((pattern) => pattern.test(value))
}

export function classifyRegion(location: string | null | undefined): JobRegion {
  const text = (location || "").trim()
  if (!text) return "Worldwide"
  const matches: JobRegion[] = []
  if (US_PATTERN.test(text)) matches.push("US")
  if (EUROPE_PATTERN.test(text)) matches.push("Europe")
  if (ASIA_PATTERN.test(text)) matches.push("Asia")
  if (matches.length === 1) return matches[0]
  return "Worldwide"
}

export function isRemoteListing(listing: RawListing): boolean {
  if (listing.remoteHint === false) return false
  const text =
    `${listing.title} ${listing.location || ""} ${listing.description || ""}`.toLowerCase()
  if (/\bhybrid\b/.test(text) || /\b(on-?site|on site|in-office|in office)\b/.test(text)) {
    return false
  }
  if (listing.sourceIsRemoteBoard || listing.remoteHint === true) return true
  return /\bremote\b/.test(text)
}

export function evaluateListing(
  listing: RawListing,
  regions: ScrapeRegion[],
): { keep: false } | { keep: true; region: JobRegion; link: string | null } {
  if (!listing.title.trim() || !listing.company.trim()) return { keep: false }
  if (!isDeveloperJob(listing.title)) return { keep: false }
  if (!isRemoteListing(listing)) return { keep: false }
  const region = classifyRegion(listing.location)
  if (region !== "Worldwide" && !regions.includes(region)) return { keep: false }
  return { keep: true, region, link: normalizeLink(listing.link) }
}
