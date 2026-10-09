"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  apiCreateApplication,
  apiUpdateApplication,
  apiGetApplication,
  apiGetWorkspaces,
} from "@/lib/api"
import { CopyRecordLink } from "@/components/copy-record-link"
import { jobApplicationSchema, type JobApplicationFormData } from "@/lib/validation"
import type { Settings } from "@/lib/types"
import {
  DEFAULT_STATUSES,
  DEFAULT_PLATFORMS,
  JOB_TYPES,
  LOCATIONS,
  WORK_LOCATIONS,
} from "@/lib/types"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

function toLocalDateTimeString(date: Date): string {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

function toLocalDateString(date: Date): string {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().split("T")[0]
}

interface ApplicationDrawerProps {
  open: boolean
  editId?: string
  settings: Settings | null
  onClose: () => void
  onSaved: () => void
}

export function ApplicationDrawer({
  open,
  editId,
  settings,
  onClose,
  onSaved,
}: ApplicationDrawerProps) {
  const { user } = useAuth()
  const picksWorkspace = !!user && user.role !== "bidder"
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [workspaces, setWorkspaces] = useState<{ _id: string; name: string }[]>([])
  const [workspaceId, setWorkspaceId] = useState("")

  const defaultPlatform = settings?.defaultPlatform || "LinkedIn"
  const defaultStatus = settings?.defaultStatus || "Applied"
  const defaultLocation = settings?.locationOptions?.[0] || "US"
  const followUpOffsetDays = settings?.followUpOffsetDays || 7
  const platforms = settings?.platformOptions || DEFAULT_PLATFORMS

  const getDefaultFollowUp = (appliedAt: string) => {
    const date = new Date(appliedAt)
    date.setDate(date.getDate() + followUpOffsetDays)
    return date.toISOString().split("T")[0]
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<JobApplicationFormData>({
    resolver: zodResolver(jobApplicationSchema),
    mode: "onBlur",
    defaultValues: {
      company: "",
      title: "",
      link: "",
      platform: defaultPlatform,
      status: defaultStatus,
      appliedAt: toLocalDateTimeString(new Date()),
      followUpAt: getDefaultFollowUp(new Date().toISOString()),
      location: defaultLocation,
      workLocation: "Remote",
      jobType: "",
      notes: "",
    },
  })

  const appliedAt = watch("appliedAt")

  useEffect(() => {
    if (!editId && appliedAt) {
      setValue("followUpAt", getDefaultFollowUp(appliedAt))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getDefaultFollowUp is derived from settings already in scope
  }, [appliedAt, editId, setValue])

  useEffect(() => {
    if (editId && open) {
      setIsFetching(true)
      apiGetApplication(editId)
        .then((result) => {
          if (result.data) {
            const app = result.data
            reset({
              company: app.company,
              title: app.title,
              link: app.link || "",
              platform: app.platform,
              status: app.status,
              appliedAt: toLocalDateTimeString(new Date(app.appliedAt)),
              followUpAt: app.followUpAt ? toLocalDateString(new Date(app.followUpAt)) : "",
              location: app.location || "",
              workLocation: app.workLocation || "Remote",
              jobType: app.jobType || "",
              notes: app.notes || "",
            })
            setWorkspaceId(app.workspaceId || "")
          }
          setIsFetching(false)
        })
        .catch(() => setIsFetching(false))
    } else if (!editId && open) {
      reset({
        company: "",
        title: "",
        link: "",
        platform: defaultPlatform,
        status: defaultStatus,
        appliedAt: toLocalDateTimeString(new Date()),
        followUpAt: getDefaultFollowUp(new Date().toISOString()),
        location: defaultLocation,
        workLocation: "Remote",
        jobType: "",
        notes: "",
      })
      setWorkspaceId("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getDefaultFollowUp is derived from settings already listed
  }, [editId, open, reset, defaultPlatform, defaultStatus, defaultLocation])

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

  useEffect(() => {
    if (open && !editId) {
      setTimeout(() => {
        const companyInput = document.getElementById("company") as HTMLInputElement
        companyInput?.focus()
      }, 100)
    }
  }, [open, editId])

  const handleClose = (saved = false) => {
    reset()
    onClose()
    if (saved) onSaved()
  }

  const onSubmit = async (data: JobApplicationFormData, addAnother = false) => {
    setIsLoading(true)

    if (picksWorkspace && workspaces.length > 1 && !workspaceId) {
      toast.error("Choose a workspace")
      setIsLoading(false)
      return
    }

    const applicationData = {
      company: data.company,
      title: data.title,
      link: data.link || null,
      platform: data.platform,
      status: data.status,
      appliedAt: new Date(data.appliedAt).toISOString(),
      followUpAt: data.followUpAt ? new Date(data.followUpAt).toISOString() : null,
      location: data.location || null,
      workLocation: data.workLocation || null,
      jobType: data.jobType || null,
      notes: data.notes || null,
      ...(picksWorkspace && workspaceId ? { workspaceId } : {}),
    }

    try {
      if (editId) {
        await apiUpdateApplication(editId, applicationData)
        toast.success("Application updated")
        handleClose(true)
      } else {
        await apiCreateApplication(applicationData)
        toast.success("Application added")
        if (addAnother) {
          onSaved()
          reset({
            company: "",
            title: "",
            link: "",
            platform: defaultPlatform,
            status: defaultStatus,
            appliedAt: toLocalDateTimeString(new Date()),
            followUpAt: getDefaultFollowUp(new Date().toISOString()),
            location: defaultLocation,
            workLocation: "Remote",
            jobType: "",
            notes: "",
          })
          setTimeout(() => {
            const companyInput = document.getElementById("company") as HTMLInputElement
            companyInput?.focus()
          }, 100)
        } else {
          handleClose(true)
        }
      }
    } catch (err: any) {
      toast.error(err.message)
    }

    setIsLoading(false)
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg px-6">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-bold">
            {editId ? "Edit Application" : "Add Application"}
          </SheetTitle>
          <SheetDescription className="text-base">
            {editId ? "Update the details of your job application" : "Track a new job application"}
          </SheetDescription>
          {editId ? <CopyRecordLink kind="application" id={editId} className="mt-3 w-fit" /> : null}
        </SheetHeader>

        {isFetching ? (
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit((data) => onSubmit(data, false))}
            className="flex flex-col gap-5"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSubmit((data) => onSubmit(data, false))()
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="company" className="font-semibold text-foreground">
                Company <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company"
                placeholder="e.g., Google"
                {...register("company")}
                className={`h-10 ${errors.company ? "border-destructive" : ""}`}
              />
              {errors.company && (
                <p className="text-xs text-destructive font-medium">{errors.company.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title" className="font-semibold text-foreground">
                Job Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Senior Software Engineer"
                {...register("title")}
                className={`h-10 ${errors.title ? "border-destructive" : ""}`}
              />
              {errors.title && (
                <p className="text-xs text-destructive font-medium">{errors.title.message}</p>
              )}
            </div>

            {picksWorkspace && workspaces.length > 0 && (
              <div className="space-y-1.5">
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

            <div className="space-y-1.5">
              <Label htmlFor="link" className="font-semibold text-foreground">
                Job Link
              </Label>
              <Input
                id="link"
                type="url"
                placeholder="https://..."
                {...register("link")}
                className={`h-10 ${errors.link ? "border-destructive" : ""}`}
              />
              {errors.link && (
                <p className="text-xs text-destructive font-medium">{errors.link.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="platform" className="font-semibold text-foreground">
                  Platform
                </Label>
                <Select
                  value={watch("platform")}
                  onValueChange={(value) => setValue("platform", value)}
                >
                  <SelectTrigger className={`h-10 ${errors.platform ? "border-destructive" : ""}`}>
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
              <div className="space-y-1.5">
                <Label htmlFor="status" className="font-semibold text-foreground">
                  Status
                </Label>
                <Select
                  value={watch("status")}
                  onValueChange={(value) => setValue("status", value)}
                >
                  <SelectTrigger className={`h-10 ${errors.status ? "border-destructive" : ""}`}>
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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="jobType" className="font-semibold text-foreground">
                  Job Type
                </Label>
                <Select
                  value={watch("jobType") || ""}
                  onValueChange={(value) => setValue("jobType", value)}
                >
                  <SelectTrigger className={`h-10 ${errors.jobType ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location" className="font-semibold text-foreground">
                  Location
                </Label>
                <Select
                  value={watch("location") || ""}
                  onValueChange={(value) => setValue("location", value)}
                >
                  <SelectTrigger className={`h-10 ${errors.location ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workLocation" className="font-semibold text-foreground">
                  Work Location
                </Label>
                <Select
                  value={watch("workLocation") || ""}
                  onValueChange={(value) => setValue("workLocation", value)}
                >
                  <SelectTrigger
                    className={`h-10 ${errors.workLocation ? "border-destructive" : ""}`}
                  >
                    <SelectValue placeholder="Select work location" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_LOCATIONS.map((w) => (
                      <SelectItem key={w} value={w}>
                        {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="appliedAt" className="font-semibold text-foreground">
                  Applied Date
                </Label>
                <Input
                  id="appliedAt"
                  type="datetime-local"
                  {...register("appliedAt")}
                  className={`h-10 ${errors.appliedAt ? "border-destructive" : ""}`}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="followUpAt" className="font-semibold text-foreground">
                  Follow-up Date
                </Label>
                <Input
                  id="followUpAt"
                  type="date"
                  {...register("followUpAt")}
                  className={`h-10 ${errors.followUpAt ? "border-destructive" : ""}`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="font-semibold text-foreground">
                Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes..."
                rows={4}
                {...register("notes")}
                className={`resize-none ${errors.notes ? "border-destructive" : ""}`}
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={isLoading} className="flex-1 h-10 font-semibold">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Application
              </Button>
              {!editId && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={handleSubmit((data) => onSubmit(data, true))}
                  className="flex-1 h-10 font-semibold"
                >
                  Save + Add Another
                </Button>
              )}
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
