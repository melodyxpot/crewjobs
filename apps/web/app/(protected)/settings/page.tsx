"use client"

import { useEffect, useState } from "react"
import { SettingsForm } from "@/components/settings/settings-form"
import { apiGetSettings } from "@/lib/api"
import type { Settings } from "@/lib/types"

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    apiGetSettings().then(({ settings }) => setSettings(settings)).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your application defaults and preferences</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  )
}
