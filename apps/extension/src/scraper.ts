export interface ScrapedJob {
  title: string
  company: string
  location: string
  workLocation: string
  jobType: string
  link: string
  platform: string
}

function getMetaContent(name: string): string {
  const meta =
    document.querySelector(`meta[property="${name}"]`) ||
    document.querySelector(`meta[name="${name}"]`)
  return meta?.getAttribute("content")?.trim() || ""
}

function getTextBySelectors(selectors: string[]): string {
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el?.textContent?.trim()) {
      return el.textContent.trim()
    }
  }
  return ""
}

function detectPlatform(url: string): string {
  const host = new URL(url).hostname.toLowerCase()
  if (host.includes("linkedin")) return "LinkedIn"
  if (host.includes("indeed")) return "Indeed"
  if (host.includes("wellfound") || host.includes("angel.co")) return "Wellfound"
  if (host.includes("greenhouse")) return "GreenHouse"
  if (host.includes("lever")) return "Company Website"
  if (host.includes("myworkdayjobs.com")) return "MyWorkDays"
  if (host.includes("workday")) return "Company Website"
  if (host.includes("glassdoor")) return "Other"
  return "Other"
}

function detectWorkLocation(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes("remote")) return "Remote"
  if (lower.includes("hybrid")) return "Hybrid"
  if (lower.includes("on-site") || lower.includes("onsite") || lower.includes("in-office")) return "Onsite"
  return ""
}

function detectJobType(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes("full-time") || lower.includes("full time")) return "Full-time"
  if (lower.includes("part-time") || lower.includes("part time")) return "Part-time"
  if (lower.includes("contract")) return "Contract"
  if (lower.includes("internship") || lower.includes("intern")) return "Internship"
  if (lower.includes("freelance")) return "Freelance"
  return ""
}

export function scrapeJobData(): ScrapedJob {
  const url = window.location.href
  const platform = detectPlatform(url)

  // Try to get title
  let title =
    getMetaContent("og:title") ||
    getTextBySelectors([
      "h1.job-title",
      "h1.topcard__title",
      "h1[data-test-id='job-title']",
      ".jobsearch-JobInfoHeader-title",
      "h1.app-title",
      "h1.posting-headline h2",
      "h1",
    ]) ||
    document.title

  // Clean up title — remove suffix like " | Company | LinkedIn"
  title = title.split(" | ")[0].split(" - ")[0].trim()

  // Try to get company
  let company =
    getTextBySelectors([
      ".topcard__org-name-link",
      "a.topcard__org-name-link",
      ".company-name",
      "[data-test-id='company-name']",
      ".jobsearch-InlineCompanyRating-companyHeader",
      ".posting-categories .sort-by-time",
      "a.company-name-link",
      ".employer-name",
    ]) ||
    getMetaContent("og:site_name") ||
    ""

  // Try to get location
  const location =
    getTextBySelectors([
      ".topcard__flavor--bullet",
      ".job-location",
      "[data-test-id='location']",
      ".jobsearch-JobInfoHeader-subtitle .jobsearch-JobInfoHeader-subtitle-location",
      ".location",
    ]) || ""

  // Detect work location and job type from full page text
  const bodyText = document.body.innerText.substring(0, 5000)
  const workLocation = detectWorkLocation(bodyText)
  const jobType = detectJobType(bodyText)

  return {
    title,
    company,
    location,
    workLocation,
    jobType,
    link: url,
    platform,
  }
}
