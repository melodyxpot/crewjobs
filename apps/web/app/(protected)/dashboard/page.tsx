"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { ApplicationsChart } from "@/components/dashboard/applications-chart"
import { apiGetDashboardStats, apiGetChartData } from "@/lib/api"
import type { DashboardStats as DashboardStatsType, ChartDataPoint } from "@/lib/types"

function dashboardSubtitle(role: string | undefined, isSuperAdmin: boolean | undefined) {
  if (isSuperAdmin || role === "leader" || role === "moderator") {
    return "Application and scraping activity across the team"
  }
  if (role === "bidder" || role === "developer") return "Your job application activity"
  if (role === "caller") return "Application activity in your workspaces"
  return "Application activity across the team"
}

export default function DashboardPage() {
  const { user } = useAuth()
  const includeScraped =
    !!user?.isSuperAdmin || user?.role === "leader" || user?.role === "moderator"
  const [stats, setStats] = useState<DashboardStatsType | null>(null)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])

  useEffect(() => {
    Promise.all([apiGetDashboardStats(), apiGetChartData(14)]).then(([statsRes, chartRes]) => {
      setStats(statsRes.stats)
      setChartData(chartRes.data)
    })
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">{dashboardSubtitle(user?.role, user?.isSuperAdmin)}</p>
      </div>
      <DashboardStats stats={stats} includeScraped={includeScraped} />
      <ApplicationsChart data={chartData} />
    </div>
  )
}
