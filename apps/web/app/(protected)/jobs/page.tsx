"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import {
  apiAssignJobs,
  apiCreateJob,
  apiDeleteJobs,
  apiGetJobSources,
  apiGetJobs,
  apiGetSettings,
  apiGetWorkspaces,
  apiScrapeJobs,
  type ScraperSourceStatus,
} from "@/lib/api"
import { AssignJobsDialog } from "@/components/jobs/assign-jobs-dialog"
import { JOB_SOURCE_LABELS, JobDrawer, type JobDetail } from "@/components/jobs/job-drawer"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { toast } from "sonner"
import { ExternalLink, Loader2, Trash2 } from "lucide-react"

const REGIONS = ["US", "Europe", "Asia"] as const
const VISITED_LIMIT = 4000

function visitedStorageKey(userId: string) {
  return `crewjobs.visited-job-links.${userId}`
}

function readVisitedLinks(userId: string) {
  try {
    const raw = localStorage.getItem(visitedStorageKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return new Set<string>(
      Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [],
    )
  } catch {
    return new Set<string>()
  }
}

function visitToken(job: { _id: string; link?: string | null }) {
  return job.link || job._id
}

type ScrapeSummary = {
  created: number
  duplicates: number
  rejected: number
  failedSources: { label: string; error: string }[]
}

type JobFilters = {
  page?: number
  workspaceId?: string
  status?: string
  region?: string
  source?: string
}

function summaryText(summary: ScrapeSummary) {
  const parts = [
    `${summary.created} new`,
    `${summary.duplicates} already saved`,
    `${summary.rejected} skipped`,
  ]
  if (summary.failedSources.length > 0) {
    parts.push(summary.failedSources.map((source) => `${source.label} failed`).join(", "))
  }
  return parts.join(" · ")
}

export default function JobsPage() {
  const { user } = useAuth()
  const canAssign = !!user?.isSuperAdmin || user?.role === "leader" || user?.role === "moderator"
  const canEditSources = !!user?.isSuperAdmin || user?.role === "leader"
  const [jobs, setJobs] = useState<any[]>([])
  const [count, setCount] = useState(0)
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [openJob, setOpenJob] = useState<JobDetail | null>(null)
  const [visited, setVisited] = useState<Set<string>>(new Set())
  const [selectingAll, setSelectingAll] = useState(false)
  const [allMatchingSelected, setAllMatchingSelected] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [workspaceId, setWorkspaceId] = useState("all")
  const [status, setStatus] = useState("all")
  const [region, setRegion] = useState("all")
  const [source, setSource] = useState("all")
  const [regions, setRegions] = useState<string[]>(["US", "Europe", "Asia"])
  const [catalog, setCatalog] = useState<ScraperSourceStatus[]>([])
  const [enabledSources, setEnabledSources] = useState<string[]>(["public"])
  const [scraping, setScraping] = useState(false)
  const [summary, setSummary] = useState<ScrapeSummary | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [form, setForm] = useState({
    company: "",
    title: "",
    link: "",
    platform: "LinkedIn",
    workspaceId: "",
    assignedTo: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    setVisited(readVisitedLinks(user.id))
  }, [user?.id])

  useEffect(() => {
    apiGetWorkspaces()
      .then(({ workspaces: next }) => setWorkspaces(next))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!canAssign) return
    Promise.all([apiGetJobSources(), apiGetSettings()])
      .then(([sourceResult, settingsResult]) => {
        setCatalog(sourceResult.sources)
        const chosen = settingsResult.settings?.scraperSources
        setEnabledSources(chosen?.length ? chosen : ["public"])
      })
      .catch(() => {})
  }, [canAssign])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load closes over the filters listed below
  }, [page, workspaceId, status, region, source])

  function queryParams(overrides: JobFilters = {}, extra: Record<string, string> = {}) {
    const nextPage = overrides.page ?? page
    const nextWorkspace = overrides.workspaceId ?? workspaceId
    const nextStatus = overrides.status ?? status
    const nextRegion = overrides.region ?? region
    const nextSource = overrides.source ?? source
    const params: Record<string, string> = { ...extra }
    if (nextPage) params.page = String(nextPage)
    if (!extra.idsOnly) params.pageSize = "20"
    if (search) params.search = search
    if (nextWorkspace !== "all") params.workspaceId = nextWorkspace
    if (nextStatus !== "all") params.status = nextStatus
    if (nextRegion !== "all") params.region = nextRegion
    if (nextSource !== "all") params.source = nextSource
    return params
  }

  function clearSelection() {
    setSelected([])
    setAllMatchingSelected(false)
  }

  async function load(overrides: JobFilters = {}) {
    setLoading(true)
    try {
      const result = await apiGetJobs(queryParams(overrides))
      setJobs(result.data)
      setCount(result.count)
    } catch (error: any) {
      toast.error(error.message)
    }
    setLoading(false)
  }

  function markVisited(job: { _id: string; link?: string | null }) {
    const token = visitToken(job)
    setVisited((current) => {
      if (current.has(token)) return current
      const next = new Set(current)
      next.add(token)
      if (user?.id) {
        const stored = [...next]
        const trimmed =
          stored.length > VISITED_LIMIT ? stored.slice(stored.length - VISITED_LIMIT) : stored
        localStorage.setItem(visitedStorageKey(user.id), JSON.stringify(trimmed))
      }
      return next
    })
  }

  async function scrape() {
    if (regions.length === 0) {
      toast.error("Choose at least one region")
      return
    }
    setScraping(true)
    try {
      const result = await apiScrapeJobs(regions)
      const nextSummary: ScrapeSummary = {
        created: result.created,
        duplicates: result.duplicates,
        rejected: result.rejected,
        failedSources: result.failedSources || [],
      }
      setSummary(nextSummary)
      setBatchId(result.batchId)
      setSelected(result.createdIds || [])
      setAllMatchingSelected(false)
      setWorkspaceId("unassigned")
      setStatus("all")
      setRegion("all")
      setSource("all")
      setPage(1)
      toast.success(summaryText(nextSummary))
      await load({
        page: 1,
        workspaceId: "unassigned",
        status: "all",
        region: "all",
        source: "all",
      })
    } catch (error: any) {
      toast.error(error.message)
    }
    setScraping(false)
  }

  async function addJob() {
    setSaving(true)
    try {
      await apiCreateJob({
        ...form,
        workLocation: "Remote",
        workspaceId: form.workspaceId || undefined,
        assignedTo: form.assignedTo || undefined,
      })
      setForm({
        company: "",
        title: "",
        link: "",
        platform: "LinkedIn",
        workspaceId: form.workspaceId,
        assignedTo: "",
      })
      toast.success("Remote job saved")
      setPage(1)
      await load({ page: 1 })
    } catch (error: any) {
      toast.error(error.message)
    }
    setSaving(false)
  }

  async function assignSelected(workspaceIds: string[]) {
    try {
      let created = 0
      const chunkSize = 200
      for (let index = 0; index < selected.length; index += chunkSize) {
        const result = await apiAssignJobs(selected.slice(index, index + chunkSize), workspaceIds)
        created += result.created
      }
      const copies = created === 1 ? "job" : "jobs"
      const rooms = workspaceIds.length === 1 ? "workspace" : "workspaces"
      toast.success(
        created > 0
          ? `Copied ${created} ${copies} into ${workspaceIds.length} ${rooms}`
          : "Those jobs are already in the selected workspaces",
      )
      clearSelection()
      await load()
    } catch (error: any) {
      toast.error(error.message)
      throw error
    }
  }

  async function selectAllMatching() {
    setSelectingAll(true)
    try {
      const result = await apiGetJobs(queryParams({}, { idsOnly: "1" }))
      const ids = (result.ids || []) as string[]
      setSelected(ids)
      setAllMatchingSelected(ids.length > 0 && !result.truncated)
      if (result.truncated) {
        toast(
          `Selected ${ids.length} of ${result.count} jobs. Narrow the filters to include the rest.`,
        )
      }
    } catch (error: any) {
      toast.error(error.message)
    }
    setSelectingAll(false)
  }

  function toggleRegion(value: string) {
    setRegions((current) => {
      if (current.includes(value)) {
        if (current.length === 1) {
          toast.error("Choose at least one region")
          return current
        }
        return current.filter((item) => item !== value)
      }
      return [...current, value]
    })
  }

  function toggleJob(id: string) {
    setAllMatchingSelected(false)
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const readySources = catalog.filter((item) => enabledSources.includes(item.id) && item.ready)
  const missingSources = catalog.filter((item) => enabledSources.includes(item.id) && !item.ready)
  const formWorkspace = workspaces.find((workspace) => workspace._id === form.workspaceId)
  const formBidders = formWorkspace?.bidderIds || []
  const totalPages = Math.max(Math.ceil(count / 20), 1)
  const columnCount = canAssign ? 8 : 7
  const deleteCount = deleteIds?.length || 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Remote Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Scrape remote developer jobs by region, then assign the ones you want to a workspace.
        </p>
      </div>

      {canAssign && (
        <Card>
          <CardHeader>
            <CardTitle>Scrape jobs</CardTitle>
            <CardDescription>
              Only remote developer roles are kept. Worldwide listings are included with the regions
              you pick.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Region</Label>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((item) => {
                  const active = regions.includes(item)
                  return (
                    <Button
                      key={item}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      aria-pressed={active}
                      onClick={() => toggleRegion(item)}
                    >
                      {item}
                    </Button>
                  )
                })}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Sources:{" "}
              {readySources.length > 0
                ? readySources.map((item) => item.label).join(", ")
                : "Public remote boards"}
              {missingSources.length > 0 && (
                <>
                  {" "}
                  · {missingSources.map((item) => item.label).join(", ")}{" "}
                  {missingSources.length === 1 ? "needs" : "need"}{" "}
                  {missingSources
                    .flatMap((item) => item.env)
                    .filter((key, index, list) => list.indexOf(key) === index)
                    .join(", ")}{" "}
                  in the API env file
                  {canEditSources && (
                    <>
                      {" "}
                      ·{" "}
                      <Link href="/settings" className="text-primary underline">
                        Settings
                      </Link>
                    </>
                  )}
                </>
              )}
              {missingSources.length === 0 && canEditSources && (
                <>
                  {" "}
                  ·{" "}
                  <Link href="/settings" className="text-primary underline">
                    Change sources
                  </Link>
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={scrape} disabled={scraping || regions.length === 0}>
                {scraping ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  "Scrape jobs"
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowManual((open) => !open)}>
                {showManual ? "Hide manual add" : "Add one job"}
              </Button>
            </div>
            {summary && (
              <p className="text-sm text-muted-foreground">
                {summaryText(summary)}
                {summary.failedSources.length > 0 && (
                  <span className="block">
                    {summary.failedSources
                      .map((item) => `${item.label}: ${item.error}`)
                      .join(" · ")}
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {canAssign && showManual && (
        <Card>
          <CardHeader>
            <CardTitle>Add one job</CardTitle>
            <CardDescription>Hybrid and onsite jobs are rejected.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Company</Label>
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Link</Label>
              <Input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Platform</Label>
              <Input
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Workspace</Label>
              <Select
                value={form.workspaceId || "none"}
                onValueChange={(value) =>
                  setForm({ ...form, workspaceId: value === "none" ? "" : value, assignedTo: "" })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No workspace yet</SelectItem>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace._id} value={workspace._id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Assign bidder</Label>
              <Select
                value={form.assignedTo || "unassigned"}
                onValueChange={(value) =>
                  setForm({ ...form, assignedTo: value === "unassigned" ? "" : value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Bidder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {formBidders.map((bidder: any) => (
                    <SelectItem key={bidder._id} value={bidder._id}>
                      {bidder.username || bidder.name || bidder.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button
                onClick={addJob}
                disabled={saving || !form.company.trim() || !form.title.trim()}
              >
                {saving ? "Saving..." : "Save remote job"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap">
            <Input
              placeholder="Search company or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  clearSelection()
                  setPage(1)
                  load({ page: 1 })
                }
              }}
              className="lg:max-w-xs"
            />
            <Select
              value={workspaceId}
              onValueChange={(value) => {
                clearSelection()
                setWorkspaceId(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workspaces</SelectItem>
                {canAssign && <SelectItem value="unassigned">Unassigned</SelectItem>}
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace._id} value={workspace._id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={region}
              onValueChange={(value) => {
                clearSelection()
                setRegion(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                <SelectItem value="US">US</SelectItem>
                <SelectItem value="Europe">Europe</SelectItem>
                <SelectItem value="Asia">Asia</SelectItem>
                <SelectItem value="Worldwide">Worldwide</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={source}
              onValueChange={(value) => {
                clearSelection()
                setSource(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {Object.entries(JOB_SOURCE_LABELS).map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => {
                clearSelection()
                setStatus(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {canAssign && selected.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
              <p className="text-sm font-medium">
                {allMatchingSelected
                  ? `All ${selected.length} jobs selected`
                  : `${selected.length} selected`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteIds([...selected])}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
                <Button size="sm" onClick={() => setAssignOpen(true)}>
                  Assign to workspaces
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canAssign && (
                      <TableHead className="w-10">
                        <input
                          ref={(node) => {
                            if (node)
                              node.indeterminate = selected.length > 0 && !allMatchingSelected
                          }}
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={allMatchingSelected}
                          disabled={selectingAll || count === 0}
                          aria-label="Select all jobs"
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => {
                            if (selectingAll) return
                            if (allMatchingSelected) {
                              clearSelection()
                              return
                            }
                            void selectAllMatching()
                          }}
                        />
                      </TableHead>
                    )}
                    <TableHead>Company</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={columnCount}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No remote jobs yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((job) => {
                      const fresh = !!batchId && job.scrapeBatchId === batchId
                      const opened = visited.has(visitToken(job))
                      return (
                        <TableRow
                          key={job._id}
                          tabIndex={0}
                          data-visited={opened ? "true" : "false"}
                          className={cn(
                            "cursor-pointer",
                            fresh && "bg-primary/5",
                            opened &&
                              "bg-violet-50 text-violet-800 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60",
                            openJob?._id === job._id && "ring-1 ring-inset ring-primary/40",
                          )}
                          onClick={() => setOpenJob(job)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              setOpenJob(job)
                            }
                          }}
                        >
                          {canAssign && (
                            <TableCell
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                checked={selected.includes(job._id)}
                                aria-label={`Select ${job.title}`}
                                onChange={() => toggleJob(job._id)}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium">{job.company}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{job.title}</TableCell>
                          <TableCell>
                            {job.region ? <Badge variant="outline">{job.region}</Badge> : "—"}
                          </TableCell>
                          <TableCell>{JOB_SOURCE_LABELS[job.source] || "—"}</TableCell>
                          <TableCell>
                            {job.workspaceName?.trim() ? job.workspaceName : "Unassigned"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            {job.link ? (
                              <a
                                href={job.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={opened ? `Opened ${job.title}` : `Open ${job.title}`}
                                className={cn(
                                  "inline-flex",
                                  opened ? "text-violet-700 dark:text-violet-300" : "text-primary",
                                )}
                                onClick={() => markVisited(job)}
                                onAuxClick={() => markVisited(job)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{count} jobs</p>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AssignJobsDialog
        open={assignOpen}
        jobCount={selected.length}
        workspaces={workspaces}
        onOpenChange={setAssignOpen}
        onConfirm={assignSelected}
      />
      <ConfirmDialog
        open={deleteCount > 0}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteIds(null)
        }}
        title={deleteCount === 1 ? "Delete job?" : `Delete ${deleteCount} jobs?`}
        description={
          deleteCount === 1
            ? "This remote job will be permanently removed."
            : `${deleteCount} remote jobs will be permanently removed.`
        }
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        destructive
        onConfirm={async () => {
          if (!deleteIds?.length || deleting) return
          const ids = deleteIds
          setDeleting(true)
          try {
            const result = await apiDeleteJobs(ids)
            const removed = new Set(ids)
            toast.success(result.deleted === 1 ? "Job deleted" : `${result.deleted} jobs deleted`)
            setSelected((current) => current.filter((id) => !removed.has(id)))
            setAllMatchingSelected(false)
            setDeleteIds(null)
            setOpenJob((current) => (current && removed.has(current._id) ? null : current))
            const pageEmptied = jobs.length > 0 && jobs.every((job) => removed.has(job._id))
            const nextPage = removed.size >= count ? 1 : pageEmptied && page > 1 ? page - 1 : page
            if (nextPage !== page) setPage(nextPage)
            else await load()
          } catch (error: any) {
            toast.error(error.message)
          }
          setDeleting(false)
        }}
      />
      <JobDrawer
        job={openJob}
        open={!!openJob}
        visited={!!openJob && visited.has(visitToken(openJob))}
        canDelete={canAssign}
        onOpenChange={(open) => {
          if (!open) setOpenJob(null)
        }}
        onVisit={() => {
          if (openJob) markVisited(openJob)
        }}
        onDelete={() => {
          if (openJob) setDeleteIds([openJob._id])
        }}
      />
    </div>
  )
}
