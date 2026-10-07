"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MessageCircle, X, Send, Loader2, Maximize2, Minimize2, Paperclip, FileText, ImageIcon, Copy, Check } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { apiChat } from "@/lib/api"

interface Attachment {
  file: File
  preview?: string
}

interface Message {
  role: "user" | "assistant"
  content: string
  attachments?: { name: string; type: string }[]
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || "")
  const lang = match ? match[1] : ""
  const code = String(children).replace(/\n$/, "")

  function handleCopy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative my-2 rounded-lg bg-zinc-900 text-zinc-100">
      <div className="flex items-center justify-between px-4 py-1.5 text-xs text-zinc-400">
        <span>{lang}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-zinc-200 transition-colors">
          {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 pb-3 text-sm leading-relaxed"><code>{code}</code></pre>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-1.5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{children}</a>,
        blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground">{children}</blockquote>,
        hr: () => <hr className="my-3 border-border" />,
        table: ({ children }) => <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>,
        thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
        th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="border-t border-border px-3 py-1.5">{children}</td>,
        code: ({ className, children, ...props }) => {
          const isInline = !className
          if (isInline) {
            return <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{children}</code>
          }
          return <CodeBlock className={className}>{children}</CodeBlock>
        },
        pre: ({ children }) => <>{children}</>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [dragOver, setDragOver] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 150) + "px"
  }, [])

  useEffect(() => {
    autoResize()
  }, [input, autoResize])

  function addFiles(files: FileList | File[]) {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    const newAttachments: Attachment[] = []
    for (const file of Array.from(files)) {
      if (!allowed.includes(file.type)) continue
      if (attachments.length + newAttachments.length >= 5) break
      const att: Attachment = { file }
      if (file.type.startsWith("image/")) {
        att.preview = URL.createObjectURL(file)
      }
      newAttachments.push(att)
    }
    setAttachments((prev) => [...prev, ...newAttachments])
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const removed = prev[index]
      if (removed.preview) URL.revokeObjectURL(removed.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items
    const files: File[] = []
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      addFiles(files)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  async function handleSend() {
    const trimmed = input.trim()
    if ((!trimmed && attachments.length === 0) || loading) return

    const userMessage: Message = {
      role: "user",
      content: trimmed,
      attachments: attachments.map((a) => ({ name: a.file.name, type: a.file.type })),
    }
    setMessages((prev) => [...prev, userMessage])
    const filesToSend = attachments.map((a) => a.file)
    attachments.forEach((a) => { if (a.preview) URL.revokeObjectURL(a.preview) })
    setAttachments([])
    setInput("")
    setLoading(true)

    try {
      const result = await apiChat(trimmed, filesToSend.length > 0 ? filesToSend : undefined)
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply || "No response" }])
    } catch (error) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: error instanceof Error ? error.message : "Something went wrong",
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const panelClasses = expanded
    ? "fixed inset-4 z-50 flex flex-col rounded-xl border bg-background shadow-2xl"
    : "fixed bottom-20 right-6 z-50 flex h-[550px] w-[420px] flex-col rounded-xl border bg-background shadow-xl"

  return (
    <>
      {isOpen && (
        <div
          className={panelClasses}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <MessageCircle className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground">crewjobs AI</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded((p) => !p)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={expanded ? "Minimize" : "Expand"}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => { setIsOpen(false); setExpanded(false) }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 pt-12 text-muted-foreground">
                <MessageCircle className="h-10 w-10 opacity-30" />
                <p className="text-sm">Ask me anything about your career!</p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {["Help me write a cover letter", "Review my resume", "Interview tips"].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); textareaRef.current?.focus() }}
                      className="rounded-full border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {msg.attachments.map((a, j) => (
                          <span key={j} className="inline-flex items-center gap-1 rounded-md bg-black/10 px-2 py-0.5 text-xs">
                            {a.type.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                            {a.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                ) : (
                  <div className="max-w-[85%] text-sm text-foreground">
                    <MarkdownContent content={msg.content} />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Drag overlay */}
          {dragOver && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/10 border-2 border-dashed border-primary">
              <p className="text-sm font-medium text-primary">Drop files here</p>
            </div>
          )}

          {/* Input area */}
          <div className="border-t p-3">
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((att, i) => (
                  <div key={i} className="relative group">
                    {att.preview ? (
                      <img src={att.preview} alt={att.file.name} className="h-14 w-14 rounded-lg object-cover border" />
                    ) : (
                      <div className="flex h-14 items-center gap-1.5 rounded-lg border bg-muted px-3">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs text-foreground max-w-[100px] truncate">{att.file.name}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(i)}
                      className="absolute -right-1.5 -top-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Attach file"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.docx"
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = "" }}
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Message crewjobs AI..."
                rows={1}
                disabled={loading}
                className="flex-1 resize-none rounded-xl border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring max-h-[150px] leading-relaxed"
              />

              <button
                onClick={handleSend}
                disabled={loading || (!input.trim() && attachments.length === 0)}
                className="shrink-0 rounded-lg bg-primary p-2.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </>
  )
}
