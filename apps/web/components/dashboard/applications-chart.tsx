"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, Legend, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import type { ChartDataPoint } from "@/lib/types"

interface ApplicationsChartProps {
  data: ChartDataPoint[]
}

export function ApplicationsChart({ data }: ApplicationsChartProps) {
  const formattedData = data.map((point) => ({
    ...point,
    label: new Date(point.date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
    }),
  }))

  const totalApplications = data.reduce((sum, point) => sum + point.count, 0)
  const totalScraped = data.reduce((sum, point) => sum + (point.scraped || 0), 0)
  const hasScraped = data.some((point) => point.scraped !== undefined)
  const avgPerDay = data.length > 0 ? Math.round(totalApplications / data.length) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{hasScraped ? "Activity over time" : "Applications over time"}</CardTitle>
        <CardDescription>
          Last 14 days — {totalApplications} applications
          {hasScraped ? `, ${totalScraped} jobs scraped` : ""}, avg {avgPerDay} applications/day
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData}>
              <XAxis
                dataKey="label"
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "#3f3f46", opacity: 0.3 }}
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                  color: "#fafafa",
                }}
                labelStyle={{ color: "#fafafa" }}
                itemStyle={{ color: "#fafafa" }}
              />
              {hasScraped && <Legend />}
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Applications" />
              {hasScraped && (
                <Bar dataKey="scraped" fill="#10b981" radius={[4, 4, 0, 0]} name="Scraped jobs" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
