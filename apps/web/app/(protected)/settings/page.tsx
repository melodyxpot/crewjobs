"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SettingsForm } from "@/components/settings/settings-form"
import { apiGetSettings } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import type { Settings } from "@/lib/types"
import { Loader2 } from "lucide-react"

export default function SettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const allowed = !!user?.isSuperAdmin || user?.role === "leader"
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard")
  }, [user, allowed, router])

  useEffect(() => {
    if (!allowed) return
    apiGetSettings()
      .then(({ settings: next }) => setSettings(next))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [allowed])

  if (!allowed) return null

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your application defaults and preferences</p>
      </div>
      {loaded ? (
        <SettingsForm settings={settings} />
      ) : (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
