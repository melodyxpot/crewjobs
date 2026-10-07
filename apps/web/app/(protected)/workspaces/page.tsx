"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  apiCreateWorkspace,
  apiDeleteWorkspace,
  apiGetUsers,
  apiGetWorkspaces,
  apiUpdateWorkspace,
  apiUpdateWorkspaceMembers,
} from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"

type Person = {
  _id: string
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
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [directory, setDirectory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [rename, setRename] = useState("")
  const [bidderIds, setBidderIds] = useState<string[]>([])
  const [callerIds, setCallerIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const selected = workspaces.find((workspace) => workspace._id === selectedId) || null

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch workspaces once
  }, [])

  useEffect(() => {
    if (!selected) return
    setRename(selected.name)
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

  const bidders = directory.filter((person) => person.role === "bidder")
  const callers = directory.filter((person) => person.role === "caller")

  function toggle(list: string[], id: string, setList: (ids: string[]) => void) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id])
  }

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

  async function saveWorkspace() {
    if (!selected) return
    setSaving(true)
    try {
      if (rename.trim() && rename.trim() !== selected.name) {
        await apiUpdateWorkspace(selected._id, rename.trim())
      }
      const { workspace } = await apiUpdateWorkspaceMembers(selected._id, bidderIds, callerIds)
      setWorkspaces((current) =>
        current.map((item) => (item._id === workspace._id ? workspace : item)),
      )
      toast.success("Workspace saved")
    } catch (error: any) {
      toast.error(error.message)
    }
    setSaving(false)
  }

  async function removeWorkspace() {
    if (!selected || !confirm(`Delete ${selected.name}?`)) return
    try {
      await apiDeleteWorkspace(selected._id)
      const next = workspaces.filter((workspace) => workspace._id !== selected._id)
      setWorkspaces(next)
      setSelectedId(next[0]?._id || null)
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
        <h1 className="text-2xl font-bold">Workspaces</h1>
        <p className="text-sm text-muted-foreground">
          Leaders and moderators group bidders and callers here. A bidder belongs to one workspace.
          A caller can belong to several. Bid logs and remote jobs are stored on the workspace.
        </p>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>New workspace</CardTitle>
            <CardDescription>
              Create a workspace, then assign the people who work in it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="Workspace name"
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
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
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

          {selected && (
            <Card>
              <CardHeader>
                <CardTitle>{selected.name}</CardTitle>
                <CardDescription>
                  {(selected.bidderIds || []).length} bidders · {(selected.callerIds || []).length}{" "}
                  callers
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                {canManage ? (
                  <>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Name</label>
                      <Input value={rename} onChange={(e) => setRename(e.target.value)} />
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <h2 className="mb-2 text-sm font-medium">Bidders</h2>
                        <div className="flex max-h-72 flex-col gap-2 overflow-auto rounded-md border p-3">
                          {bidders.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              No approved bidders yet.
                            </p>
                          )}
                          {bidders.map((bidder) => {
                            const id = bidder.id
                            const home = bidderHome.get(id)
                            const blocked = !!home && home !== selected._id
                            return (
                              <label key={id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={bidderIds.includes(id)}
                                  disabled={blocked}
                                  onChange={() => toggle(bidderIds, id, setBidderIds)}
                                />
                                <span>{bidder.username || bidder.name || bidder.email}</span>
                                {blocked && <Badge variant="outline">In another workspace</Badge>}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <h2 className="mb-2 text-sm font-medium">Callers</h2>
                        <div className="flex max-h-72 flex-col gap-2 overflow-auto rounded-md border p-3">
                          {callers.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              No approved callers yet.
                            </p>
                          )}
                          {callers.map((caller) => (
                            <label key={caller.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={callerIds.includes(caller.id)}
                                onChange={() => toggle(callerIds, caller.id, setCallerIds)}
                              />
                              <span>{caller.username || caller.name || caller.email}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={saveWorkspace} disabled={saving}>
                        {saving ? "Saving..." : "Save workspace"}
                      </Button>
                      <Button variant="outline" onClick={removeWorkspace}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h2 className="mb-2 text-sm font-medium">Bidders</h2>
                      {(selected.bidderIds || []).map((bidder: Person) => (
                        <p key={personId(bidder)} className="text-sm">
                          {personLabel(bidder)}
                        </p>
                      ))}
                      {(selected.bidderIds || []).length === 0 && (
                        <p className="text-sm text-muted-foreground">None assigned</p>
                      )}
                    </div>
                    <div>
                      <h2 className="mb-2 text-sm font-medium">Callers</h2>
                      {(selected.callerIds || []).map((caller: Person) => (
                        <p key={personId(caller)} className="text-sm">
                          {personLabel(caller)}
                        </p>
                      ))}
                      {(selected.callerIds || []).length === 0 && (
                        <p className="text-sm text-muted-foreground">None assigned</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
