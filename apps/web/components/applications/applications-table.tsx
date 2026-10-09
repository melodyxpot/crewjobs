"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  ArrowUpDown,
  MoreHorizontal,
  ExternalLink,
  Link2,
  Pencil,
  Trash2,
  Search,
  X,
  AlertCircle,
  FileDown,
} from "lucide-react"
import { apiGetApplications, apiDeleteApplication, apiGetBidFilters } from "@/lib/api"
import { copyRecordLink } from "@/lib/record-link"
import { useAuth } from "@/lib/auth-context"
import type { JobApplication, Settings } from "@/lib/types"
import { DEFAULT_STATUSES, DEFAULT_PLATFORMS } from "@/lib/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ApplicationsTableProps {
  page: number
  search: string
  status: string
  platform: string
  dateFrom: string
  dateTo: string
  sortBy: string
  sortOrder: "asc" | "desc"
  bidderId: string
  workspaceId: string
  settings: Settings | null
  onEdit: (id: string) => void
  refreshKey?: number
}

const PAGE_SIZE = 20

export function ApplicationsTable({
  page,
  search,
  status,
  platform,
  dateFrom,
  dateTo,
  sortBy,
  sortOrder,
  bidderId,
  workspaceId,
  settings,
  onEdit,
  refreshKey,
}: ApplicationsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [searchInput, setSearchInput] = useState(search)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { user } = useAuth()
  const canFilter =
    !!user?.isSuperAdmin || ["leader", "moderator", "caller", "finance"].includes(user?.role || "")
  const [filters, setFilters] = useState<{
    bidders: { id: string; name: string; role: string }[]
    workspaces: { id: string; name: string }[]
  }>({ bidders: [], workspaces: [] })

  const platforms = settings?.platformOptions || DEFAULT_PLATFORMS

  useEffect(() => {
    if (!canFilter) return
    apiGetBidFilters()
      .then(setFilters)
      .catch(() => {})
  }, [canFilter])

  const fetchApplications = useCallback(async () => {
    if (isInitialLoad) {
      setIsLoading(true)
    }
    try {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy,
        sortOrder,
      }
      if (search) params.search = search
      if (status && status !== "all") params.status = status
      if (platform && platform !== "all") params.platform = platform
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (canFilter && bidderId && bidderId !== "all") params.bidderId = bidderId
      if (canFilter && workspaceId && workspaceId !== "all") params.workspaceId = workspaceId

      const result = await apiGetApplications(params)
      setApplications(result.data)
      setTotalCount(result.count)
    } catch {
      toast.error("Failed to fetch applications")
    }
    setIsLoading(false)
    if (isInitialLoad) setIsInitialLoad(false)
  }, [
    page,
    search,
    status,
    platform,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
    bidderId,
    workspaceId,
    canFilter,
    isInitialLoad,
  ])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications, refreshKey])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput, page: "1" })
      }
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateParams reads the latest search params when the timer fires
  }, [searchInput, search])

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "all" && value !== "") {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    router.push(`/applications?${params.toString()}`)
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      updateParams({ sortOrder: sortOrder === "asc" ? "desc" : "asc" })
    } else {
      updateParams({ sortBy: column, sortOrder: "desc" })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await apiDeleteApplication(deleteId)
      toast.success("Application deleted")
      setDeleteId(null)
      fetchApplications()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const clearFilters = () => {
    setSearchInput("")
    router.push("/applications")
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const hasFilters =
    search ||
    status !== "all" ||
    platform !== "all" ||
    dateFrom ||
    dateTo ||
    (canFilter && bidderId !== "all") ||
    (canFilter && workspaceId !== "all")

  const isOverdue = (app: JobApplication) => {
    if (!app.followUpAt || app.status !== "Applied") return false
    return new Date(app.followUpAt) <= new Date()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Interview":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      case "Offer":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "Rejected":
        return "bg-red-500/10 text-red-600 border-red-500/20"
      case "Withdrawn":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20"
      case "No Response":
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
      default:
        return "bg-primary/10 text-primary border-primary/20"
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search company or title..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={status}
              onValueChange={(value) => updateParams({ status: value, page: "1" })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {DEFAULT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={platform}
              onValueChange={(value) => updateParams({ platform: value, page: "1" })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canFilter && (
              <Select
                value={bidderId}
                onValueChange={(value) => updateParams({ bidder: value, page: "1" })}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Bidder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All bidders</SelectItem>
                  {filters.bidders.map((bidder) => (
                    <SelectItem key={bidder.id} value={bidder.id}>
                      {bidder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canFilter && filters.workspaces.length > 0 && (
              <Select
                value={workspaceId}
                onValueChange={(value) => updateParams({ workspace: value, page: "1" })}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All workspaces</SelectItem>
                  {filters.workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              type="date"
              placeholder="From"
              value={dateFrom}
              onChange={(e) => updateParams({ dateFrom: e.target.value, page: "1" })}
              className="w-[140px]"
            />
            <Input
              type="date"
              placeholder="To"
              value={dateTo}
              onChange={(e) => updateParams({ dateTo: e.target.value, page: "1" })}
              className="w-[140px]"
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    onClick={() => handleSort("appliedAt")}
                  >
                    Applied
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    onClick={() => handleSort("company")}
                  >
                    Company
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Title</TableHead>
                {canFilter && <TableHead>Bidder</TableHead>}
                {canFilter && <TableHead>Workspace</TableHead>}
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead className="hidden lg:table-cell">Link</TableHead>
                <TableHead className="hidden lg:table-cell">Resume</TableHead>
                <TableHead className="hidden xl:table-cell">Notes</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(canFilter ? 12 : 10)].map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : applications.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canFilter ? 12 : 10}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No applications found. Add your first one!
                  </TableCell>
                </TableRow>
              ) : (
                applications.map((app) => (
                  <TableRow
                    key={app._id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      isOverdue(app) && "bg-destructive/5",
                    )}
                    onClick={() => onEdit(app._id)}
                  >
                    <TableCell className="text-sm">
                      {new Date(app.appliedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{app.company}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{app.title}</TableCell>
                    {canFilter && (
                      <TableCell className="text-sm">{app.bidderName || "—"}</TableCell>
                    )}
                    {canFilter && (
                      <TableCell className="text-sm">{app.workspaceName || "—"}</TableCell>
                    )}
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {app.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", getStatusColor(app.status))}
                      >
                        {app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.followUpAt ? (
                        <div className="flex items-center gap-1">
                          {isOverdue(app) && <AlertCircle className="h-3 w-3 text-destructive" />}
                          <span className={cn(isOverdue(app) && "text-destructive")}>
                            {new Date(app.followUpAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {app.link ? (
                        <a
                          href={app.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {app.resume ? (
                        <a
                          href={app.resume}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                          title="Download resume"
                        >
                          <FileDown className="h-4 w-4" />
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-[150px] truncate text-sm text-muted-foreground xl:table-cell">
                      {app.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onEdit(app._id)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                await copyRecordLink("application", app._id)
                                toast.success("Link copied")
                              } catch {
                                toast.error("Could not copy the link")
                              }
                            }}
                          >
                            <Link2 className="mr-2 h-4 w-4" />
                            Copy link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteId(app._id)
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, totalCount)} of{" "}
              {totalCount} applications
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title="Delete application?"
        description="This application will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </Card>
  )
}
