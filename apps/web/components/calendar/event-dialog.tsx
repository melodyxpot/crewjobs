"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { CopyRecordLink } from "@/components/copy-record-link"
import type { EventDraft, WorkspaceOption } from "@/components/calendar/types"

export function EventDialog({
  draft,
  canEdit,
  workspaces,
  saving,
  onOpenChange,
  onSave,
  onDelete,
}: {
  draft: EventDraft | null
  canEdit: boolean
  workspaces: WorkspaceOption[]
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (draft: EventDraft) => void
  onDelete: (id: string) => void
}) {
  return (
    <Dialog open={!!draft} onOpenChange={onOpenChange}>
      {draft && (
        <EventForm
          key={`${draft.id || "new"}-${draft.date}-${draft.startTime}`}
          draft={draft}
          canEdit={canEdit}
          workspaces={workspaces}
          saving={saving}
          onCancel={() => onOpenChange(false)}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </Dialog>
  )
}

function EventForm({
  draft,
  canEdit,
  workspaces,
  saving,
  onCancel,
  onSave,
  onDelete,
}: {
  draft: EventDraft
  canEdit: boolean
  workspaces: WorkspaceOption[]
  saving: boolean
  onCancel: () => void
  onSave: (draft: EventDraft) => void
  onDelete: (id: string) => void
}) {
  const [form, setForm] = useState(draft)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const knownWorkspace = workspaces.some((workspace) => workspace._id === form.workspaceId)

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {draft.id ? (canEdit ? "Edit event" : form.client || "Event") : "New event"}
        </DialogTitle>
        <DialogDescription>
          {canEdit
            ? "Leaders and moderators can add and edit events. Callers and bidders see events for their workspaces."
            : "You can view this event. Leaders and moderators can change it."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="event-workspace">Workspace</Label>
          {canEdit ? (
            <Select
              value={form.workspaceId}
              onValueChange={(workspaceId) => setForm({ ...form, workspaceId })}
            >
              <SelectTrigger id="event-workspace" className="w-full">
                <SelectValue placeholder="Choose a workspace" />
              </SelectTrigger>
              <SelectContent>
                {!knownWorkspace && form.workspaceId && (
                  <SelectItem value={form.workspaceId}>Current workspace</SelectItem>
                )}
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace._id} value={workspace._id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="event-workspace"
              value={
                workspaces.find((workspace) => workspace._id === form.workspaceId)?.name ||
                "Workspace"
              }
              disabled
            />
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="event-date">Date</Label>
            <Input
              id="event-date"
              type="date"
              value={form.date}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-start">Start</Label>
            <Input
              id="event-start"
              type="time"
              step={900}
              value={form.startTime}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, startTime: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-end">End</Label>
            <Input
              id="event-end"
              type="time"
              step={900}
              value={form.endTime}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, endTime: event.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave start and end empty for an all-day event.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="event-client">Client</Label>
          <Input
            id="event-client"
            value={form.client}
            disabled={!canEdit}
            placeholder="Client name"
            onChange={(event) => setForm({ ...form, client: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="event-details">More details</Label>
          <Textarea
            id="event-details"
            value={form.details}
            disabled={!canEdit}
            placeholder="Notes for the people on this workspace"
            onChange={(event) => setForm({ ...form, details: event.target.value })}
          />
        </div>
      </div>
      <DialogFooter>
        {draft.id ? (
          <div className="flex gap-2 sm:mr-auto">
            <CopyRecordLink kind="event" id={draft.id} />
            {canEdit ? (
              <Button variant="outline" disabled={saving} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : null}
          </div>
        ) : null}
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          {canEdit ? "Cancel" : "Close"}
        </Button>
        {canEdit && (
          <Button onClick={() => onSave(form)} disabled={saving || !form.workspaceId}>
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </DialogFooter>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete event?"
        description={`Delete the event for ${form.client || "this client"}? Callers and bidders will no longer see it.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (draft.id) onDelete(draft.id)
          setConfirmDelete(false)
        }}
      />
    </DialogContent>
  )
}
