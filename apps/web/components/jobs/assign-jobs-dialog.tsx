"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type WorkspaceOption = { _id: string; name: string }

export function AssignJobsDialog({
  open,
  jobCount,
  workspaces,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  jobCount: number
  workspaces: WorkspaceOption[]
  onOpenChange: (open: boolean) => void
  onConfirm: (workspaceIds: string[]) => Promise<void>
}) {
  const [checked, setChecked] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setChecked([])
  }, [open])

  const workspaceLabel = checked.length === 1 ? "workspace" : "workspaces"
  const jobLabel = jobCount === 1 ? "job" : "jobs"

  function toggle(id: string) {
    setChecked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign to workspaces</DialogTitle>
          <DialogDescription>
            {checked.length === 0
              ? `Choose one or more workspaces for ${jobCount} ${jobLabel}.`
              : `${jobCount} ${jobLabel} will be copied into ${checked.length} ${workspaceLabel}.`}
          </DialogDescription>
        </DialogHeader>
        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create a workspace before assigning jobs.</p>
        ) : (
          <div className="grid max-h-64 gap-2 overflow-y-auto">
            {workspaces.map((workspace) => (
              <label
                key={workspace._id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={checked.includes(workspace._id)}
                  onChange={() => toggle(workspace._id)}
                />
                <span className="text-sm font-medium">{workspace.name}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || checked.length === 0 || workspaces.length === 0}
            onClick={async () => {
              setSaving(true)
              try {
                await onConfirm(checked)
                onOpenChange(false)
              } catch {
                // The page shows the error toast.
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? "Assigning..." : "Assign jobs"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
