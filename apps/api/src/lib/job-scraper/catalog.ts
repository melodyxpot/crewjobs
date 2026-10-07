export const SCRAPER_SOURCE_IDS = ["public", "adzuna", "jsearch", "themuse"] as const
export type ScraperSourceId = (typeof SCRAPER_SOURCE_IDS)[number]

export type ScraperCatalogItem = {
  id: ScraperSourceId
  label: string
  description: string
  env: string[]
}

export const SCRAPER_CATALOG: ScraperCatalogItem[] = [
  {
    id: "public",
    label: "Public remote boards",
    description: "Remote OK, Remotive, Arbeitnow, and Jobicy. No API key.",
    env: [],
  },
  {
    id: "adzuna",
    label: "Adzuna",
    description: "Remote developer listings from Adzuna.",
    env: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
  },
  {
    id: "jsearch",
    label: "JSearch",
    description: "Broader listings from Indeed, LinkedIn, and other boards via JSearch.",
    env: ["JSEARCH_API_KEY"],
  },
  {
    id: "themuse",
    label: "The Muse",
    description: "Broader coverage from The Muse software engineering listings.",
    env: ["THEMUSE_API_KEY"],
  },
]

export function isScraperSourceId(value: string): value is ScraperSourceId {
  return (SCRAPER_SOURCE_IDS as readonly string[]).includes(value)
}

export function sourceReady(id: ScraperSourceId) {
  const item = SCRAPER_CATALOG.find((source) => source.id === id)
  if (!item) return false
  return item.env.every((key) => !!process.env[key]?.trim())
}

export function sourceLabel(id: string) {
  return SCRAPER_CATALOG.find((source) => source.id === id)?.label || id
}
