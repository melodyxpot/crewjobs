"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiCreateJob, apiDeleteJob, apiGetJobs, apiGetWorkspaces, apiUpdateJob } from "@/lib/api"
import { toast } from "sonner"
import { ExternalLink, Loader2, Trash2 } from "lucide-react"

export default function JobsPage() {
  const { user } = useAuth()
  const canAssign = !!user?.isSuperAdmin || user?.role === "leader" || user?.role === "moderator"
  const [jobs, setJobs] = useState<any[]>([])
  const [count, setCount] = useState(0)
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [workspaceId, setWorkspaceId] = useState("all")
  const [status, setStatus] = useState("all")
  const [form, setForm] = useState({ company: "", title: "", link: "", platform: "LinkedIn", workspaceId: "", assignedTo: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiGetWorkspaces().then(({ workspaces: next }) => setWorkspaces(next)).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [page, workspaceId, status])

  async function load() {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), pageSize: "20" }
      if (search) params.search = search
      if (workspaceId !== "all") params.workspaceId = workspaceId
      if (status !== "all") params.status = status
      const result = await apiGetJobs(params)
      setJobs(result.data)
      setCount(result.count)
    } catch (error: any) {
      toast.error(error.message)
    }
    setLoading(false)
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
      setForm({ company: "", title: "", link: "", platform: "LinkedIn", workspaceId: form.workspaceId, assignedTo: "" })
      toast.success("Remote job saved")
      setPage(1)
      await load()
    } catch (error: any) {
      toast.error(error.message)
    }
    setSaving(false)
  }

  async function assign(job: any, assignedTo: string, nextWorkspaceId?: string) {
    try {
      await apiUpdateJob(job._id, {
        assignedTo: assignedTo === "unassigned" ? null : assignedTo,
        workspaceId: nextWorkspaceId === undefined ? job.workspaceId : nextWorkspaceId || null,
      })
      toast.success("Job updated")
      await load()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const formWorkspace = workspaces.find((workspace) => workspace._id === form.workspaceId)
  const formBidders = formWorkspace?.bidderIds || []
  const totalPages = Math.max(Math.ceil(count / 20), 1)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Remote jobs</h1>
        <p className="text-sm text-muted-foreground">
          Only remote jobs are kept here. Save one from the extension or this form, then assign it to a bidder in the workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a remote job</CardTitle>
          <CardDescription>Hybrid and onsite jobs are rejected.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Company</Label>
            <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Link</Label>
            <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Platform</Label>
            <Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Workspace</Label>
            <Select value={form.workspaceId || "none"} onValueChange={(value) => setForm({ ...form, workspaceId: value === "none" ? "" : value, assignedTo: "" })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Workspace" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No workspace yet</SelectItem>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace._id} value={workspace._id}>{workspace.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canAssign && (
            <div className="grid gap-2">
              <Label>Assign bidder</Label>
              <Select value={form.assignedTo || "unassigned"} onValueChange={(value) => setForm({ ...form, assignedTo: value === "unassigned" ? "" : value })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Bidder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {formBidders.map((bidder: any) => (
                    <SelectItem key={bidder._id} value={bidder._id}>{bidder.username || bidder.name || bidder.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="md:col-span-2">
            <Button onClick={addJob} disabled={saving || !form.company.trim() || !form.title.trim()}>
              {saving ? "Saving..." : "Save remote job"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row">
            <Input
              placeholder="Search company or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1)
                  load()
                }
              }}
            />
            <Select value={workspaceId} onValueChange={(value) => { setWorkspaceId(value); setPage(1) }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Workspace" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workspaces</SelectItem>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace._id} value={workspace._id}>{workspace.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1) }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Assigned bidder</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Link</TableHead>
                    {canAssign && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canAssign ? 7 : 6} className="h-24 text-center text-muted-foreground">
                        No remote jobs yet.
                      </TableCell>
                    </TableRow>
                  ) : jobs.map((job) => {
                    const workspace = workspaces.find((item) => item._id === job.workspaceId)
                    const bidders = workspace?.bidderIds || []
                    return (
                      <TableRow key={job._id}>
                        <TableCell className="font-medium">{job.company}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{job.title}</TableCell>
                        <TableCell>
                          {canAssign ? (
                            <Select
                              value={job.workspaceId || "none"}
                              onValueChange={(value) => assign(job, job.assignedTo || "unassigned", value === "none" ? "" : value)}
                            >
                              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {workspaces.map((item) => (
                                  <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (job.workspaceName || "—")}
                        </TableCell>
                        <TableCell>
                          {canAssign ? (
                            <Select value={job.assignedTo || "unassigned"} onValueChange={(value) => assign(job, value)}>
                              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {bidders.map((bidder: any) => (
                                  <SelectItem key={bidder._id} value={bidder._id}>{bidder.username || bidder.name || bidder.email}</SelectItem>
                                ))}
                                {job.assignedTo && !bidders.some((bidder: any) => bidder._id === job.assignedTo) && (
                                  <SelectItem value={job.assignedTo}>{job.assignedName || "Assigned"}</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          ) : (job.assignedName || "—")}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{job.status}</Badge></TableCell>
                        <TableCell>
                          {job.link ? (
                            <a href={job.link} target="_blank" rel="noopener noreferrer" className="text-primary">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : "—"}
                        </TableCell>
                        {canAssign && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={async () => {
                              if (!confirm("Delete this job?")) return
                              try {
                                await apiDeleteJob(job._id)
                                toast.success("Job deleted")
                                load()
                              } catch (error: any) {
                                toast.error(error.message)
                              }
                            }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{count} jobs</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
