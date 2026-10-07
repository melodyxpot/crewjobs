import type { ScraperSourceId } from "@crewjobs/shared"
import type { ScrapeRegion } from "../../models/ScrapedJob"
import { evaluateListing } from "./filters"
import { safeError } from "./http"
import { fetchAdzuna, fetchJSearch, fetchPublicBoards, fetchTheMuse } from "./sources/fetch"
import type { AcceptedListing, FailedSource, HarvestResult, RawListing } from "./types"

export function collectListings(raws: RawListing[], regions: ScrapeRegion[]) {
  let rejected = 0
  let duplicates = 0
  const seenLinks = new Set<string>()
  const seenTitles = new Set<string>()
  const listings: AcceptedListing[] = []

  for (const raw of raws) {
    const decision = evaluateListing(raw, regions)
    if (!decision.keep) {
      rejected += 1
      continue
    }
    const titleKey = `${raw.company.trim().toLowerCase()}::${raw.title.trim().toLowerCase()}`
    if ((decision.link && seenLinks.has(decision.link)) || seenTitles.has(titleKey)) {
      duplicates += 1
      continue
    }
    if (decision.link) seenLinks.add(decision.link)
    seenTitles.add(titleKey)
    listings.push({ ...raw, link: decision.link, region: decision.region, description: null })
  }

  return { listings, rejected, duplicates }
}

async function runSource(
  id: string,
  label: string,
  load: () => Promise<{ listings: RawListing[]; failed?: FailedSource[] } | RawListing[]>,
) {
  try {
    const result = await load()
    if (Array.isArray(result)) return { listings: result, failed: [] as FailedSource[] }
    return { listings: result.listings, failed: result.failed || [] }
  } catch (error) {
    return { listings: [] as RawListing[], failed: [{ id, label, error: safeError(error) }] }
  }
}

export async function scrapeSources(
  regions: ScrapeRegion[],
  toggles: ScraperSourceId[],
): Promise<HarvestResult> {
  const tasks = []
  if (toggles.includes("public")) {
    tasks.push(runSource("public", "Public remote boards", () => fetchPublicBoards(regions)))
  }
  if (toggles.includes("adzuna")) {
    tasks.push(runSource("adzuna", "Adzuna", () => fetchAdzuna(regions)))
  }
  if (toggles.includes("jsearch")) {
    tasks.push(runSource("jsearch", "JSearch", () => fetchJSearch(regions)))
  }
  if (toggles.includes("themuse")) {
    tasks.push(runSource("themuse", "The Muse", () => fetchTheMuse()))
  }

  const settled = await Promise.all(tasks)
  const collected = collectListings(
    settled.flatMap((item) => item.listings),
    regions,
  )
  return {
    ...collected,
    failedSources: settled.flatMap((item) => item.failed),
  }
}
