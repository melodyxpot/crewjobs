"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiBulkCreateApplications, apiGetWorkspaces } from "@/lib/api"
import type { Settings } from "@/lib/types"
import { DEFAULT_STATUSES, DEFAULT_PLATFORMS } from "@/lib/types"
import { toast } from "sonner"
import { Loader2, AlertCircle, CheckCircle2, Copy, Trash2 } from "lucide-react"

function toLocalDateTimeString(date: Date): string {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

interface QuickPasteModalProps {
  open: boolean
  settings: Settings | null
  onClose: () => void
  onSaved: () => void
}

type ParseFormat = "pipe" | "tab" | "url"

interface ParsedRow {
  company: string
  title: string
  link: string | null
  isValid: boolean
  error?: string
}

export function QuickPasteModal({ open, settings, onClose, onSaved }: QuickPasteModalProps) {
  const { user } = useAuth()
  const picksWorkspace = !!user && user.role !== "bidder"
  const [isLoading, setIsLoading] = useState(false)
  const [rawText, setRawText] = useState("")
  const [workspaces, setWorkspaces] = useState<{ _id: string; name: string }[]>([])
  const [workspaceId, setWorkspaceId] = useState("")
  const [format, setFormat] = useState<ParseFormat>("pipe")
  const [appliedAt, setAppliedAt] = useState(toLocalDateTimeString(new Date()))
  const [platform, setPlatform] = useState(settings?.defaultPlatform || "LinkedIn")
  const [status, setStatus] = useState(settings?.defaultStatus || "Applied")
  const [followUpDays] = useState(settings?.followUpOffsetDays || 7)

  const platforms = settings?.platformOptions || DEFAULT_PLATFORMS

  useEffect(() => {
    if (!open || !picksWorkspace) return
    apiGetWorkspaces()
      .then(({ workspaces: next }) => {
        const list = next || []
        setWorkspaces(list)
        if (list.length === 1) setWorkspaceId(list[0]._id)
      })
      .catch(() => {})
  }, [open, picksWorkspace])

  const parsedRows = useMemo(() => {
    if (!rawText.trim()) return []
    const lines = rawText.split("\n").filter((line) => line.trim())
    const rows: ParsedRow[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let company = "",
        title = "",
        link: string | null = null

      if (format === "pipe") {
        const parts = trimmed.split("|").map((p) => p.trim())
        company = parts[0] || ""
        title = parts[1] || ""
        link = parts[2] || null
      } else if (format === "tab") {
        const parts = trimmed.split("\t").map((p) => p.trim())
        company = parts[0] || ""
        title = parts[1] || ""
        link = parts[2] || null
      } else if (format === "url") {
        if (trimmed.startsWith("http")) {
          link = trimmed
          try {
            const url = new URL(trimmed)
            const domain = url.hostname.replace("www.", "").split(".")[0]
            company = domain.charAt(0).toUpperCase() + domain.slice(1)
            title = "Position (needs details)"
          } catch {
            company = "Unknown"
            title = "Position (needs details)"
          }
        } else {
          company = trimmed
          title = "Position (needs details)"
        }
      }

      const isValid = !!company && !!title
      rows.push({
        company,
        title,
        link: link && link.startsWith("http") ? link : null,
        isValid,
        error: !company ? "Missing company" : !title ? "Missing title" : undefined,
      })
    }
    return rows
  }, [rawText, format])

  const validRows = parsedRows.filter((r) => r.isValid)
  const invalidRows = parsedRows.filter((r) => !r.isValid)

  const handleClose = () => {
    onClose()
    onSaved()
  }
  const handleClear = () => {
    setRawText("")
  }
  const handleCopyInvalid = () => {
    const invalidLines = invalidRows
      .map((r) => `${r.company}|${r.title}|${r.link || ""}`)
      .join("\n")
    navigator.clipboard.writeText(invalidLines)
    toast.success("Invalid lines copied to clipboard")
  }

  const handleSubmit = async () => {
    if (validRows.length === 0) {
      toast.error("No valid rows to insert")
      return
    }
    if (picksWorkspace && workspaces.length > 1 && !workspaceId) {
      toast.error("Choose a workspace")
      return
    }
    setIsLoading(true)
    const followUpDate = new Date(appliedAt)
    followUpDate.setDate(followUpDate.getDate() + followUpDays)

    const applications = validRows.map((row) => ({
      company: row.company,
      title: row.title,
      link: row.link,
      platform,
      status,
      appliedAt: new Date(appliedAt).toISOString(),
      followUpAt: followUpDate.toISOString(),
      location: null,
      workLocation: null,
      jobType: null,
      notes: null,
    }))

    try {
      const result = await apiBulkCreateApplications(
        applications,
        picksWorkspace ? workspaceId || undefined : undefined,
      )
      toast.success(`Successfully inserted ${result.insertedCount} applications`)
      handleClose()
    } catch (err: any) {
      toast.error(err.message)
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden flex flex-col">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-2xl font-bold">Quick Paste - Bulk Import</DialogTitle>
          <DialogDescription className="text-base">
            Paste multiple job applications at once. Each line becomes one application.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto">
          <div className="space-y-4 pb-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="format" className="font-semibold text-foreground">
                  Format
                </Label>
                <Select value={format} onValueChange={(v) => setFormat(v as ParseFormat)}>
                  <SelectTrigger id="format" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pipe">Pipe: Company | Title | Link</SelectItem>
                    <SelectItem value="tab">Tab (Spreadsheet)</SelectItem>
                    <SelectItem value="url">URL Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform" className="font-semibold text-foreground">
                  Platform
                </Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger id="platform" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {picksWorkspace && workspaces.length > 0 && (
              <div className="space-y-2">
                <Label className="font-semibold text-foreground">
                  Workspace {workspaces.length > 1 && <span className="text-destructive">*</span>}
                </Label>
                <Select value={workspaceId || undefined} onValueChange={setWorkspaceId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose a workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace._id} value={workspace._id}>
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status" className="font-semibold text-foreground">
                  Status
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="appliedAt" className="font-semibold text-foreground">
                  Applied Date
                </Label>
                <Input
                  id="appliedAt"
                  type="datetime-local"
                  value={appliedAt}
                  onChange={(e) => setAppliedAt(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 flex-1 flex flex-col">
            <Label htmlFor="pasteData" className="font-semibold text-foreground">
              Paste Data
            </Label>
            <Textarea
              id="pasteData"
              placeholder={
                format === "pipe"
                  ? "Google | Software Engineer | https://jobs.google.com/...\nMeta | Product Manager"
                  : format === "tab"
                    ? "Company[TAB]Title[TAB]Link"
                    : "https://jobs.lever.co/company/job-id"
              }
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={5}
              className="font-mono text-sm flex-1"
            />
          </div>

          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Preview</h3>
              <Tabs defaultValue="valid" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="valid" className="gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Valid ({validRows.length})
                  </TabsTrigger>
                  {invalidRows.length > 0 && (
                    <TabsTrigger value="invalid" className="gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      Invalid ({invalidRows.length})
                    </TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="valid" className="mt-4">
                  <ScrollArea className="h-[200px] rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Company</TableHead>
                          <TableHead className="font-semibold">Title</TableHead>
                          <TableHead className="font-semibold">Link</TableHead>
                          <TableHead className="font-semibold">Platform</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validRows.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{row.company}</TableCell>
                            <TableCell>{row.title}</TableCell>
                            <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground">
                              {row.link || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {platform}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="invalid" className="mt-4">
                  <ScrollArea className="h-[200px] rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Company</TableHead>
                          <TableHead className="font-semibold">Title</TableHead>
                          <TableHead className="font-semibold">Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invalidRows.map((row, i) => (
                          <TableRow key={i} className="bg-destructive/5">
                            <TableCell>{row.company || "-"}</TableCell>
                            <TableCell>{row.title || "-"}</TableCell>
                            <TableCell className="text-destructive font-medium text-sm">
                              {row.error}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  {invalidRows.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={handleCopyInvalid}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Invalid Lines
                    </Button>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3 mt-6 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={handleClear} disabled={!rawText} className="h-10">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || validRows.length === 0}
            className="h-10 font-semibold"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Insert {validRows.length} {validRows.length === 1 ? "Row" : "Rows"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
