import type { ScrapeRegion } from "../../../models/ScrapedJob"
import { fetchJson, safeError } from "../http"
import type { FailedSource, RawListing } from "../types"
import {
  ADZUNA_COUNTRIES,
  ADZUNA_LOCATION,
  JSEARCH_COUNTRIES,
  countriesFor,
  pageSizeFor,
  parseAdzuna,
  parseArbeitnow,
  parseJSearch,
  parseJobicy,
  parseRemoteOk,
  parseRemotive,
  parseTheMuse,
} from "./parse"

const JOBICY_GEO: Record<ScrapeRegion, string> = {
  US: "usa",
  Europe: "europe",
  Asia: "asia",
}

async function loadBoard(
  id: string,
  label: string,
  load: () => Promise<RawListing[]>,
): Promise<{ listings: RawListing[]; failed: FailedSource[] }> {
  try {
    return { listings: await load(), failed: [] }
  } catch (error) {
    return { listings: [], failed: [{ id, label, error: safeError(error) }] }
  }
}

async function settleCountries(
  countries: string[],
  load: (country: string) => Promise<RawListing[]>,
) {
  const settled = await Promise.all(
    countries.map(async (country) => {
      try {
        return await load(country)
      } catch (error) {
        return error
      }
    }),
  )
  const listings = settled.flatMap((item) => (Array.isArray(item) ? item : []))
  const errors = settled.filter((item) => !Array.isArray(item))
  if (listings.length === 0 && errors.length > 0) throw errors[0]
  return listings
}

export async function fetchPublicBoards(regions: ScrapeRegion[]) {
  const boards = await Promise.all([
    loadBoard("remoteok", "Remote OK", async () =>
      parseRemoteOk(await fetchJson("https://remoteok.com/api")).slice(0, 100),
    ),
    loadBoard("remotive", "Remotive", async () =>
      parseRemotive(
        await fetchJson("https://remotive.com/api/remote-jobs?category=software-dev"),
      ).slice(0, 100),
    ),
    loadBoard("arbeitnow", "Arbeitnow", async () =>
      parseArbeitnow(await fetchJson("https://www.arbeitnow.com/api/job-board-api")).slice(0, 100),
    ),
    loadBoard("jobicy", "Jobicy", () => fetchJobicy(regions)),
  ])
  return {
    listings: boards.flatMap((board) => board.listings),
    failed: boards.flatMap((board) => board.failed),
  }
}

async function fetchJobicy(regions: ScrapeRegion[]) {
  const geos = regions.map((region) => JOBICY_GEO[region])
  return settleCountries(geos, async (geo) =>
    parseJobicy(
      await fetchJson(
        `https://jobicy.com/api/v2/remote-jobs?count=50&geo=${encodeURIComponent(geo)}&industry=dev`,
      ),
    ).slice(0, 50),
  )
}

export async function fetchAdzuna(regions: ScrapeRegion[]) {
  const appId = process.env.ADZUNA_APP_ID?.trim()
  const appKey = process.env.ADZUNA_APP_KEY?.trim()
  if (!appId || !appKey) throw new Error("API key is not configured")
  const countries = countriesFor(regions, ADZUNA_COUNTRIES)
  const size = pageSizeFor(countries.length)
  const what = encodeURIComponent("remote software developer")
  return settleCountries(countries, async (country) => {
    const payload = await fetchJson(
      `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}&results_per_page=${size}&what=${what}&sort_by=date`,
    )
    return parseAdzuna(payload, ADZUNA_LOCATION[country] || null).slice(0, size)
  })
}

export async function fetchJSearch(regions: ScrapeRegion[]) {
  const apiKey = process.env.JSEARCH_API_KEY?.trim()
  if (!apiKey) throw new Error("API key is not configured")
  const countries = countriesFor(regions, JSEARCH_COUNTRIES)
  const pages = countries.length <= 1 ? 5 : 1
  const query = encodeURIComponent("software engineer")
  return settleCountries(countries, async (country) => {
    const payload = await fetchJson(
      `https://jsearch.p.rapidapi.com/search?query=${query}&page=1&num_pages=${pages}&country=${country}&remote_jobs_only=true&date_posted=month`,
      {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      },
    )
    return parseJSearch(payload).slice(0, pages * 10)
  })
}

export async function fetchTheMuse() {
  const apiKey = process.env.THEMUSE_API_KEY?.trim()
  if (!apiKey) throw new Error("API key is not configured")
  const pages = await Promise.all(
    [1, 2].map(async (page) => {
      try {
        return parseTheMuse(
          await fetchJson(
            `https://www.themuse.com/api/public/jobs?category=${encodeURIComponent("Software Engineering")}&page=${page}&api_key=${encodeURIComponent(apiKey)}`,
          ),
        )
      } catch (error) {
        return error
      }
    }),
  )
  const listings = pages.flatMap((page) => (Array.isArray(page) ? page : []))
  const errors = pages.filter((page) => !Array.isArray(page))
  if (listings.length === 0 && errors.length > 0) throw errors[0]
  return listings.slice(0, 50)
}
