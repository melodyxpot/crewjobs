"use client"

import type { ReactNode } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Loader2, Trash2 } from "lucide-react"
import { CopyRecordLink } from "@/components/copy-record-link"

export const JOB_SOURCE_LABELS: Record<string, string> = {
  remoteok: "Remote OK",
  remotive: "Remotive",
  arbeitnow: "Arbeitnow",
  jobicy: "Jobicy",
  adzuna: "Adzuna",
  jsearch: "JSearch",
  themuse: "The Muse",
  manual: "Manual",
}

export type JobDetail = {
  _id: string
  company?: string
  title?: string
  link?: string | null
  platform?: string | null
  location?: string | null
  workLocation?: string | null
  jobType?: string | null
  notes?: string | null
  region?: string | null
  source?: string | null
  status?: string | null
  workspaceName?: string | null
  createdAt?: string | null
}

function display(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : "—"
}

function formatAdded(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export function JobDrawer({
  job,
  open,
  visited,
  canDelete,
  onOpenChange,
  onVisit,
  onDelete,
}: {
  job: JobDetail | null
  open: boolean
  visited: boolean
  canDelete: boolean
  onOpenChange: (open: boolean) => void
  onVisit: () => void
  onDelete: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md px-6">
        {!job ? (
          <>
            <SheetHeader className="px-0">
              <SheetTitle>Job</SheetTitle>
              <SheetDescription>Loading the job</SheetDescription>
            </SheetHeader>
            <div className="flex h-96 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="mb-2 px-0">
              <SheetTitle className="pr-8 text-xl">{job.title || "Job"}</SheetTitle>
              <SheetDescription>{job.company || "Unknown company"}</SheetDescription>
              <CopyRecordLink kind="job" id={job._id} className="mt-3 w-fit" />
            </SheetHeader>
            <div className="grid gap-4">
              <Detail label="Status">
                <Badge variant="outline" className="capitalize">
                  {job.status || "open"}
                </Badge>
              </Detail>
              <Detail label="Workspace">
                {job.workspaceName?.trim() ? job.workspaceName : "Unassigned"}
              </Detail>
              <Detail label="Region">
                {job.region ? <Badge variant="outline">{job.region}</Badge> : "—"}
              </Detail>
              <Detail label="Source">
                {JOB_SOURCE_LABELS[job.source || ""] || display(job.source)}
              </Detail>
              <Detail label="Platform">{display(job.platform)}</Detail>
              <Detail label="Location">{display(job.location)}</Detail>
              <Detail label="Work location">{display(job.workLocation)}</Detail>
              <Detail label="Job type">{display(job.jobType)}</Detail>
              <Detail label="Added">{formatAdded(job.createdAt)}</Detail>
              <Detail label="Notes">
                <p className="whitespace-pre-wrap break-words">{display(job.notes)}</p>
              </Detail>
              <Detail label="Link">
                {job.link ? (
                  <a
                    href={job.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onVisit}
                    onAuxClick={onVisit}
                    className={
                      visited
                        ? "inline-flex items-center gap-2 break-all text-violet-700 underline dark:text-violet-300"
                        : "inline-flex items-center gap-2 break-all text-primary underline"
                    }
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    {job.link}
                  </a>
                ) : (
                  "—"
                )}
              </Detail>
            </div>
            {canDelete && (
              <SheetFooter className="mt-6 px-0">
                <Button variant="destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                  Delete job
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
