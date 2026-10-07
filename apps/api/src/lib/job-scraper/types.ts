import type { JobRegion, ScrapedJobSource, ScrapeRegion } from "../../models/ScrapedJob"

export type RawListing = {
  title: string
  company: string
  link: string | null
  platform: string
  location: string | null
  description: string | null
  remoteHint: boolean | null
  source: Exclude<ScrapedJobSource, "manual">
  sourceIsRemoteBoard: boolean
}

export type AcceptedListing = RawListing & {
  region: JobRegion
  link: string | null
}

export type FailedSource = {
  id: string
  label: string
  error: string
}

export type HarvestResult = {
  listings: AcceptedListing[]
  rejected: number
  duplicates: number
  failedSources: FailedSource[]
}

export type { JobRegion, ScrapeRegion }
