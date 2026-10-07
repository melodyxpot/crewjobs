"use client"

import { useEffect, useState } from "react"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { ApplicationsChart } from "@/components/dashboard/applications-chart"
import { DashboardActions } from "@/components/dashboard/dashboard-actions"
import { apiGetDashboardStats, apiGetChartData } from "@/lib/api"
import type { DashboardStats as DashboardStatsType, ChartDataPoint } from "@/lib/types"

export default function DashboardPage() {
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
        <p className="text-muted-foreground">Track your job application progress</p>
      </div>
      <DashboardActions />
      <DashboardStats stats={stats} />
      <ApplicationsChart data={chartData} />
    </div>
  )
}
