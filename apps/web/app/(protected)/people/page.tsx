"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  apiApproveUser,
  apiAssignUserWorkspaces,
  apiGetUsers,
  apiGetWorkspaces,
  apiRejectUser,
  apiUpdateUserRole,
} from "@/lib/api"
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/types"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

type WorkspaceRef = { id: string; name: string }
type DirectoryUser = {
  id: string
  email: string
  username?: string
  role: string
  status: string
  isSuperAdmin?: boolean
  workspaces?: WorkspaceRef[]
}

export default function PeoplePage() {
  const { user } = useAuth()
  const canApprove = !!user?.isSuperAdmin || user?.role === "leader"
  const [pending, setPending] = useState<DirectoryUser[]>([])
  const [everyone, setEveryone] = useState<DirectoryUser[]>([])
  const [workspaces, setWorkspaces] = useState<{ _id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (canApprove) load()
    else setLoading(false)
  }, [canApprove])

  async function load() {
    setLoading(true)
    try {
      const [pendingResult, allResult, workspaceResult] = await Promise.all([
        apiGetUsers({ status: "pending" }),
        apiGetUsers({ status: "all" }),
        apiGetWorkspaces(),
      ])
      setPending(pendingResult.users)
      setEveryone(allResult.users)
      setWorkspaces(workspaceResult.workspaces)
    } catch (error: any) {
      toast.error(error.message)
    }
    setLoading(false)
  }

  async function approve(id: string) {
    try {
      await apiApproveUser(id)
      toast.success("Account approved")
      await load()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function reject(id: string) {
    try {
      await apiRejectUser(id)
      toast.success("Account rejected")
      await load()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function changeRole(id: string, role: string) {
    try {
      const result = await apiUpdateUserRole(id, role)
      toast.success(result.assignmentNote || "Role updated")
      await load()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function assignWorkspaces(id: string, workspaceIds: string[]) {
    try {
      await apiAssignUserWorkspaces(id, workspaceIds)
      toast.success("Workspace assignments saved")
      await load()
    } catch (error: any) {
      toast.error(error.message)
      throw error
    }
  }

  if (!canApprove) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>People</CardTitle>
            <CardDescription>Only a leader can approve new accounts.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
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
        <h1 className="text-2xl font-bold">People</h1>
        <p className="text-sm text-muted-foreground">
          New accounts stay pending until a leader approves them. A bidder belongs to one workspace.
          A caller can belong to several. The superadmin can change roles, including leader.
        </p>
      </div>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="all">Everyone</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardContent className="p-6">
              <UserTable
                users={pending}
                isSuperAdmin={!!user?.isSuperAdmin}
                onApprove={approve}
                onReject={reject}
                onRole={changeRole}
                workspaces={workspaces}
                onAssign={assignWorkspaces}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="all">
          <Card>
            <CardContent className="p-6">
              <UserTable
                users={everyone}
                isSuperAdmin={!!user?.isSuperAdmin}
                onApprove={approve}
                onReject={reject}
                onRole={changeRole}
                workspaces={workspaces}
                onAssign={assignWorkspaces}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function UserTable({
  users,
  isSuperAdmin,
  onApprove,
  onReject,
  onRole,
  workspaces,
  onAssign,
}: {
  users: DirectoryUser[]
  isSuperAdmin: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRole: (id: string, role: string) => void
  workspaces: { _id: string; name: string }[]
  onAssign: (id: string, workspaceIds: string[]) => Promise<void>
}) {
  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">No accounts in this list.</p>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Workspaces</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((person) => (
            <TableRow key={person.id}>
              <TableCell className="font-medium">
                {person.username}
                {person.isSuperAdmin && (
                  <Badge className="ml-2" variant="outline">
                    Superadmin
                  </Badge>
                )}
              </TableCell>
              <TableCell>{person.email}</TableCell>
              <TableCell>
                {isSuperAdmin && !person.isSuperAdmin ? (
                  <Select value={person.role} onValueChange={(role) => onRole(person.id, role)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role as UserRole]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  ROLE_LABELS[person.role as UserRole] || person.role
                )}
              </TableCell>
              <TableCell>
                <WorkspaceAssignment person={person} workspaces={workspaces} onAssign={onAssign} />
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {person.status}
                </Badge>
              </TableCell>
              <TableCell className="space-x-2 text-right">
                {person.status !== "approved" && !person.isSuperAdmin && (
                  <Button size="sm" onClick={() => onApprove(person.id)}>
                    Approve
                  </Button>
                )}
                {person.status !== "rejected" && !person.isSuperAdmin && (
                  <Button size="sm" variant="outline" onClick={() => onReject(person.id)}>
                    Reject
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function WorkspaceAssignment({
  person,
  workspaces,
  onAssign,
}: {
  person: DirectoryUser
  workspaces: { _id: string; name: string }[]
  onAssign: (id: string, workspaceIds: string[]) => Promise<void>
}) {
  const assigned = person.workspaces || []
  const canAssign =
    person.status === "approved" && (person.role === "bidder" || person.role === "caller")

  if (!canAssign) {
    return (
      <span className="text-sm text-muted-foreground">
        {assigned.length ? assigned.map((workspace) => workspace.name).join(", ") : "—"}
      </span>
    )
  }

  if (person.role === "bidder") {
    return (
      <Select
        value={assigned[0]?.id || "none"}
        onValueChange={(value) => {
          void onAssign(person.id, value === "none" ? [] : [value])
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="No workspace" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No workspace</SelectItem>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace._id} value={workspace._id}>
              {workspace.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return <CallerWorkspaces person={person} workspaces={workspaces} onAssign={onAssign} />
}

function CallerWorkspaces({
  person,
  workspaces,
  onAssign,
}: {
  person: DirectoryUser
  workspaces: { _id: string; name: string }[]
  onAssign: (id: string, workspaceIds: string[]) => Promise<void>
}) {
  const assigned = person.workspaces || []
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const label = assigned.length
    ? assigned.map((workspace) => workspace.name).join(", ")
    : "Assign workspaces"

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="max-w-[220px]"
        onClick={() => {
          setSelected(assigned.map((workspace) => workspace.id))
          setOpen(true)
        }}
      >
        <span className="truncate">{label}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workspaces for {person.username || person.email}</DialogTitle>
            <DialogDescription>
              Callers can be assigned to several workspaces. They will see calendar events for each
              one.
            </DialogDescription>
          </DialogHeader>
          {workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a workspace first.</p>
          ) : (
            <div className="grid max-h-64 gap-1 overflow-y-auto">
              {workspaces.map((workspace) => {
                const checked = selected.includes(workspace._id)
                return (
                  <label
                    key={workspace._id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={checked}
                      onChange={() =>
                        setSelected((current) =>
                          checked
                            ? current.filter((id) => id !== workspace._id)
                            : [...current, workspace._id],
                        )
                      }
                    />
                    {workspace.name}
                  </label>
                )
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                try {
                  await onAssign(person.id, selected)
                  setOpen(false)
                } catch {
                  // The page shows the error toast.
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
