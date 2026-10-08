"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { WorkspaceProfile } from "@/components/workspace/workspace-profile"
import {
  apiCreateWorkspace,
  apiDeleteWorkspace,
  apiGetUsers,
  apiGetWorkspaces,
  apiUpdateWorkspaceMembers,
} from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"

type Person = {
  _id?: string
  id?: string
  email: string
  username?: string
  name?: string
  role: string
}

function personId(person: Person | string) {
  if (typeof person === "string") return person
  const id = person._id || person.id || ""
  return typeof id === "string" ? id : String(id)
}

function personLabel(person: Person) {
  return person.username || person.name || person.email
}

export default function WorkspacesPage() {
  const { user } = useAuth()
  const canManage = !!user?.isSuperAdmin || user?.role === "leader" || user?.role === "moderator"
  const isAssignee = !canManage && (user?.role === "bidder" || user?.role === "caller")
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [directory, setDirectory] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [bidderIds, setBidderIds] = useState<string[]>([])
  const [callerIds, setCallerIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selected = workspaces.find((workspace) => workspace._id === selectedId) || null

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch workspaces once
  }, [])

  useEffect(() => {
    if (!selected) return
    setBidderIds((selected.bidderIds || []).map(personId))
    setCallerIds((selected.callerIds || []).map(personId))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync the form when the selection id changes
  }, [selected?._id])

  async function load() {
    setLoading(true)
    try {
      const { workspaces: next } = await apiGetWorkspaces()
      setWorkspaces(next)
      setSelectedId((current) => current || next[0]?._id || null)
      if (canManage) {
        const { users } = await apiGetUsers({ status: "approved" })
        setDirectory(users)
      }
    } catch (error: any) {
      toast.error(error.message)
    }
    setLoading(false)
  }

  const bidderHome = useMemo(() => {
    const map = new Map<string, string>()
    for (const workspace of workspaces) {
      for (const bidder of workspace.bidderIds || []) {
        map.set(personId(bidder), workspace._id)
      }
    }
    return map
  }, [workspaces])

  const callerHomes = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>()
    for (const workspace of workspaces) {
      for (const caller of workspace.callerIds || []) {
        const id = personId(caller)
        const list = map.get(id) || []
        list.push({ id: workspace._id, name: workspace.name })
        map.set(id, list)
      }
    }
    return map
  }, [workspaces])

  const bidders = directory.filter((person) => person.role === "bidder")
  const callers = directory.filter((person) => person.role === "caller")

  async function createWorkspace() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const { workspace } = await apiCreateWorkspace(name.trim())
      setWorkspaces((current) =>
        [...current, workspace].sort((a, b) => a.name.localeCompare(b.name)),
      )
      setSelectedId(workspace._id)
      setName("")
      toast.success("Workspace created")
    } catch (error: any) {
      toast.error(error.message)
    }
    setSaving(false)
  }

  async function saveMembers() {
    if (!selected) return
    setSaving(true)
    try {
      const { workspace } = await apiUpdateWorkspaceMembers(selected._id, bidderIds, callerIds)
      setWorkspaces((current) =>
        current.map((item) => (item._id === workspace._id ? workspace : item)),
      )
      toast.success("Assignments saved")
    } catch (error: any) {
      toast.error(error.message)
    }
    setSaving(false)
  }

  async function removeWorkspace() {
    if (!selected) return
    try {
      await apiDeleteWorkspace(selected._id)
      const next = workspaces.filter((workspace) => workspace._id !== selected._id)
      setWorkspaces(next)
      setSelectedId(next[0]?._id || null)
      setConfirmDelete(false)
      toast.success("Workspace deleted")
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isAssignee && selected ? selected.name : "Workspaces"}
        </h1>
        {!isAssignee && (
          <p className="text-sm text-muted-foreground">
            Each workspace is a candidate profile. A bidder belongs to one workspace. A caller can
            belong to several. Leaders and moderators edit the profile and assignments.
          </p>
        )}
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>New workspace</CardTitle>
            <CardDescription>
              The name you enter becomes the profile name. You can refine it after the resume is
              parsed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="Profile name, for example Dajour Walker"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={createWorkspace} disabled={saving || !name.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </CardContent>
        </Card>
      )}

      {workspaces.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No workspaces yet.
          </CardContent>
        </Card>
      ) : (
        <div className={isAssignee ? "flex flex-col gap-6" : "grid gap-6 lg:grid-cols-[240px_1fr]"}>
          {!isAssignee && (
            <Card>
              <CardContent className="flex flex-col gap-1 p-3">
                {workspaces.map((workspace) => (
                  <Button
                    key={workspace._id}
                    variant={workspace._id === selectedId ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => setSelectedId(workspace._id)}
                  >
                    <span className="truncate">{workspace.name}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {selected && (
            <div className="flex flex-col gap-6">
              {isAssignee && workspaces.length > 1 && (
                <Select value={selected._id} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace._id} value={workspace._id}>
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!isAssignee && (
                <Card>
                  <CardHeader>
                    <CardTitle>{selected.name}</CardTitle>
                    <CardDescription>
                      {(selected.bidderIds || []).length} bidders ·{" "}
                      {(selected.callerIds || []).length} callers
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-6">
                    {canManage ? (
                      <>
                        <div className="grid gap-6 md:grid-cols-2">
                          <MemberChecklist
                            label="Bidders"
                            hint="One workspace each. A bidder already on another workspace stays there until you remove them."
                            people={bidders}
                            selected={bidderIds}
                            onChange={setBidderIds}
                            locked={(id) => {
                              const home = bidderHome.get(id)
                              if (!home || home === selected._id) return ""
                              const name =
                                workspaces.find((workspace) => workspace._id === home)?.name ||
                                "another workspace"
                              return `Already in ${name}`
                            }}
                            empty="No approved bidders yet."
                          />
                          <MemberChecklist
                            label="Callers"
                            hint="A caller can be assigned to several workspaces at the same time."
                            people={callers}
                            selected={callerIds}
                            onChange={setCallerIds}
                            note={(id) => {
                              const others = (callerHomes.get(id) || []).filter(
                                (workspace) => workspace.id !== selected._id,
                              )
                              return others.length
                                ? `Also in ${others.map((workspace) => workspace.name).join(", ")}`
                                : ""
                            }}
                            empty="No approved callers yet."
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={saveMembers} disabled={saving}>
                            {saving ? "Saving..." : "Save assignments"}
                          </Button>
                          <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        <AssignedList title="Bidders" people={selected.bidderIds || []} />
                        <AssignedList title="Callers" people={selected.callerIds || []} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <WorkspaceProfile
                key={selected._id}
                workspaceId={selected._id}
                canEdit={canManage}
                onWorkspaceRenamed={(nextName) => {
                  setWorkspaces((current) =>
                    current
                      .map((item) =>
                        item._id === selected._id ? { ...item, name: nextName } : item,
                      )
                      .sort((a, b) => a.name.localeCompare(b.name)),
                  )
                }}
              />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete workspace?"
        description={
          selected
            ? `Delete ${selected.name}? The profile and assignments for this workspace will be removed.`
            : "Delete this workspace?"
        }
        confirmLabel="Delete"
        destructive
        onConfirm={removeWorkspace}
      />
    </div>
  )
}

function AssignedList({ title, people }: { title: string; people: Person[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      {people.length === 0 && <p className="text-sm text-muted-foreground">None assigned</p>}
      {people.map((person) => (
        <p key={personId(person)} className="text-sm">
          {personLabel(person)}
        </p>
      ))}
    </div>
  )
}

function MemberChecklist({
  label,
  hint,
  people,
  selected,
  onChange,
  locked,
  note,
  empty,
}: {
  label: string
  hint: string
  people: Person[]
  selected: string[]
  onChange: (ids: string[]) => void
  locked?: (id: string) => string
  note?: (id: string) => string
  empty: string
}) {
  return (
    <div className="grid gap-2">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border p-2">
          {people.map((person) => {
            const id = personId(person)
            const lockReason = locked?.(id) || ""
            const extra = note?.(id) || ""
            const checked = selected.includes(id)
            return (
              <label
                key={id}
                className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm ${lockReason ? "opacity-60" : "cursor-pointer hover:bg-accent"}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={checked}
                  disabled={!!lockReason}
                  onChange={() => {
                    if (lockReason) return
                    onChange(checked ? selected.filter((item) => item !== id) : [...selected, id])
                  }}
                />
                <span>
                  <span className="block">{personLabel(person)}</span>
                  {(lockReason || extra) && (
                    <span className="block text-xs text-muted-foreground">
                      {lockReason || extra}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
