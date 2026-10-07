"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ApplicationsTable } from "@/components/applications/applications-table"
import { ApplicationsHeader } from "@/components/applications/applications-header"
import { ApplicationDrawer } from "@/components/applications/application-drawer"
import { QuickPasteModal } from "@/components/applications/quick-paste-modal"
import { apiGetSettings } from "@/lib/api"
import type { Settings } from "@/lib/types"

export default function ApplicationsPage() {
  const searchParams = useSearchParams()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editId, setEditId] = useState<string | undefined>()
  const [quickpasteOpen, setQuickpasteOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    apiGetSettings().then(({ settings }) => setSettings(settings)).catch(() => {})
  }, [])

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

  const openAdd = useCallback(() => { setEditId(undefined); setDrawerOpen(true) }, [])
  const openEdit = useCallback((id: string) => { setEditId(id); setDrawerOpen(true) }, [])
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditId(undefined) }, [])
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
      <ApplicationDrawer open={drawerOpen || !!editId} editId={editId} settings={settings} onClose={closeDrawer} onSaved={onSaved} />
      <QuickPasteModal open={quickpasteOpen} settings={settings} onClose={closeQuickpaste} onSaved={onSaved} />
    </div>
  )
}
