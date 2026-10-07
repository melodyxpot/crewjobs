"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  apiCreateChannel,
  apiGetChannelMessages,
  apiGetChatInbox,
  apiGetChatMessages,
  apiGetUsers,
  apiSendChannelMessage,
  apiSendChatMessage,
  apiUpdateChannel,
} from "@/lib/api"
import { ACTIVE_THREAD_KEY } from "@/components/message-notifications"
import { ROLE_LABELS, type UserRole } from "@/lib/types"
import { toast } from "sonner"
import { Hash, Loader2, Plus, X } from "lucide-react"

type Direct = {
  id: string
  username: string
  email: string
  role: UserRole
  displayName: string
  lastMessage: string
  lastMessageAt: string | null
  unread: number
  conversationId: string | null
}

type Channel = {
  id: string
  name: string
  lastMessage: string
  lastMessageAt: string | null
  unread: number
  memberCount: number
}

type ChatMessage = {
  _id: string
  body: string
  senderId: string
  senderName: string
  createdAt: string
  mine: boolean
}

type Person = {
  id: string
  displayName?: string
  username?: string
  name?: string
  email: string
  role: string
}

type Active = { kind: "dm"; id: string } | { kind: "channel"; id: string }

function personLabel(person: Person) {
  return person.displayName || person.username || person.name || person.email
}

export default function ChatPage() {
  const { user } = useAuth()
  const canManage = !!user?.isSuperAdmin || user?.role === "leader" || user?.role === "moderator"
  const [directs, setDirects] = useState<Direct[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [active, setActive] = useState<Active | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [members, setMembers] = useState<Person[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [directory, setDirectory] = useState<Person[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [channelName, setChannelName] = useState("")
  const [inviteIds, setInviteIds] = useState<string[]>([])
  const [savingChannel, setSavingChannel] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const activeRef = useRef<Active | null>(null)

  const activeDirect = active?.kind === "dm" ? directs.find((item) => item.id === active.id) : null
  const activeChannel =
    active?.kind === "channel" ? channels.find((item) => item.id === active.id) : null

  useEffect(() => {
    loadInbox()
    const timer = setInterval(loadInbox, 8000)
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {})
    }
    return () => {
      clearInterval(timer)
      sessionStorage.removeItem(ACTIVE_THREAD_KEY)
    }
  }, [])

  useEffect(() => {
    if (canManage) {
      apiGetUsers({ status: "approved" })
        .then(({ users }) => setDirectory(users))
        .catch(() => {})
    }
  }, [canManage])

  useEffect(() => {
    activeRef.current = active
    if (!active) {
      setMessages([])
      setMembers([])
      sessionStorage.removeItem(ACTIVE_THREAD_KEY)
      return
    }
    const requested = active
    let cancelled = false

    async function run() {
      try {
        if (requested.kind === "dm") {
          const result = await apiGetChatMessages(requested.id)
          if (cancelled || !sameActive(activeRef.current, requested)) return
          setMessages(result.messages)
          setMembers([])
          if (result.conversationId) {
            sessionStorage.setItem(ACTIVE_THREAD_KEY, String(result.conversationId))
          }
        } else {
          const result = await apiGetChannelMessages(requested.id)
          if (cancelled || !sameActive(activeRef.current, requested)) return
          setMessages(result.messages)
          setMembers(result.members || [])
          sessionStorage.setItem(ACTIVE_THREAD_KEY, requested.id)
        }
      } catch (error: any) {
        if (cancelled || !sameActive(activeRef.current, requested)) return
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
  }, [active])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages.length, active?.kind, active?.id])

  async function loadInbox() {
    try {
      const result = await apiGetChatInbox()
      setDirects(result.directs || result.contacts || [])
      setChannels(result.channels || [])
      setActive((current) => {
        if (current) return current
        if (result.channels?.[0]) return { kind: "channel", id: result.channels[0].id }
        if (result.directs?.[0]) return { kind: "dm", id: result.directs[0].id }
        return null
      })
    } catch (error: any) {
      toast.error(error.message)
    }
    setLoading(false)
  }

  async function send() {
    if (!active || !draft.trim()) return
    const target = active
    setSending(true)
    try {
      const result =
        target.kind === "dm"
          ? await apiSendChatMessage(target.id, draft.trim())
          : await apiSendChannelMessage(target.id, draft.trim())
      if (sameActive(activeRef.current, target)) {
        setMessages((current) => [...current, result.message])
      }
      setDraft("")
      loadInbox()
    } catch (error: any) {
      toast.error(error.message)
    }
    setSending(false)
  }

  async function createChannel() {
    if (!channelName.trim()) return
    setSavingChannel(true)
    try {
      const { channel } = await apiCreateChannel(channelName.trim(), inviteIds)
      setCreateOpen(false)
      setChannelName("")
      setInviteIds([])
      await loadInbox()
      setActive({ kind: "channel", id: channel.id })
      toast.success("Channel created")
    } catch (error: any) {
      toast.error(error.message)
    }
    setSavingChannel(false)
  }

  async function saveInvites() {
    if (!activeChannel) return
    setSavingChannel(true)
    try {
      await apiUpdateChannel(activeChannel.id, {
        name: channelName.trim() || activeChannel.name,
        memberIds: inviteIds,
      })
      setInviteOpen(false)
      await loadInbox()
      const result = await apiGetChannelMessages(activeChannel.id)
      setMembers(result.members || [])
      toast.success("Channel updated")
    } catch (error: any) {
      toast.error(error.message)
    }
    setSavingChannel(false)
  }

  function openInvite() {
    setChannelName(activeChannel?.name || "")
    setInviteIds(members.map((member) => member.id).filter((id) => id !== user?.id))
    setInviteOpen(true)
  }

  const title = activeChannel ? `# ${activeChannel.name}` : activeDirect?.displayName || ""
  const subtitle = activeChannel
    ? `${members.length || activeChannel.memberCount} members`
    : activeDirect
      ? ROLE_LABELS[activeDirect.role] || activeDirect.role
      : ""

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
          <p className="text-xs text-muted-foreground">Channels and direct messages</p>
        </div>

        <div className="border-b px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Channels
            </p>
            {canManage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setChannelName("")
                  setInviteIds([])
                  setCreateOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          {channels.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">No channels yet.</p>
          )}
          {channels.map((channel) => (
            <ThreadButton
              key={channel.id}
              active={active?.kind === "channel" && active.id === channel.id}
              title={`# ${channel.name}`}
              preview={channel.lastMessage || "No messages yet"}
              unread={channel.unread}
              onClick={() => setActive({ kind: "channel", id: channel.id })}
            />
          ))}
        </div>

        <div className="px-3 py-2">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Direct messages
          </p>
          {directs.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              No one is available to message yet.
            </p>
          )}
          {directs.map((contact) => (
            <ThreadButton
              key={contact.id}
              active={active?.kind === "dm" && active.id === contact.id}
              title={contact.displayName}
              preview={contact.lastMessage || "No messages yet"}
              unread={contact.unread}
              badge={ROLE_LABELS[contact.role] || contact.role}
              onClick={() => setActive({ kind: "dm", id: contact.id })}
            />
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a channel or a person to start chatting.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{title}</p>
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              </div>
              {activeChannel && canManage && (
                <Button variant="outline" size="sm" onClick={openInvite}>
                  Invite
                </Button>
              )}
            </div>
            <div ref={scroller} className="flex-1 space-y-3 overflow-auto p-4">
              {messages.length === 0 && <p className="text-sm text-muted-foreground">Say hello.</p>}
              {messages.map((message) => (
                <div key={message._id} className="flex justify-start">
                  <div className="max-w-[70%]">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {message.mine ? "You" : message.senderName || "Someone"}
                    </p>
                    <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
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
                placeholder={activeChannel ? `Message #${activeChannel.name}` : `Message ${title}`}
                rows={2}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
              />
              <Button type="submit" disabled={sending || !draft.trim()}>
                Send
              </Button>
            </form>
          </>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New channel</DialogTitle>
            <DialogDescription>
              Leaders and moderators can create a channel and invite people into it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="channel-name">Channel name</Label>
              <Input
                id="channel-name"
                value={channelName}
                placeholder="announcements"
                onChange={(event) => setChannelName(event.target.value)}
              />
            </div>
            <MemberPicker
              people={directory.filter((person) => person.id !== user?.id)}
              selected={inviteIds}
              onChange={setInviteIds}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createChannel} disabled={savingChannel || !channelName.trim()}>
              {savingChannel ? "Creating..." : "Create channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              {activeChannel?.name}
            </DialogTitle>
            <DialogDescription>Rename the channel or change who is invited.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rename-channel">Channel name</Label>
              <Input
                id="rename-channel"
                value={channelName}
                onChange={(event) => setChannelName(event.target.value)}
              />
            </div>
            <MemberPicker
              people={directory.filter((person) => person.id !== user?.id)}
              selected={inviteIds}
              onChange={setInviteIds}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveInvites} disabled={savingChannel || !channelName.trim()}>
              {savingChannel ? "Saving..." : "Save channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function sameActive(current: Active | null, requested: Active) {
  return current?.kind === requested.kind && current.id === requested.id
}

function ThreadButton({
  active,
  title,
  preview,
  unread,
  badge,
  onClick,
}: {
  active: boolean
  title: string
  preview: string
  unread: number
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      className={`flex w-full flex-col items-start gap-1 rounded-md px-2 py-2 text-left hover:bg-muted/60 ${active ? "bg-muted" : ""}`}
      onClick={onClick}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className={`truncate text-sm ${unread ? "font-semibold" : "font-medium"}`}>
          {title}
        </span>
        {unread > 0 ? (
          <Badge className="h-5 min-w-5 justify-center px-1.5 text-[10px]">{unread}</Badge>
        ) : badge ? (
          <Badge variant="outline" className="text-[10px]">
            {badge}
          </Badge>
        ) : null}
      </span>
      <span className="truncate text-xs text-muted-foreground">{preview}</span>
    </button>
  )
}

function MemberPicker({
  people,
  selected,
  onChange,
}: {
  people: Person[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const available = people.filter((person) => !selected.includes(person.id))
  return (
    <div className="grid gap-2">
      <Label>Invite people</Label>
      {available.length > 0 ? (
        <Select key={selected.join("|")} onValueChange={(id) => onChange([...selected, id])}>
          <SelectTrigger>
            <SelectValue placeholder="Add a person" />
          </SelectTrigger>
          <SelectContent>
            {available.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {personLabel(person)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm text-muted-foreground">
          {people.length === 0 ? "No people to invite yet." : "Everyone is already invited."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {selected.map((id) => {
          const person = people.find((item) => item.id === id)
          return (
            <Badge key={id} variant="secondary" className="gap-1 pr-1">
              {person ? personLabel(person) : id}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                onClick={() => onChange(selected.filter((item) => item !== id))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )
        })}
      </div>
    </div>
  )
}
