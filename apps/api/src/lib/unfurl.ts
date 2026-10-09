import { lookup } from "dns/promises"
import { isIP } from "net"

export type LinkProvider = "google-meet" | "zoom" | "link" | "application" | "job" | "event"

export type LinkPreview = {
  url: string
  title: string
  description: string
  image: string
  siteName: string
  provider: LinkProvider
  path?: string
  status?: string
  fields?: { label: string; value: string }[]
}

const cache = new Map<string, { expires: number; preview: LinkPreview | null }>()

export function isBlockedIp(ip: string) {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "")
  if (normalized === "::1" || normalized === "0.0.0.0") return true
  if (
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return true
  }
  const v4 = normalized.startsWith("::ffff:") ? normalized.slice("::ffff:".length) : normalized
  const parts = v4.split(".").map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false
  }
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

export function classifyLink(url: URL): LinkProvider {
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  if (host === "meet.google.com") return "google-meet"
  if (host === "zoom.us" || host.endsWith(".zoom.us")) return "zoom"
  return "link"
}

export function meetingPreview(url: URL): LinkPreview | null {
  const provider = classifyLink(url)
  if (provider === "google-meet") {
    const code = url.pathname.split("/").filter(Boolean).pop() || ""
    const titled = code && code !== "new" && code !== "lookup"
    return {
      url: url.toString(),
      title: titled ? `Google Meet · ${code}` : "Google Meet",
      description: "Join this video meeting",
      image: "",
      siteName: "Google Meet",
      provider,
    }
  }
  if (provider === "zoom") {
    const id = url.pathname.match(/\/(?:j|wc\/join|s)\/(\d+)/)?.[1]
    return {
      url: url.toString(),
      title: id ? `Zoom Meeting · ${id}` : "Zoom Meeting",
      description: "Join this Zoom meeting",
      image: "",
      siteName: "Zoom",
      provider,
    }
  }
  return null
}

function blockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "")
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true
  }
  return isIP(host) ? isBlockedIp(host) : false
}

async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported URL")
  if (url.username || url.password) throw new Error("Unsupported URL")
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Unsupported URL")
  if (blockedHost(url.hostname)) throw new Error("Unsupported URL")
  if (isIP(url.hostname)) return
  const records = await lookup(url.hostname, { all: true, verbatim: true })
  if (!records.length || records.some((record) => isBlockedIp(record.address))) {
    throw new Error("Unsupported URL")
  }
}

function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function metaContent(html: string, keys: string[]) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const patterns = [
      new RegExp(
        `<meta[^>]*?(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*?content\\s*=\\s*["']([^"']*)["'][^>]*>`,
        "i",
      ),
      new RegExp(
        `<meta[^>]*?content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*>`,
        "i",
      ),
    ]
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match?.[1]) return decode(match[1])
    }
  }
  return ""
}

function absoluteHttp(value: string, base: URL) {
  if (!value) return ""
  try {
    const url = new URL(value, base)
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""
    return url.toString()
  } catch {
    return ""
  }
}

async function readHtml(target: URL, hops = 0): Promise<{ html: string; finalUrl: URL } | null> {
  await assertPublic(target)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(target, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; crewjobs-preview/1.0)",
      },
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location || hops >= 4) return null
      const next = new URL(location, target)
      return readHtml(next, hops + 1)
    }
    if (!response.ok) return null
    const type = response.headers.get("content-type") || ""
    if (!type.includes("text/html") && !type.includes("application/xhtml")) return null
    const reader = response.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let size = 0
    while (size < 400_000) {
      const { done, value } = await reader.read()
      if (done || !value) break
      size += value.byteLength
      chunks.push(value)
    }
    await reader.cancel().catch(() => {})
    return { html: new TextDecoder().decode(Buffer.concat(chunks)), finalUrl: target }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function unfurl(raw: string): Promise<LinkPreview | null> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  const key = url.toString()
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.preview

  const fallback = meetingPreview(url)
  let preview: LinkPreview | null = fallback
  const page = await readHtml(url).catch(() => null)
  if (page) {
    const ogTitle = metaContent(page.html, ["og:title", "twitter:title"])
    const description = metaContent(page.html, [
      "og:description",
      "twitter:description",
      "description",
    ])
    const image = absoluteHttp(metaContent(page.html, ["og:image", "twitter:image"]), page.finalUrl)
    const siteName = metaContent(page.html, ["og:site_name"]) || fallback?.siteName || url.hostname
    const pageTitle = decode(page.html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "")
    const sameMeeting = !fallback || classifyLink(page.finalUrl) === fallback.provider
    // Google Meet and Zoom often redirect bots to a sign-in page. Keep the meeting card
    // unless the final page is still that provider and actually published Open Graph tags.
    if (fallback && sameMeeting) {
      if (ogTitle || description || image) {
        preview = {
          url: key,
          title: ogTitle || fallback.title,
          description: description || fallback.description,
          image: image || fallback.image,
          siteName: siteName || fallback.siteName,
          provider: fallback.provider,
        }
      }
    } else if (!fallback && (ogTitle || pageTitle || description || image)) {
      preview = {
        url: key,
        title: ogTitle || pageTitle || siteName,
        description,
        image,
        siteName: siteName || url.hostname,
        provider: "link",
      }
    }
  }

  cache.set(key, { preview, expires: Date.now() + (preview ? 60 * 60 * 1000 : 5 * 60 * 1000) })
  return preview
}
