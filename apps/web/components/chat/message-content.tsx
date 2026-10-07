"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { apiUnfurl, type LinkPreview } from "@/lib/api"

type Member = {
  id: string
  username?: string
  displayName?: string
}

const previewCache = new Map<string, LinkPreview | null>()

function cleanUrl(value: string) {
  return value.replace(/[),.!?;:]+$/g, "")
}

export function messageUrls(body: string) {
  const found = body.match(/https?:\/\/[^\s<]+/g) || []
  return [...new Set(found.map(cleanUrl))]
}

function memberByHandle(members: Member[]) {
  const map = new Map<string, Member>()
  for (const member of members) {
    if (member.username) map.set(member.username.toLowerCase(), member)
  }
  return map
}

type MdNode = {
  type: string
  value?: string
  url?: string
  children?: MdNode[]
}

function mentionPieces(value: string): MdNode[] {
  const nodes: MdNode[] = []
  const pattern = /(^|\s)@([a-zA-Z0-9_]+)/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value))) {
    const start = match.index + match[1].length
    if (start > last) nodes.push({ type: "text", value: value.slice(last, start) })
    nodes.push({
      type: "link",
      url: `mention:${match[2]}`,
      children: [{ type: "text", value: `@${match[2]}` }],
    })
    last = pattern.lastIndex
  }
  if (last === 0) return [{ type: "text", value }]
  if (last < value.length) nodes.push({ type: "text", value: value.slice(last) })
  return nodes
}

function chatMarkdown() {
  return (tree: MdNode) => {
    rewriteChatText(tree)
  }
}

function rewriteChatText(node: MdNode) {
  if (!node.children) return
  const next: MdNode[] = []
  for (const child of node.children) {
    if (
      child.type === "text" &&
      child.value &&
      node.type !== "link" &&
      node.type !== "linkReference"
    ) {
      const lines = child.value.split("\n")
      lines.forEach((line, index) => {
        if (index > 0) next.push({ type: "break" })
        next.push(...mentionPieces(line))
      })
      continue
    }
    rewriteChatText(child)
    next.push(child)
  }
  node.children = next
}

function safeHttp(href?: string) {
  if (!href) return ""
  try {
    const url = new URL(href)
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""
    return url.toString()
  } catch {
    return ""
  }
}

export function MessageBody({
  body,
  members,
  currentUsername,
}: {
  body: string
  members: Member[]
  currentUsername?: string
}) {
  const handles = memberByHandle(members)
  return (
    <div className="break-words text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, chatMarkdown]}
        urlTransform={(url) => (url.startsWith("mention:") ? url : safeHttp(url))}
        components={{
          h1: ({ children }) => <h1 className="mt-2 mb-1 text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-2 mb-1 text-sm font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-semibold">{children}</h3>,
          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-1 ml-5 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 ml-5 list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="text-muted-foreground">{children}</del>,
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-muted-foreground/40 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => {
            if (href?.startsWith("mention:")) {
              const handle = href.slice("mention:".length)
              const member = handles.get(handle.toLowerCase())
              if (!member) return <span>{children}</span>
              const mine = handle.toLowerCase() === currentUsername?.toLowerCase()
              return (
                <span
                  className={`rounded px-0.5 font-medium ${mine ? "bg-primary/15 text-primary" : "bg-background text-foreground"}`}
                >
                  @{member.username}
                </span>
              )
            }
            const url = safeHttp(href)
            if (!url) return <span>{children}</span>
            return (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-primary underline underline-offset-2"
              >
                {children}
              </a>
            )
          },
          img: ({ src, alt }) => {
            const url = safeHttp(typeof src === "string" ? src : "")
            if (!url) return null
            return (
              // Remote markdown images can come from any host.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={alt || ""} className="my-1 max-h-60 rounded-md" />
            )
          },
          pre: ({ children }) => (
            <pre className="my-1 overflow-x-auto rounded-md bg-background px-3 py-2 text-[13px]">
              {children}
            </pre>
          ),
          code: ({ className, children }) => {
            const block = Boolean(className) || String(children).endsWith("\n")
            if (block) return <code className={`${className || ""} font-mono`}>{children}</code>
            return (
              <code className="rounded bg-background px-1 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            )
          },
          table: ({ children }) => (
            <div className="my-1 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b px-2 py-1 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b px-2 py-1">{children}</td>,
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}

export function LinkPreviews({ body }: { body: string }) {
  const urls = messageUrls(body).slice(0, 3)
  if (urls.length === 0) return null
  return (
    <div className="mt-2 space-y-2">
      {urls.map((url) => (
        <LinkPreviewCard key={url} url={url} />
      ))}
    </div>
  )
}

function previewImage(src: string) {
  try {
    const parsed = new URL(src)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return ""
    return parsed.toString()
  } catch {
    return ""
  }
}

function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreview | null | undefined>(previewCache.get(url))

  useEffect(() => {
    if (previewCache.has(url)) {
      setPreview(previewCache.get(url))
      return
    }
    let cancelled = false
    apiUnfurl(url)
      .then((result) => {
        previewCache.set(url, result)
        if (!cancelled) setPreview(result)
      })
      .catch(() => {
        previewCache.set(url, null)
        if (!cancelled) setPreview(null)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (preview === null) return null
  if (preview === undefined) {
    return (
      <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
        Loading preview…
      </div>
    )
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      className="flex gap-3 overflow-hidden rounded-md border bg-background p-2.5 hover:bg-muted/40"
    >
      {previewImage(preview.image) ? (
        <span
          aria-hidden
          className="h-16 w-16 shrink-0 rounded bg-cover bg-center"
          style={{ backgroundImage: `url("${previewImage(preview.image)}")` }}
        />
      ) : null}
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {preview.siteName}
        </span>
        <span className="block truncate text-sm font-medium">{preview.title}</span>
        {preview.description ? (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {preview.description}
          </span>
        ) : null}
      </span>
    </a>
  )
}
