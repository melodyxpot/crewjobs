"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { apiGetChatUnread } from "@/lib/api"

const UnreadContext = createContext(0)

export function useUnreadMessages() {
  return useContext(UnreadContext)
}

export const ACTIVE_THREAD_KEY = "crewjobs_active_thread"

export function MessageNotifications({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  const lastId = useRef<string | null>(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    let stopped = false

    async function poll() {
      try {
        const data = await apiGetChatUnread()
        if (stopped) return
        setUnread(data.count || 0)
        const latest = data.latest
        if (!latest) return
        const isFirst = lastId.current === null
        if (latest._id === lastId.current) return
        lastId.current = latest._id
        if (isFirst) return

        const active =
          typeof window !== "undefined" ? sessionStorage.getItem(ACTIVE_THREAD_KEY) : null
        const viewing = pathnameRef.current === "/chat" && active === latest.conversationId
        if (viewing) return

        const preview = latest.body.length > 140 ? `${latest.body.slice(0, 140)}…` : latest.body
        toast(latest.senderName || "New message", { description: preview })
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          document.hidden
        ) {
          new Notification(latest.senderName || "New message", { body: preview })
        }
      } catch {
        // The badge stays at the last known count if a poll fails.
      }
    }

    poll()
    const timer = setInterval(poll, 8000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [])

  return <UnreadContext.Provider value={unread}>{children}</UnreadContext.Provider>
}
