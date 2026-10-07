"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { apiGetChatInbox, apiGetChatMessages, apiSendChatMessage } from "@/lib/api"
import { ROLE_LABELS, type UserRole } from "@/lib/types"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

type Contact = {
  id: string
  username: string
  email: string
  role: UserRole
  displayName: string
  lastMessage: string
  lastMessageAt: string | null
}

type ChatMessage = {
  _id: string
  body: string
  senderId: string
  createdAt: string
  mine: boolean
}

export default function ChatPage() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const activeIdRef = useRef<string | null>(null)
  const active = contacts.find((contact) => contact.id === activeId) || null
  activeIdRef.current = activeId

  useEffect(() => {
    loadInbox()
    const timer = setInterval(loadInbox, 8000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    const requestedId = activeId
    let cancelled = false

    async function run() {
      try {
        const result = await apiGetChatMessages(requestedId)
        if (cancelled || activeIdRef.current !== requestedId) return
        setMessages(result.messages)
      } catch (error: any) {
        if (cancelled || activeIdRef.current !== requestedId) return
        toast.error(error.message)
      }
    }

    setMessages([])
    run()
    const timer = setInterval(run, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [activeId])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages.length, activeId])

  async function loadInbox() {
    try {
      const result = await apiGetChatInbox()
      setContacts(result.contacts)
      setActiveId((current) => current || result.contacts[0]?.id || null)
    } catch (error: any) {
      toast.error(error.message)
    }
    setLoading(false)
  }

  async function send() {
    if (!activeId || !draft.trim()) return
    const conversationId = activeId
    setSending(true)
    try {
      const result = await apiSendChatMessage(conversationId, draft.trim())
      if (activeIdRef.current === conversationId) {
        setMessages((current) => [...current, result.message])
      }
      setDraft("")
      loadInbox()
    } catch (error: any) {
      toast.error(error.message)
    }
    setSending(false)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="w-80 shrink-0 overflow-auto border-r">
        <div className="border-b px-4 py-3">
          <h1 className="font-semibold">Messages</h1>
          <p className="text-xs text-muted-foreground">
            {user?.role === "bidder" || user?.role === "caller"
              ? "You can message leaders and moderators."
              : "Direct messages with the people you are allowed to reach."}
          </p>
        </div>
        {contacts.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No one is available to message yet.</p>
        ) : contacts.map((contact) => (
          <button
            key={contact.id}
            className={`flex w-full flex-col items-start gap-1 border-b px-4 py-3 text-left hover:bg-muted/60 ${contact.id === activeId ? "bg-muted" : ""}`}
            onClick={() => setActiveId(contact.id)}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{contact.displayName}</span>
              <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[contact.role] || contact.role}</Badge>
            </span>
            <span className="truncate text-xs text-muted-foreground">{contact.lastMessage || "No messages yet"}</span>
          </button>
        ))}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a person to start chatting.</div>
        ) : (
          <>
            <div className="border-b px-4 py-3">
              <p className="font-medium">{active.displayName}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[active.role] || active.role}</p>
            </div>
            <div ref={scroller} className="flex-1 space-y-3 overflow-auto p-4">
              {messages.length === 0 && <p className="text-sm text-muted-foreground">Say hello.</p>}
              {messages.map((message) => (
                <div key={message._id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${message.mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <p className={`mt-1 text-[10px] ${message.mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <form
              className="flex gap-2 border-t p-3"
              onSubmit={(event) => {
                event.preventDefault()
                send()
              }}
            >
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Message ${active.displayName}`}
                rows={2}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
              />
              <Button type="submit" disabled={sending || !draft.trim()}>Send</Button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
