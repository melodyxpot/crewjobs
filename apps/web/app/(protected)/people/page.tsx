"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiApproveUser, apiGetUsers, apiRejectUser, apiUpdateUserRole } from "@/lib/api"
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/types"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function PeoplePage() {
  const { user } = useAuth()
  const canApprove = !!user?.isSuperAdmin || user?.role === "leader"
  const [pending, setPending] = useState<any[]>([])
  const [everyone, setEveryone] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (canApprove) load()
    else setLoading(false)
  }, [canApprove])

  async function load() {
    setLoading(true)
    try {
      const [pendingResult, allResult] = await Promise.all([
        apiGetUsers({ status: "pending" }),
        apiGetUsers({ status: "all" }),
      ])
      setPending(pendingResult.users)
      setEveryone(allResult.users)
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
      await apiUpdateUserRole(id, role)
      toast.success("Role updated")
      await load()
    } catch (error: any) {
      toast.error(error.message)
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
          New accounts stay pending until a leader approves them. The superadmin can change roles, including leader.
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
}: {
  users: any[]
  isSuperAdmin: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRole: (id: string, role: string) => void
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
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((person) => (
            <TableRow key={person.id}>
              <TableCell className="font-medium">
                {person.username}
                {person.isSuperAdmin && <Badge className="ml-2" variant="outline">Superadmin</Badge>}
              </TableCell>
              <TableCell>{person.email}</TableCell>
              <TableCell>
                {isSuperAdmin && !person.isSuperAdmin ? (
                  <Select value={person.role} onValueChange={(role) => onRole(person.id, role)}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>{ROLE_LABELS[role as UserRole]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  ROLE_LABELS[person.role as UserRole] || person.role
                )}
              </TableCell>
              <TableCell><Badge variant="outline" className="capitalize">{person.status}</Badge></TableCell>
              <TableCell className="space-x-2 text-right">
                {person.status !== "approved" && !person.isSuperAdmin && (
                  <Button size="sm" onClick={() => onApprove(person.id)}>Approve</Button>
                )}
                {person.status !== "rejected" && !person.isSuperAdmin && (
                  <Button size="sm" variant="outline" onClick={() => onReject(person.id)}>Reject</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
