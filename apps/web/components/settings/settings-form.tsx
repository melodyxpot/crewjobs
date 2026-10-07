"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { apiUpdateSettings } from "@/lib/api"
import { settingsSchema, type SettingsFormData } from "@/lib/validation"
import type { Settings } from "@/lib/types"
import { DEFAULT_STATUSES, DEFAULT_PLATFORMS, LOCATIONS, WORK_LOCATIONS } from "@/lib/types"
import { toast } from "sonner"
import { Loader2, X, Plus } from "lucide-react"

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
    },
  })

  const platformOptions = watch("platformOptions")
  const locationOptions = watch("locationOptions")
  const workLocationOptions = watch("workLocationOptions")
  const defaultPlatform = watch("defaultPlatform")
  const defaultStatus = watch("defaultStatus")
  const followUpOffsetDays = watch("followUpOffsetDays")
  const defaultLocation = watch("defaultLocation")
  const defaultWorkLocation = watch("defaultWorkLocation")

  const isFormChanged =
    defaultPlatform !== (settings?.defaultPlatform || "LinkedIn") ||
    defaultStatus !== (settings?.defaultStatus || "Applied") ||
    followUpOffsetDays !== (settings?.followUpOffsetDays || 7) ||
    defaultLocation !== (settings?.defaultLocation || LOCATIONS[0]) ||
    defaultWorkLocation !== (settings?.defaultWorkLocation || WORK_LOCATIONS[0]) ||
    JSON.stringify(platformOptions) !== JSON.stringify(settings?.platformOptions || DEFAULT_PLATFORMS) ||
    JSON.stringify(locationOptions) !== JSON.stringify(settings?.locationOptions || LOCATIONS) ||
    JSON.stringify(workLocationOptions) !== JSON.stringify(settings?.workLocationOptions || WORK_LOCATIONS)

  const addPlatform = () => {
    if (newPlatform.trim() && !platformOptions.includes(newPlatform.trim())) {
      setValue("platformOptions", [...platformOptions, newPlatform.trim()])
      setNewPlatform("")
    }
  }

  const removePlatform = (platform: string) => {
    if (platformOptions.length > 1) {
      setValue("platformOptions", platformOptions.filter((p) => p !== platform))
    }
  }

  const removeLocation = (location: string) => {
    if (locationOptions.length > 1) {
      setValue("locationOptions", locationOptions.filter((l) => l !== location))
    }
  }

  const removeWorkLocation = (workLocation: string) => {
    if (workLocationOptions.length > 1) {
      setValue("workLocationOptions", workLocationOptions.filter((w) => w !== workLocation))
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
          <CardDescription>These defaults will be used when adding new applications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="defaultPlatform">Default Platform</Label>
              <Select value={watch("defaultPlatform")} onValueChange={(value) => setValue("defaultPlatform", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{platformOptions.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}</SelectContent>
              </Select>
              {errors.defaultPlatform && <p className="text-sm text-destructive">{errors.defaultPlatform.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultStatus">Default Status</Label>
              <Select value={watch("defaultStatus")} onValueChange={(value) => setValue("defaultStatus", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEFAULT_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
              </Select>
              {errors.defaultStatus && <p className="text-sm text-destructive">{errors.defaultStatus.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="followUpOffsetDays">Follow-up Offset (days)</Label>
              <Input id="followUpOffsetDays" type="number" min={1} max={365} {...register("followUpOffsetDays", { valueAsNumber: true })} />
              {errors.followUpOffsetDays && <p className="text-sm text-destructive">{errors.followUpOffsetDays.message}</p>}
              <p className="text-xs text-muted-foreground">Days after application to schedule follow-up</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultLocation">Default Location</Label>
              <Select value={defaultLocation || ""} onValueChange={(value) => setValue("defaultLocation", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{locationOptions.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultWorkLocation">Default Work Location</Label>
              <Select value={defaultWorkLocation || ""} onValueChange={(value) => setValue("defaultWorkLocation", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{workLocationOptions.map((w) => (<SelectItem key={w} value={w}>{w}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
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
                <button type="button" onClick={() => removePlatform(platform)} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20" disabled={platformOptions.length <= 1}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Add new platform..." value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPlatform() } }} className="max-w-xs" />
            <Button type="button" variant="outline" size="icon" onClick={addPlatform} disabled={!newPlatform.trim()}><Plus className="h-4 w-4" /></Button>
          </div>
          {errors.platformOptions && <p className="text-sm text-destructive">{errors.platformOptions.message}</p>}
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
                  <button type="button" onClick={() => removeLocation(location)} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20" disabled={locationOptions.length <= 1}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Add new location..." value={newLocation} onChange={(e) => setNewLocation(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newLocation.trim() && !locationOptions.includes(newLocation.trim())) { setValue("locationOptions", [...locationOptions, newLocation.trim()]); setNewLocation("") } } }} className="max-w-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => { if (newLocation.trim() && !locationOptions.includes(newLocation.trim())) { setValue("locationOptions", [...locationOptions, newLocation.trim()]); setNewLocation("") } }} disabled={!newLocation.trim()}><Plus className="h-4 w-4" /></Button>
            </div>
            {errors.locationOptions && <p className="text-sm text-destructive">{errors.locationOptions.message}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work Location Options</CardTitle>
            <CardDescription>Customize the list of work location types (Remote, Hybrid, Onsite)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {workLocationOptions.map((workLocation) => (
                <Badge key={workLocation} variant="secondary" className="gap-1 pr-1">
                  {workLocation}
                  <button type="button" onClick={() => removeWorkLocation(workLocation)} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20" disabled={workLocationOptions.length <= 1}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Add new work location..." value={newWorkLocation} onChange={(e) => setNewWorkLocation(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newWorkLocation.trim() && !workLocationOptions.includes(newWorkLocation.trim())) { setValue("workLocationOptions", [...workLocationOptions, newWorkLocation.trim()]); setNewWorkLocation("") } } }} className="max-w-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => { if (newWorkLocation.trim() && !workLocationOptions.includes(newWorkLocation.trim())) { setValue("workLocationOptions", [...workLocationOptions, newWorkLocation.trim()]); setNewWorkLocation("") } }} disabled={!newWorkLocation.trim()}><Plus className="h-4 w-4" /></Button>
            </div>
            {errors.workLocationOptions && <p className="text-sm text-destructive">{errors.workLocationOptions.message}</p>}
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
