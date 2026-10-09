"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { recordIdFromPath } from "@/lib/record-link"
import { ApplicationsTable } from "@/components/applications/applications-table"
import { ApplicationsHeader } from "@/components/applications/applications-header"
import { ApplicationDrawer } from "@/components/applications/application-drawer"
import { QuickPasteModal } from "@/components/applications/quick-paste-modal"
import { apiGetSettings } from "@/lib/api"
import type { Settings } from "@/lib/types"

export default function ApplicationsPage() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const routeId = recordIdFromPath(pathname, "application") || undefined
  const [settings, setSettings] = useState<Settings | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(!!routeId)
  const [editId, setEditId] = useState<string | undefined>(routeId)
  const [quickpasteOpen, setQuickpasteOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    apiGetSettings()
      .then(({ settings }) => setSettings(settings))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!routeId) return
    setEditId(routeId)
    setDrawerOpen(true)
  }, [routeId])

  const page = Number(searchParams.get("page")) || 1
  const search = searchParams.get("search") || ""
  const status = searchParams.get("status") || "all"
  const platform = searchParams.get("platform") || "all"
  const dateFrom = searchParams.get("dateFrom") || ""
  const dateTo = searchParams.get("dateTo") || ""
  const sortBy = searchParams.get("sortBy") || "appliedAt"
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc"
  const bidderId = searchParams.get("bidder") || "all"
  const workspaceId = searchParams.get("workspace") || "all"

  const openAdd = useCallback(() => {
    setEditId(undefined)
    setDrawerOpen(true)
    if (!routeId) return
    const query = searchParams.toString()
    router.push(query ? `/applications?${query}` : "/applications")
  }, [routeId, router, searchParams])
  const openEdit = useCallback(
    (id: string) => {
      const query = searchParams.toString()
      router.push(query ? `/applications/${id}?${query}` : `/applications/${id}`)
    },
    [router, searchParams],
  )
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setEditId(undefined)
    if (!routeId) return
    const query = searchParams.toString()
    const list = query ? `/applications?${query}` : "/applications"
    if (window.history.length > 1) router.back()
    else router.replace(list)
  }, [routeId, router, searchParams])
  const openQuickpaste = useCallback(() => setQuickpasteOpen(true), [])
  const closeQuickpaste = useCallback(() => setQuickpasteOpen(false), [])
  const onSaved = useCallback(() => setRefreshKey((k) => k + 1), [])

  return (
    <div className="flex flex-col gap-6 p-6">
      <ApplicationsHeader onAdd={openAdd} onQuickPaste={openQuickpaste} />
      <ApplicationsTable
        page={page}
        search={search}
        status={status}
        platform={platform}
        dateFrom={dateFrom}
        dateTo={dateTo}
        sortBy={sortBy}
        sortOrder={sortOrder}
        bidderId={bidderId}
        workspaceId={workspaceId}
        settings={settings}
        onEdit={openEdit}
        refreshKey={refreshKey}
      />
      <ApplicationDrawer
        open={drawerOpen || !!editId}
        editId={editId}
        settings={settings}
        onClose={closeDrawer}
        onSaved={onSaved}
      />
      <QuickPasteModal
        open={quickpasteOpen}
        settings={settings}
        onClose={closeQuickpaste}
        onSaved={onSaved}
      />
    </div>
  )
}
