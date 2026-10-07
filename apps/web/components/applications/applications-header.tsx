"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, ClipboardPaste, Download, Loader2 } from "lucide-react"
import { apiGetApplications } from "@/lib/api"
import { toast } from "sonner"
import * as XLSX from "xlsx"

interface ApplicationsHeaderProps {
  onAdd: () => void
  onQuickPaste: () => void
}

export function ApplicationsHeader({ onAdd, onQuickPaste }: ApplicationsHeaderProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await apiGetApplications({ pageSize: "10000" })
      const rows = result.data.map((app: any) => ({
        Company: app.company,
        "Job Title": app.title,
        Platform: app.platform,
        Status: app.status,
        "Applied Date": app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "",
        "Follow-up Date": app.followUpAt ? new Date(app.followUpAt).toLocaleDateString() : "",
        Location: app.location || "",
        "Work Location": app.workLocation || "",
        "Job Type": app.jobType || "",
        Link: app.link || "",
        Notes: app.notes || "",
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Applications")
      XLSX.writeFile(wb, `crewjobs-applications-${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success(`Exported ${rows.length} applications`)
    } catch (err: any) {
      toast.error(err.message)
    }
    setExporting(false)
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
        <p className="text-muted-foreground">Manage and track all your job applications</p>
      </div>
      <div className="flex gap-3">
        <Button onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Application
        </Button>
        <Button variant="outline" onClick={onQuickPaste}>
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Quick Paste
        </Button>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export
        </Button>
      </div>
    </div>
  )
}
