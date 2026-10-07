"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { apiGetJobSources, apiUpdateSettings, type ScraperSourceStatus } from "@/lib/api"
import { settingsSchema, type SettingsFormData } from "@/lib/validation"
import type { Settings } from "@/lib/types"
import { DEFAULT_STATUSES, DEFAULT_PLATFORMS, LOCATIONS, WORK_LOCATIONS } from "@/lib/types"
import { toast } from "sonner"
import { Loader2, X, Plus } from "lucide-react"

const SCRAPER_IDS = ["public", "adzuna", "jsearch", "themuse"] as const

function savedScraperSources(values?: string[]) {
  const chosen = (values || []).filter((value): value is (typeof SCRAPER_IDS)[number] =>
    (SCRAPER_IDS as readonly string[]).includes(value),
  )
  return chosen.length > 0 ? chosen : (["public"] as (typeof SCRAPER_IDS)[number][])
}

interface SettingsFormProps {
  settings: Settings | null
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [newPlatform, setNewPlatform] = useState("")
  const [newLocation, setNewLocation] = useState("")
  const [newWorkLocation, setNewWorkLocation] = useState("")

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      defaultPlatform: settings?.defaultPlatform || "LinkedIn",
      defaultStatus: settings?.defaultStatus || "Applied",
      followUpOffsetDays: settings?.followUpOffsetDays || 7,
      platformOptions: settings?.platformOptions || DEFAULT_PLATFORMS,
      locationOptions: settings?.locationOptions || LOCATIONS,
      workLocationOptions: settings?.workLocationOptions || WORK_LOCATIONS,
      defaultLocation: settings?.defaultLocation || LOCATIONS[0],
      defaultWorkLocation: settings?.defaultWorkLocation || WORK_LOCATIONS[0],
      scraperSources: savedScraperSources(settings?.scraperSources),
    },
  })
  const [sourceCatalog, setSourceCatalog] = useState<ScraperSourceStatus[]>([])

  useEffect(() => {
    apiGetJobSources()
      .then(({ sources }) => setSourceCatalog(sources))
      .catch(() =>
        setSourceCatalog([
          {
            id: "public",
            label: "Public remote boards",
            description: "Remote OK, Remotive, Arbeitnow, and Jobicy. No API key.",
            env: [],
            ready: true,
          },
          {
            id: "adzuna",
            label: "Adzuna",
            description: "Remote developer listings from Adzuna.",
            env: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
            ready: false,
          },
          {
            id: "jsearch",
            label: "JSearch",
            description: "Broader listings from Indeed, LinkedIn, and other boards via JSearch.",
            env: ["JSEARCH_API_KEY"],
            ready: false,
          },
          {
            id: "themuse",
            label: "The Muse",
            description: "Broader coverage from The Muse software engineering listings.",
            env: ["THEMUSE_API_KEY"],
            ready: false,
          },
        ]),
      )
  }, [])

  const platformOptions = watch("platformOptions")
  const locationOptions = watch("locationOptions")
  const workLocationOptions = watch("workLocationOptions")
  const defaultPlatform = watch("defaultPlatform")
  const defaultStatus = watch("defaultStatus")
  const followUpOffsetDays = watch("followUpOffsetDays")
  const defaultLocation = watch("defaultLocation")
  const defaultWorkLocation = watch("defaultWorkLocation")
  const scraperSources = watch("scraperSources") || ["public"]
  const savedSources = savedScraperSources(settings?.scraperSources)

  const isFormChanged =
    defaultPlatform !== (settings?.defaultPlatform || "LinkedIn") ||
    defaultStatus !== (settings?.defaultStatus || "Applied") ||
    followUpOffsetDays !== (settings?.followUpOffsetDays || 7) ||
    defaultLocation !== (settings?.defaultLocation || LOCATIONS[0]) ||
    defaultWorkLocation !== (settings?.defaultWorkLocation || WORK_LOCATIONS[0]) ||
    JSON.stringify(platformOptions) !==
      JSON.stringify(settings?.platformOptions || DEFAULT_PLATFORMS) ||
    JSON.stringify(locationOptions) !== JSON.stringify(settings?.locationOptions || LOCATIONS) ||
    JSON.stringify(workLocationOptions) !==
      JSON.stringify(settings?.workLocationOptions || WORK_LOCATIONS) ||
    JSON.stringify([...scraperSources].sort()) !== JSON.stringify([...savedSources].sort())

  const toggleSource = (id: ScraperSourceStatus["id"], ready: boolean) => {
    if (!ready) return
    const next = scraperSources.includes(id)
      ? scraperSources.filter((source) => source !== id)
      : [...scraperSources, id]
    if (next.length === 0) {
      toast.error("Choose at least one job source")
      return
    }
    setValue("scraperSources", next)
  }

  const addPlatform = () => {
    if (newPlatform.trim() && !platformOptions.includes(newPlatform.trim())) {
      setValue("platformOptions", [...platformOptions, newPlatform.trim()])
      setNewPlatform("")
    }
  }

  const removePlatform = (platform: string) => {
    if (platformOptions.length > 1) {
      setValue(
        "platformOptions",
        platformOptions.filter((p) => p !== platform),
      )
    }
  }

  const removeLocation = (location: string) => {
    if (locationOptions.length > 1) {
      setValue(
        "locationOptions",
        locationOptions.filter((l) => l !== location),
      )
    }
  }

  const removeWorkLocation = (workLocation: string) => {
    if (workLocationOptions.length > 1) {
      setValue(
        "workLocationOptions",
        workLocationOptions.filter((w) => w !== workLocation),
      )
    }
  }

  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true)
    try {
      await apiUpdateSettings(data)
      toast.success("Settings saved")
    } catch (err: any) {
      toast.error(err.message)
    }
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Default Values</CardTitle>
          <CardDescription>
            These defaults will be used when adding new applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="defaultPlatform">Default Platform</Label>
              <Select
                value={watch("defaultPlatform")}
                onValueChange={(value) => setValue("defaultPlatform", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.defaultPlatform && (
                <p className="text-sm text-destructive">{errors.defaultPlatform.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultStatus">Default Status</Label>
              <Select
                value={watch("defaultStatus")}
                onValueChange={(value) => setValue("defaultStatus", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.defaultStatus && (
                <p className="text-sm text-destructive">{errors.defaultStatus.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="followUpOffsetDays">Follow-up Offset (days)</Label>
              <Input
                id="followUpOffsetDays"
                type="number"
                min={1}
                max={365}
                {...register("followUpOffsetDays", { valueAsNumber: true })}
              />
              {errors.followUpOffsetDays && (
                <p className="text-sm text-destructive">{errors.followUpOffsetDays.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Days after application to schedule follow-up
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultLocation">Default Location</Label>
              <Select
                value={defaultLocation || ""}
                onValueChange={(value) => setValue("defaultLocation", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locationOptions.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultWorkLocation">Default Work Location</Label>
              <Select
                value={defaultWorkLocation || ""}
                onValueChange={(value) => setValue("defaultWorkLocation", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workLocationOptions.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job scraper</CardTitle>
          <CardDescription>
            Choose which sources to search when you scrape remote developer jobs. API keys stay in
            the API env file.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {sourceCatalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading sources...</p>
          ) : (
            sourceCatalog.map((source) => {
              const checked = scraperSources.includes(source.id)
              return (
                <label
                  key={source.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${source.ready ? "cursor-pointer" : "opacity-70"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={checked}
                    disabled={!source.ready}
                    onChange={() => toggleSource(source.id, source.ready)}
                  />
                  <span className="grid gap-1">
                    <span className="font-medium">{source.label}</span>
                    <span className="text-sm text-muted-foreground">{source.description}</span>
                    {!source.ready && (
                      <span className="text-xs text-muted-foreground">
                        Add {source.env.join(" and ")} to the API env file
                      </span>
                    )}
                  </span>
                </label>
              )
            })
          )}
          {errors.scraperSources && (
            <p className="text-sm text-destructive">{errors.scraperSources.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Options</CardTitle>
          <CardDescription>Customize the list of platforms you apply through</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {platformOptions.map((platform) => (
              <Badge key={platform} variant="secondary" className="gap-1 pr-1">
                {platform}
                <button
                  type="button"
                  onClick={() => removePlatform(platform)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  disabled={platformOptions.length <= 1}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add new platform..."
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addPlatform()
                }
              }}
              className="max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={addPlatform}
              disabled={!newPlatform.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {errors.platformOptions && (
            <p className="text-sm text-destructive">{errors.platformOptions.message}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Location Options</CardTitle>
            <CardDescription>Customize the list of locations for job positions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {locationOptions.map((location) => (
                <Badge key={location} variant="secondary" className="gap-1 pr-1">
                  {location}
                  <button
                    type="button"
                    onClick={() => removeLocation(location)}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    disabled={locationOptions.length <= 1}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add new location..."
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    if (newLocation.trim() && !locationOptions.includes(newLocation.trim())) {
                      setValue("locationOptions", [...locationOptions, newLocation.trim()])
                      setNewLocation("")
                    }
                  }
                }}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (newLocation.trim() && !locationOptions.includes(newLocation.trim())) {
                    setValue("locationOptions", [...locationOptions, newLocation.trim()])
                    setNewLocation("")
                  }
                }}
                disabled={!newLocation.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {errors.locationOptions && (
              <p className="text-sm text-destructive">{errors.locationOptions.message}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work Location Options</CardTitle>
            <CardDescription>
              Customize the list of work location types (Remote, Hybrid, Onsite)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {workLocationOptions.map((workLocation) => (
                <Badge key={workLocation} variant="secondary" className="gap-1 pr-1">
                  {workLocation}
                  <button
                    type="button"
                    onClick={() => removeWorkLocation(workLocation)}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    disabled={workLocationOptions.length <= 1}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add new work location..."
                value={newWorkLocation}
                onChange={(e) => setNewWorkLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    if (
                      newWorkLocation.trim() &&
                      !workLocationOptions.includes(newWorkLocation.trim())
                    ) {
                      setValue("workLocationOptions", [
                        ...workLocationOptions,
                        newWorkLocation.trim(),
                      ])
                      setNewWorkLocation("")
                    }
                  }
                }}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (
                    newWorkLocation.trim() &&
                    !workLocationOptions.includes(newWorkLocation.trim())
                  ) {
                    setValue("workLocationOptions", [
                      ...workLocationOptions,
                      newWorkLocation.trim(),
                    ])
                    setNewWorkLocation("")
                  }
                }}
                disabled={!newWorkLocation.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {errors.workLocationOptions && (
              <p className="text-sm text-destructive">{errors.workLocationOptions.message}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading || !isFormChanged}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Settings
        </Button>
      </div>
    </form>
  )
}
