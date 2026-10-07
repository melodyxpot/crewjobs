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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import {
  apiGetTeams,
  apiCreateTeam,
  apiGetTeam,
  apiDeleteTeam,
  apiAddTeamMember,
  apiChangeTeamRole,
  apiRemoveTeamMember,
  apiLeaveTeam,
  apiGetTeamDashboard,
  apiGetTeamApplications,
} from "@/lib/api"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, UserPlus, Crown, LogOut, ArrowUpDown, Search, X } from "lucide-react"

const COLORS = [
  "#4ade80",
  "#67e8f9",
  "#a78bfa",
  "#fb923c",
  "#f472b6",
  "#facc15",
  "#34d399",
  "#60a5fa",
]

export default function TeamPage() {
  const { user } = useAuth()
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [newTeamName, setNewTeamName] = useState("")
  const [creating, setCreating] = useState(false)

  // Team dashboard state
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [dashLoading, setDashLoading] = useState(false)

  // Team applications state
  const [teamApps, setTeamApps] = useState<any[]>([])
  const [teamAppsCount, setTeamAppsCount] = useState(0)
  const [appsLoading, setAppsLoading] = useState(false)
  const [appsPage, setAppsPage] = useState(1)
  const [appsSearch, setAppsSearch] = useState("")
  const [appsMember, setAppsMember] = useState("")

  // Add member state
  const [addEmail, setAddEmail] = useState("")
  const [addRole, setAddRole] = useState("member")
  const [adding, setAdding] = useState(false)

  const isLeader = selectedTeam?.members?.some(
    (m: any) => (m.userId?._id || m.userId) === user?.id && m.role === "leader"
  )

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    if (selectedTeam && isLeader) {
      loadDashboard()
      loadApplications()
    }
  }, [selectedTeam?._id, isLeader])

  useEffect(() => {
    if (selectedTeam && isLeader) {
      loadApplications()
    }
  }, [appsPage, appsSearch, appsMember])

  async function loadTeams() {
    try {
      const { teams: t } = await apiGetTeams()
      setTeams(t)
      if (t.length > 0 && !selectedTeam) {
        setSelectedTeam(t[0])
      }
    } catch {}
    setLoading(false)
  }

  async function loadDashboard() {
    if (!selectedTeam) return
    setDashLoading(true)
    try {
      const data = await apiGetTeamDashboard(selectedTeam._id, 14)
      setDashboardData(data)
    } catch {}
    setDashLoading(false)
  }

  async function loadApplications() {
    if (!selectedTeam) return
    setAppsLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(appsPage),
        pageSize: "20",
      }
      if (appsSearch) params.search = appsSearch
      if (appsMember) params.memberId = appsMember
      const result = await apiGetTeamApplications(selectedTeam._id, params)
      setTeamApps(result.data)
      setTeamAppsCount(result.count)
    } catch {}
    setAppsLoading(false)
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return
    setCreating(true)
    try {
      const { team } = await apiCreateTeam(newTeamName.trim())
      setTeams(prev => [...prev, team])
      setSelectedTeam(team)
      setNewTeamName("")
      toast.success("Team created")
    } catch (err: any) {
      toast.error(err.message)
    }
    setCreating(false)
  }

  async function handleDeleteTeam() {
    if (!selectedTeam || !confirm("Are you sure you want to delete this team?")) return
    try {
      await apiDeleteTeam(selectedTeam._id)
      setTeams(prev => prev.filter(t => t._id !== selectedTeam._id))
      setSelectedTeam(teams.length > 1 ? teams.find(t => t._id !== selectedTeam._id) : null)
      setDashboardData(null)
      toast.success("Team deleted")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleAddMember() {
    if (!addEmail.trim() || !selectedTeam) return
    setAdding(true)
    try {
      const { team } = await apiAddTeamMember(selectedTeam._id, addEmail.trim(), addRole)
      setSelectedTeam(team)
      setTeams(prev => prev.map(t => t._id === team._id ? team : t))
      setAddEmail("")
      toast.success("Member added")
    } catch (err: any) {
      toast.error(err.message)
    }
    setAdding(false)
  }

  async function handleChangeRole(userId: string, role: string) {
    if (!selectedTeam) return
    try {
      const { team } = await apiChangeTeamRole(selectedTeam._id, userId, role)
      setSelectedTeam(team)
      setTeams(prev => prev.map(t => t._id === team._id ? team : t))
      toast.success("Role updated")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedTeam || !confirm("Remove this member?")) return
    try {
      const { team } = await apiRemoveTeamMember(selectedTeam._id, userId)
      setSelectedTeam(team)
      setTeams(prev => prev.map(t => t._id === team._id ? team : t))
      toast.success("Member removed")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleLeave() {
    if (!selectedTeam || !confirm("Leave this team?")) return
    try {
      await apiLeaveTeam(selectedTeam._id)
      setTeams(prev => prev.filter(t => t._id !== selectedTeam._id))
      setSelectedTeam(null)
      setDashboardData(null)
      toast.success("Left team")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalAppsPages = Math.ceil(teamAppsCount / 20)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <p className="text-muted-foreground">Create and manage your team, view team analytics</p>
      </div>

      {/* Create team + team selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-2">
          <Input
            placeholder="New team name..."
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreateTeam() }}
            className="w-[200px]"
          />
          <Button onClick={handleCreateTeam} disabled={creating || !newTeamName.trim()} size="sm">
            {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Create
          </Button>
        </div>

        {teams.length > 0 && (
          <Select
            value={selectedTeam?._id || ""}
            onValueChange={id => {
              const t = teams.find(t => t._id === id)
              setSelectedTeam(t)
              setDashboardData(null)
              setTeamApps([])
              setAppsPage(1)
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map(t => (
                <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedTeam && teams.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No teams yet. Create one to get started.
          </CardContent>
        </Card>
      )}

      {selectedTeam && (
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            {isLeader && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}
            {isLeader && <TabsTrigger value="applications">Applications</TabsTrigger>}
          </TabsList>

          {/* ===== MEMBERS TAB ===== */}
          <TabsContent value="members">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{selectedTeam.name}</CardTitle>
                  <CardDescription>{selectedTeam.members?.length || 0} members</CardDescription>
                </div>
                <div className="flex gap-2">
                  {!isLeader && (
                    <Button variant="outline" size="sm" onClick={handleLeave}>
                      <LogOut className="mr-1 h-4 w-4" /> Leave
                    </Button>
                  )}
                  {isLeader && (
                    <Button variant="outline" size="sm" onClick={handleDeleteTeam} className="text-destructive hover:text-destructive">
                      <Trash2 className="mr-1 h-4 w-4" /> Delete Team
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add member (leader only) */}
                {isLeader && (
                  <div className="flex flex-wrap items-end gap-3 pb-4 border-b">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input
                        placeholder="user@example.com"
                        value={addEmail}
                        onChange={e => setAddEmail(e.target.value)}
                        className="w-[240px]"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Role</Label>
                      <Select value={addRole} onValueChange={setAddRole}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="leader">Leader</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddMember} disabled={adding || !addEmail.trim()} size="sm">
                      {adding ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />}
                      Add
                    </Button>
                  </div>
                )}

                {/* Members table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      {isLeader && <TableHead className="w-[100px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTeam.members?.map((m: any) => {
                      const uid = m.userId?._id || m.userId
                      const email = m.userId?.email || ""
                      const name = m.userId?.name || email
                      const isSelf = uid === user?.id
                      return (
                        <TableRow key={uid}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{name}</p>
                              <p className="text-xs text-muted-foreground">{email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isLeader && !isSelf ? (
                              <Select value={m.role} onValueChange={v => handleChangeRole(uid, v)}>
                                <SelectTrigger className="w-[110px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="leader">Leader</SelectItem>
                                  <SelectItem value="member">Member</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={m.role === "leader" ? "default" : "secondary"}>
                                {m.role === "leader" && <Crown className="mr-1 h-3 w-3" />}
                                {m.role}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(m.joinedAt).toLocaleDateString()}
                          </TableCell>
                          {isLeader && (
                            <TableCell>
                              {!isSelf && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveMember(uid)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== DASHBOARD TAB (leader only) ===== */}
          {isLeader && (
            <TabsContent value="dashboard">
              {dashLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : dashboardData ? (
                <div className="space-y-6">
                  {/* Monthly stats cards */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {dashboardData.memberStats?.map((m: any) => (
                      <Card key={m.userId}>
                        <CardHeader className="pb-2">
                          <CardDescription className="truncate">{m.name || m.email}</CardDescription>
                          <CardTitle className="text-2xl">{m.monthlyCount}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">applications this month</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Comparison chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Applications by Member</CardTitle>
                      <CardDescription>Last 14 days — comparing team members</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dashboardData.chartData?.map((d: any) => ({
                            ...d,
                            label: new Date(d.date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" }),
                          }))}>
                            <defs>
                              {dashboardData.memberNames?.map((name: string, i: number) => (
                                <linearGradient key={name} id={`teamGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.4} />
                                  <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.05} />
                                </linearGradient>
                              ))}
                            </defs>
                            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "var(--radius)",
                                color: "hsl(var(--foreground))",
                              }}
                              labelStyle={{ color: "hsl(var(--foreground))" }}
                              itemStyle={{ color: "hsl(var(--foreground))" }}
                            />
                            <Legend />
                            {dashboardData.memberNames?.map((name: string, i: number) => (
                              <Area
                                key={name}
                                type="monotone"
                                dataKey={name}
                                stroke={COLORS[i % COLORS.length]}
                                strokeWidth={2}
                                fill={`url(#teamGrad-${i})`}
                              />
                            ))}
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>
          )}

          {/* ===== APPLICATIONS TAB (leader only) ===== */}
          {isLeader && (
            <TabsContent value="applications">
              <Card>
                <CardHeader>
                  <CardTitle>Team Applications</CardTitle>
                  <CardDescription>All applications submitted by team members</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search company or title..."
                        value={appsSearch}
                        onChange={e => { setAppsSearch(e.target.value); setAppsPage(1) }}
                        className="pl-9"
                      />
                    </div>
                    <Select value={appsMember} onValueChange={v => { setAppsMember(v === "all" ? "" : v); setAppsPage(1) }}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="All members" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Members</SelectItem>
                        {selectedTeam.members?.map((m: any) => {
                          const uid = m.userId?._id || m.userId
                          const label = m.userId?.name || m.userId?.email || uid
                          return <SelectItem key={uid} value={uid}>{label}</SelectItem>
                        })}
                      </SelectContent>
                    </Select>
                    {(appsSearch || appsMember) && (
                      <Button variant="ghost" size="sm" onClick={() => { setAppsSearch(""); setAppsMember(""); setAppsPage(1) }}>
                        <X className="mr-1 h-4 w-4" /> Clear
                      </Button>
                    )}
                  </div>

                  {/* Table */}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Platform</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appsLoading ? (
                          [...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                              {[...Array(6)].map((_, j) => (
                                <TableCell key={j}><div className="h-4 w-full animate-pulse rounded bg-muted" /></TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : teamApps.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                              No applications found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          teamApps.map((app: any) => (
                            <TableRow key={app._id}>
                              <TableCell>
                                <div>
                                  <p className="text-sm font-medium truncate max-w-[120px]">{app.memberName}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(app.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                              </TableCell>
                              <TableCell className="font-medium">{app.company}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{app.title}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{app.platform}</Badge></TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{app.status}</Badge></TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalAppsPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {appsPage} of {totalAppsPages} ({teamAppsCount} total)
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={appsPage <= 1} onClick={() => setAppsPage(p => p - 1)}>Previous</Button>
                        <Button variant="outline" size="sm" disabled={appsPage >= totalAppsPages} onClick={() => setAppsPage(p => p + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  )
}
