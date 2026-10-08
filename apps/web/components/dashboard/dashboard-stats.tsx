import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Briefcase, Calendar, CalendarDays, Globe, TrendingUp, Users } from "lucide-react"
import type { DashboardStats as Stats } from "@/lib/types"

interface DashboardStatsProps {
  stats: Stats | null
  includeScraped?: boolean
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: number | string
  description: string
  icon: typeof Briefcase
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {[...Array(count)].map((_, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function DashboardStats({ stats, includeScraped = false }: DashboardStatsProps) {
  const showScraped = stats ? stats.scrapedToday !== undefined : includeScraped

  if (!stats) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonGrid count={5} />
        {showScraped && <SkeletonGrid count={3} />}
      </div>
    )
  }

  const submitted =
    stats.scope === "own"
      ? "you submitted"
      : stats.scope === "workspace"
        ? "in your workspaces"
        : "across the team"

  const applicationCards = [
    {
      title: "Today",
      value: stats.applicationsToday,
      icon: Briefcase,
      description: submitted,
    },
    {
      title: "This Week",
      value: stats.applicationsThisWeek,
      icon: Calendar,
      description: submitted,
    },
    {
      title: "This Month",
      value: stats.applicationsThisMonth,
      icon: CalendarDays,
      description: submitted,
    },
    {
      title: "Interviews",
      value: stats.interviewsCount,
      icon: Users,
      description: "scheduled",
    },
    {
      title: "Response Rate",
      value: `${stats.responseRate}%`,
      icon: TrendingUp,
      description: "interviews / applications",
    },
  ]

  const scrapedCards =
    stats.scrapedToday === undefined
      ? []
      : [
          {
            title: "Scraped today",
            value: stats.scrapedToday,
            icon: Globe,
            description: "new remote jobs",
          },
          {
            title: "Scraped this week",
            value: stats.scrapedThisWeek ?? 0,
            icon: Globe,
            description: "new remote jobs",
          },
          {
            title: "Scraped this month",
            value: stats.scrapedThisMonth ?? 0,
            icon: Globe,
            description: "new remote jobs",
          },
        ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        {scrapedCards.length > 0 && <h2 className="mb-3 text-sm font-medium">Applications</h2>}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {applicationCards.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>
      </div>
      {scrapedCards.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium">Scraped jobs</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {scrapedCards.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
