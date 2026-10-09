"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { usePathname, useRouter } from "next/navigation"
import { recordIdFromPath } from "@/lib/record-link"
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import {
  apiCreateEvent,
  apiDeleteEvent,
  apiGetEvent,
  apiGetEvents,
  apiGetWorkspaces,
  apiUpdateEvent,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import { EventDialog } from "@/components/calendar/event-dialog"
import {
  formatClock,
  workspaceColor,
  type CalendarEvent,
  type EventDraft,
  type WorkspaceOption,
} from "@/components/calendar/types"

type View = "day" | "week" | "month"

const HOUR_HEIGHT = 48
const MONTH_EVENT_LIMIT = 3

function atNoon(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
}

function dayFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return atNoon(new Date())
  return new Date(year, month - 1, day, 12)
}

function draftFrom(event: CalendarEvent): EventDraft {
  return {
    id: event._id,
    workspaceId: event.workspaceId,
    date: event.date,
    startTime: event.startTime || "",
    endTime: event.endTime || "",
    client: event.client,
    details: event.details || "",
  }
}

function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function visibleRange(view: View, cursor: Date) {
  if (view === "day") {
    const key = dateKey(cursor)
    return { from: key, to: key }
  }
  if (view === "week") {
    return { from: dateKey(startOfWeek(cursor)), to: dateKey(endOfWeek(cursor)) }
  }
  return {
    from: dateKey(startOfWeek(startOfMonth(cursor))),
    to: dateKey(endOfWeek(endOfMonth(cursor))),
  }
}

function rangeTitle(view: View, cursor: Date) {
  if (view === "day") return format(cursor, "EEEE, MMMM d, yyyy")
  if (view === "week") {
    const start = startOfWeek(cursor)
    const end = endOfWeek(cursor)
    const sameMonth = start.getMonth() === end.getMonth()
    const startLabel = format(start, sameMonth ? "MMMM d" : "MMM d")
    const endLabel = format(end, sameMonth ? "d, yyyy" : "MMM d, yyyy")
    return `${startLabel} – ${endLabel}`
  }
  return format(cursor, "MMMM yyyy")
}

function minutesToTime(total: number) {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => {
    if (!a.startTime && b.startTime) return -1
    if (a.startTime && !b.startTime) return 1
    return (a.startTime || "").localeCompare(b.startTime || "") || a.client.localeCompare(b.client)
  })
}

function placeTimed(events: CalendarEvent[]) {
  const sorted = [...events].sort(
    (a, b) =>
      (a.startTime || "").localeCompare(b.startTime || "") ||
      (a.endTime || "").localeCompare(b.endTime || ""),
  )
  const placed: { event: CalendarEvent; column: number; columns: number }[] = []
  let cluster: { event: CalendarEvent; column: number; columns: number }[] = []
  let clusterEnd = ""

  function flush() {
    const columns = Math.max(...cluster.map((item) => item.column)) + 1
    for (const item of cluster) item.columns = columns
    placed.push(...cluster)
    cluster = []
    clusterEnd = ""
  }

  for (const event of sorted) {
    const start = event.startTime || "00:00"
    if (cluster.length && start >= clusterEnd) flush()
    const used = new Set(
      cluster.filter((item) => (item.event.endTime || "23:59") > start).map((item) => item.column),
    )
    let column = 0
    while (used.has(column)) column += 1
    cluster.push({ event, column, columns: 1 })
    const end = event.endTime || start
    if (end > clusterEnd) clusterEnd = end
  }
  if (cluster.length) flush()
  return placed
}

export function CalendarBoard() {
  const pathname = usePathname()
  const router = useRouter()
  const routeId = recordIdFromPath(pathname, "event")
  const { user } = useAuth()
  const canEdit = !!user?.isSuperAdmin || user?.role === "leader" || user?.role === "moderator"
  const [view, setView] = useState<View>("month")
  const [cursor, setCursor] = useState(() => atNoon(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const scrollRef = useRef<HTMLDivElement>(null)
  const cursorKey = dateKey(cursor)
  const visibleIds = selectedIds ?? workspaces.map((workspace) => workspace._id)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!routeId) return
    let cancelled = false
    apiGetEvent(routeId)
      .then((result) => {
        if (cancelled) return
        const event = result.event as CalendarEvent
        setCursor(dayFromKey(event.date))
        setDraft(draftFrom(event))
      })
      .catch((error: Error) => {
        if (cancelled) return
        toast.error(error.message)
        router.replace("/calendar")
      })
    return () => {
      cancelled = true
    }
  }, [routeId, router])

  useEffect(() => {
    let cancelled = false
    const range = visibleRange(view, cursor)
    setLoading(true)
    Promise.all([apiGetEvents(range.from, range.to), apiGetWorkspaces()])
      .then(([eventResult, workspaceResult]) => {
        if (cancelled) return
        setEvents(eventResult.events)
        setWorkspaces(workspaceResult.workspaces)
      })
      .catch((error: Error) => {
        if (!cancelled) toast.error(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // cursorKey captures the calendar day; the Date object identity is not meaningful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cursorKey])

  useEffect(() => {
    if (view === "month") return
    const node = scrollRef.current
    if (node) node.scrollTop = 7 * HOUR_HEIGHT
  }, [view, cursorKey])

  const eventsByDate = useMemo(() => {
    const allowed = new Set(selectedIds ?? workspaces.map((workspace) => workspace._id))
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      if (!allowed.has(event.workspaceId)) continue
      const list = map.get(event.date) || []
      list.push(event)
      map.set(event.date, list)
    }
    for (const [key, list] of map) map.set(key, sortEvents(list))
    return map
  }, [events, selectedIds, workspaces])

  function shift(direction: -1 | 1) {
    const next =
      view === "month"
        ? addMonths(cursor, direction)
        : view === "week"
          ? addWeeks(cursor, direction)
          : addDays(cursor, direction)
    setCursor(atNoon(next))
  }

  function showDay(day: Date) {
    setCursor(atNoon(day))
    setView("day")
  }

  function openCreate(day: Date, startTime = "", endTime = "") {
    if (!canEdit) return
    if (workspaces.length === 0) {
      toast.error("Create a workspace before adding an event.")
      return
    }
    setDraft({
      workspaceId: visibleIds[0] || workspaces[0]._id,
      date: dateKey(day),
      startTime,
      endTime,
      client: "",
      details: "",
    })
  }

  function closeEvent() {
    setDraft(null)
    if (!routeId) return
    if (window.history.length > 1) router.back()
    else router.replace("/calendar")
  }

  function openEvent(event: CalendarEvent) {
    if (routeId === event._id) {
      setDraft(draftFrom(event))
      return
    }
    router.push(`/calendar/${event._id}`)
  }

  async function reload() {
    const range = visibleRange(view, cursor)
    const eventResult = await apiGetEvents(range.from, range.to)
    setEvents(eventResult.events)
  }

  async function saveDraft(next: EventDraft) {
    setSaving(true)
    try {
      const payload = {
        workspaceId: next.workspaceId,
        date: next.date,
        startTime: next.startTime || null,
        endTime: next.endTime || null,
        client: next.client,
        details: next.details,
      }
      if (next.id) await apiUpdateEvent(next.id, payload)
      else await apiCreateEvent(payload)
      toast.success(next.id ? "Event updated" : "Event added")
      if (routeId) closeEvent()
      else {
        setDraft(null)
        await reload()
      }
    } catch (error: any) {
      toast.error(error.message)
    }
    setSaving(false)
  }

  async function deleteEvent(id: string) {
    setSaving(true)
    try {
      await apiDeleteEvent(id)
      toast.success("Event deleted")
      if (routeId) closeEvent()
      else {
        setDraft(null)
        await reload()
      }
    } catch (error: any) {
      toast.error(error.message)
    }
    setSaving(false)
  }

  function toggleWorkspace(id: string) {
    const current = visibleIds
    setSelectedIds(current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  })
  const gridDays =
    view === "day"
      ? [cursor]
      : eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) })

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-[640px] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        {canEdit && (
          <Button onClick={() => openCreate(cursor)}>
            <Plus className="h-4 w-4" />
            Create
          </Button>
        )}
        <Button variant="outline" onClick={() => setCursor(atNoon(new Date()))}>
          Today
        </Button>
        <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h1 className="min-w-0 text-xl font-normal">{rangeTitle(view, cursor)}</h1>
        <div className="ml-auto inline-flex rounded-md border p-0.5">
          {(["day", "week", "month"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                "rounded px-3 py-1 text-sm capitalize",
                view === item && "bg-accent font-medium",
              )}
              onClick={() => setView(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b px-4 py-2 lg:hidden">
        {workspaces.map((workspace) => {
          const active = visibleIds.includes(workspace._id)
          return (
            <button
              key={workspace._id}
              type="button"
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs",
                active ? "text-white" : "text-muted-foreground",
              )}
              style={active ? { backgroundColor: workspaceColor(workspace._id) } : undefined}
              onClick={() => toggleWorkspace(workspace._id)}
            >
              {workspace.name}
            </button>
          )
        })}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r p-4 lg:flex">
          <MiniMonth
            cursor={cursor}
            onSelect={(day) => setCursor(atNoon(day))}
            marked={eventsByDate}
          />
          <div>
            <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Workspaces
            </h2>
            {workspaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workspaces yet.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {workspaces.map((workspace) => (
                  <label
                    key={workspace._id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      style={{ accentColor: workspaceColor(workspace._id) }}
                      checked={visibleIds.includes(workspace._id)}
                      onChange={() => toggleWorkspace(workspace._id)}
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: workspaceColor(workspace._id) }}
                    />
                    <span className="truncate">{workspace.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {loading && (
            <div className="text-muted-foreground pointer-events-none absolute top-3 right-4 z-30 text-xs">
              Loading…
            </div>
          )}
          {workspaces.length > 0 && visibleIds.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
              Select a workspace to see its events.
            </div>
          ) : view === "month" ? (
            <MonthGrid
              cursor={cursor}
              days={monthDays}
              eventsByDate={eventsByDate}
              canEdit={canEdit}
              onCreate={openCreate}
              onOpen={openEvent}
              onShowDay={showDay}
            />
          ) : (
            <TimeGrid
              scrollRef={scrollRef}
              days={gridDays}
              eventsByDate={eventsByDate}
              canEdit={canEdit}
              now={now}
              onCreate={openCreate}
              onOpen={openEvent}
              onShowDay={showDay}
            />
          )}
        </div>
      </div>

      <EventDialog
        draft={draft}
        canEdit={canEdit}
        workspaces={workspaces}
        saving={saving}
        onOpenChange={(open) => {
          if (!open) closeEvent()
        }}
        onSave={saveDraft}
        onDelete={deleteEvent}
      />
    </div>
  )
}

function MiniMonth({
  cursor,
  onSelect,
  marked,
}: {
  cursor: Date
  onSelect: (day: Date) => void
  marked: Map<string, CalendarEvent[]>
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  })
  const today = new Date()

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">{format(cursor, "MMMM yyyy")}</p>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
          <div key={`${label}-${index}`} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dateKey(day)
          const selected = isSameDay(day, cursor)
          const isToday = isSameDay(day, today)
          return (
            <button
              key={key}
              type="button"
              className="flex h-9 flex-col items-center justify-center text-xs"
              onClick={() => onSelect(day)}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full",
                  !isSameMonth(day, cursor) && "text-muted-foreground",
                  selected && "bg-[#1a73e8] text-white",
                  !selected && isToday && "font-semibold text-[#1a73e8]",
                )}
              >
                {format(day, "d")}
              </span>
              <span
                className={cn(
                  "mt-0.5 h-1 w-1 rounded-full",
                  marked.has(key) ? "bg-[#1a73e8]" : "bg-transparent",
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EventChip({
  event,
  onOpen,
}: {
  event: CalendarEvent
  onOpen: (event: CalendarEvent) => void
}) {
  const label = event.startTime ? `${formatClock(event.startTime)} ${event.client}` : event.client
  return (
    <button
      type="button"
      title={`${label} · ${event.workspaceName}`}
      className="w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white"
      style={{ backgroundColor: workspaceColor(event.workspaceId) }}
      onClick={(click) => {
        click.stopPropagation()
        onOpen(event)
      }}
    >
      {label}
    </button>
  )
}

function MonthGrid({
  cursor,
  days,
  eventsByDate,
  canEdit,
  onCreate,
  onOpen,
  onShowDay,
}: {
  cursor: Date
  days: Date[]
  eventsByDate: Map<string, CalendarEvent[]>
  canEdit: boolean
  onCreate: (day: Date) => void
  onOpen: (event: CalendarEvent) => void
  onShowDay: (day: Date) => void
}) {
  const rows = days.length / 7
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 border-b text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(7.5rem, 1fr))` }}
      >
        {days.map((day) => {
          const key = dateKey(day)
          const dayEvents = eventsByDate.get(key) || []
          const shown = dayEvents.slice(0, MONTH_EVENT_LIMIT)
          const extra = dayEvents.length - shown.length
          const isToday = isSameDay(day, new Date())
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-24 flex-col gap-0.5 border-r border-b p-1",
                !isSameMonth(day, cursor) && "bg-muted/40",
                canEdit && "cursor-pointer",
              )}
              onClick={() => onCreate(day)}
            >
              <button
                type="button"
                className={cn(
                  "mb-0.5 flex size-7 items-center justify-center rounded-full text-xs",
                  isToday && "bg-[#1a73e8] font-medium text-white",
                  !isSameMonth(day, cursor) && !isToday && "text-muted-foreground",
                )}
                onClick={(click) => {
                  click.stopPropagation()
                  onShowDay(day)
                }}
              >
                {format(day, "d")}
              </button>
              {shown.map((event) => (
                <EventChip key={event._id} event={event} onOpen={onOpen} />
              ))}
              {extra > 0 && (
                <button
                  type="button"
                  className="px-1 text-left text-[11px] font-medium text-[#1a73e8]"
                  onClick={(click) => {
                    click.stopPropagation()
                    onShowDay(day)
                  }}
                >
                  +{extra} more
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimeGrid({
  scrollRef,
  days,
  eventsByDate,
  canEdit,
  now,
  onCreate,
  onOpen,
  onShowDay,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  days: Date[]
  eventsByDate: Map<string, CalendarEvent[]>
  canEdit: boolean
  now: Date
  onCreate: (day: Date, startTime: string, endTime: string) => void
  onOpen: (event: CalendarEvent) => void
  onShowDay: (day: Date) => void
}) {
  const columns = `64px repeat(${days.length}, minmax(0, 1fr))`
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
      <div className="sticky top-0 z-20 bg-background">
        <div className="grid border-b" style={{ gridTemplateColumns: columns }}>
          <div />
          {days.map((day) => {
            const isToday = isSameDay(day, now)
            return (
              <button
                key={dateKey(day)}
                type="button"
                className="border-l py-2 text-center"
                onClick={() => onShowDay(day)}
              >
                <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {format(day, "EEE")}
                </div>
                <div
                  className={cn(
                    "mx-auto mt-1 flex size-10 items-center justify-center rounded-full text-2xl",
                    isToday && "bg-[#1a73e8] text-white",
                  )}
                >
                  {format(day, "d")}
                </div>
              </button>
            )
          })}
        </div>
        <div className="grid border-b" style={{ gridTemplateColumns: columns }}>
          <div className="px-2 py-2 text-right text-[10px] text-muted-foreground">all-day</div>
          {days.map((day) => {
            const allDay = (eventsByDate.get(dateKey(day)) || []).filter(
              (event) => !event.startTime,
            )
            return (
              <div
                key={dateKey(day)}
                className={cn("min-h-10 space-y-0.5 border-l p-1", canEdit && "cursor-pointer")}
                onClick={() => onCreate(day, "", "")}
              >
                {allDay.map((event) => (
                  <EventChip key={event._id} event={event} onOpen={onOpen} />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <div className="relative" style={{ height: 24 * HOUR_HEIGHT }}>
        {Array.from({ length: 24 }, (_, hour) => (
          <div
            key={hour}
            className="pointer-events-none absolute right-0 left-16 border-t border-border/70"
            style={{ top: hour * HOUR_HEIGHT }}
          />
        ))}
        <div className="grid h-full" style={{ gridTemplateColumns: columns }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, hour) =>
              hour === 0 ? null : (
                <div
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                  style={{ top: hour * HOUR_HEIGHT }}
                >
                  {formatClock(minutesToTime(hour * 60))}
                </div>
              ),
            )}
          </div>
          {days.map((day) => {
            const timed = (eventsByDate.get(dateKey(day)) || []).filter((event) => event.startTime)
            const placed = placeTimed(timed)
            const isToday = isSameDay(day, now)
            return (
              <div
                key={dateKey(day)}
                className={cn("relative border-l", canEdit && "cursor-pointer")}
                onClick={(click) => {
                  if (!canEdit) return
                  const bounds = click.currentTarget.getBoundingClientRect()
                  const y = click.clientY - bounds.top
                  const minutes = Math.max(
                    0,
                    Math.min(23 * 60 + 45, Math.floor((y / HOUR_HEIGHT) * 60)),
                  )
                  const snapped = Math.floor(minutes / 15) * 15
                  const end = Math.min(snapped + 60, 23 * 60 + 45)
                  onCreate(day, minutesToTime(snapped), minutesToTime(Math.max(end, snapped + 15)))
                }}
              >
                {isToday && (
                  <div
                    className="pointer-events-none absolute right-0 left-0 z-10 border-t-2 border-red-500"
                    style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                  >
                    <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full bg-red-500" />
                  </div>
                )}
                {placed.map(({ event, column, columns: span }) => {
                  const start = timeToMinutes(event.startTime || "00:00")
                  const end = timeToMinutes(event.endTime || event.startTime || "00:30")
                  const top = (start / 60) * HOUR_HEIGHT
                  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT, 22)
                  return (
                    <button
                      key={event._id}
                      type="button"
                      title={`${event.client} · ${event.workspaceName}`}
                      className="absolute z-10 overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] text-white"
                      style={{
                        top,
                        height,
                        left: `calc(${(column / span) * 100}% + 2px)`,
                        width: `calc(${100 / span}% - 4px)`,
                        backgroundColor: workspaceColor(event.workspaceId),
                      }}
                      onClick={(click) => {
                        click.stopPropagation()
                        onOpen(event)
                      }}
                    >
                      <span className="block truncate font-medium">{event.client}</span>
                      {height > 36 && (
                        <span className="block truncate opacity-90">
                          {formatClock(event.startTime || "")} – {formatClock(event.endTime || "")}
                        </span>
                      )}
                      {height > 54 && (
                        <span className="block truncate opacity-90">{event.workspaceName}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
