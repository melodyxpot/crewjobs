import { z } from "zod"

export const jobApplicationSchema = z.object({
  company: z.string().min(1, "Company is required"),
  title: z.string().min(1, "Job title is required"),
  link: z.string().url("Must be a valid URL").nullable().or(z.literal("")),
  platform: z.string().min(1, "Platform is required"),
  status: z.string().min(1, "Status is required"),
  appliedAt: z.string().min(1, "Applied date is required"),
  followUpAt: z.string().nullable().or(z.literal("")),
  location: z.string().nullable().or(z.literal("")),
  workLocation: z.string().nullable().or(z.literal("")),
  jobType: z.string().nullable().or(z.literal("")),
  notes: z.string().nullable().or(z.literal("")),
})

export type JobApplicationFormData = z.infer<typeof jobApplicationSchema>

export const settingsSchema = z.object({
  defaultPlatform: z.string().min(1, "Default platform is required"),
  defaultStatus: z.string().min(1, "Default status is required"),
  followUpOffsetDays: z.number().min(1).max(365),
  platformOptions: z.array(z.string()).min(1, "At least one platform is required"),
  locationOptions: z.array(z.string()).min(1, "At least one location is required"),
  workLocationOptions: z.array(z.string()).min(1, "At least one work location is required"),
  defaultLocation: z.string().optional(),
  defaultWorkLocation: z.string().optional(),
})

export type SettingsFormData = z.infer<typeof settingsSchema>

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["bidder", "caller", "finance", "moderator", "developer"]),
  name: z.string().optional(),
})

export const bulkParseSchema = z.object({
  format: z.enum(["pipe", "tab", "url"]),
  rawText: z.string().min(1, "Please paste some data"),
  appliedAt: z.string(),
  platform: z.string(),
  status: z.string(),
  followUpOffsetDays: z.number(),
})

export type BulkParseFormData = z.infer<typeof bulkParseSchema>
