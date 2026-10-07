"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  apiGetProfile,
  apiUpdateProfile,
  apiUploadResume,
  apiDownloadResume,
  apiDeleteResume,
  apiParseResume,
} from "@/lib/api"
import { toast } from "sonner"
import {
  Loader2,
  X,
  Plus,
  Upload,
  FileText,
  Download,
  Trash2,
  Sparkles,
  Save,
} from "lucide-react"

interface Education {
  school: string
  degree: string
  field: string
  startDate: string
  endDate: string
  gpa: string
  description: string
}

interface Experience {
  company: string
  title: string
  location: string
  startDate: string
  endDate: string
  current: boolean
  description: string
}

interface Project {
  name: string
  url: string
  description: string
  technologies: string
}

interface EqualEmployment {
  authorizedToWork: string
  disability: string
  gender: string
  requireSponsorship: string
  lgbtq: string
  veteran: string
  race: string
  hispanicOrLatino: string
  sexualOrientation: string
}

interface ProfileData {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
  linkedIn: string
  github: string
  portfolio: string
  otherSocials: string
  summary: string
  resumeFilename: string
  education: Education[]
  experience: Experience[]
  projects: Project[]
  skills: string[]
  equalEmployment: EqualEmployment
}

const emptyProfile: ProfileData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
  linkedIn: "",
  github: "",
  portfolio: "",
  otherSocials: "",
  summary: "",
  resumeFilename: "",
  education: [],
  experience: [],
  projects: [],
  skills: [],
  equalEmployment: {
    authorizedToWork: "",
    disability: "",
    gender: "",
    requireSponsorship: "",
    lgbtq: "",
    veteran: "",
    race: "",
    hispanicOrLatino: "",
    sexualOrientation: "",
  },
}

const emptyEducation: Education = {
  school: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
  gpa: "",
  description: "",
}

const emptyExperience: Experience = {
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  description: "",
}

const emptyProject: Project = {
  name: "",
  url: "",
  description: "",
  technologies: "",
}

const YES_NO_OPTIONS = ["Yes", "No", "Prefer not to say"]

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"]

const RACE_OPTIONS = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Two or more races",
  "Prefer not to say",
]

const ORIENTATION_OPTIONS = [
  "Heterosexual",
  "Gay or Lesbian",
  "Bisexual",
  "Prefer not to say",
  "Other",
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newSkill, setNewSkill] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadOnlyRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    apiGetProfile()
      .then(({ profile: p }) => {
        if (p) {
          setProfile({
            firstName: p.firstName || "",
            lastName: p.lastName || "",
            email: p.email || "",
            phone: p.phone || "",
            address: p.address || "",
            city: p.city || "",
            state: p.state || "",
            zipCode: p.zipCode || "",
            country: p.country || "",
            linkedIn: p.linkedIn || "",
            github: p.github || "",
            portfolio: p.portfolio || "",
            otherSocials: p.otherSocials || "",
            summary: p.summary || "",
            resumeFilename: p.resumeFilename || "",
            education: p.education || [],
            experience: p.experience || [],
            projects: p.projects || [],
            skills: p.skills || [],
            equalEmployment: {
              authorizedToWork: p.equalEmployment?.authorizedToWork || "",
              disability: p.equalEmployment?.disability || "",
              gender: p.equalEmployment?.gender || "",
              requireSponsorship: p.equalEmployment?.requireSponsorship || "",
              lgbtq: p.equalEmployment?.lgbtq || "",
              veteran: p.equalEmployment?.veteran || "",
              race: p.equalEmployment?.race || "",
              hispanicOrLatino: p.equalEmployment?.hispanicOrLatino || "",
              sexualOrientation: p.equalEmployment?.sexualOrientation || "",
            },
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const updateField = (field: keyof ProfileData, value: any) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const updateEE = (field: keyof EqualEmployment, value: string) => {
    setProfile((prev) => ({
      ...prev,
      equalEmployment: { ...prev.equalEmployment, [field]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { resumeFilename, ...data } = profile
      await apiUpdateProfile(data)
      toast.success("Profile saved")
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  const handleParseResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true)
    try {
      const { parsed, filename } = await apiParseResume(file)
      setProfile((prev) => ({
        ...prev,
        firstName: parsed.firstName || prev.firstName,
        lastName: parsed.lastName || prev.lastName,
        email: parsed.email || prev.email,
        phone: parsed.phone || prev.phone,
        address: parsed.address || prev.address,
        city: parsed.city || prev.city,
        state: parsed.state || prev.state,
        zipCode: parsed.zipCode || prev.zipCode,
        country: parsed.country || prev.country,
        linkedIn: parsed.linkedIn || prev.linkedIn,
        github: parsed.github || prev.github,
        portfolio: parsed.portfolio || prev.portfolio,
        otherSocials: parsed.otherSocials || prev.otherSocials,
        summary: parsed.summary || prev.summary,
        resumeFilename: filename || prev.resumeFilename,
        education: parsed.education?.length ? parsed.education : prev.education,
        experience: parsed.experience?.length ? parsed.experience : prev.experience,
        projects: parsed.projects?.length ? parsed.projects : prev.projects,
        skills: parsed.skills?.length ? parsed.skills : prev.skills,
      }))
      toast.success("Resume parsed and fields auto-filled. Review and save.")
    } catch (err: any) {
      toast.error(err.message)
    }
    setParsing(false)
    e.target.value = ""
  }

  const handleUploadOnly = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await apiUploadResume(file)
      updateField("resumeFilename", result.filename || file.name)
      toast.success("Resume uploaded")
    } catch (err: any) {
      toast.error(err.message)
    }
    setUploading(false)
    e.target.value = ""
  }

  const handleDownloadResume = async () => {
    try {
      const { url, filename } = await apiDownloadResume()
      const a = document.createElement("a")
      a.href = url
      a.download = filename || profile.resumeFilename || "resume"
      a.target = "_blank"
      a.click()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDeleteResume = async () => {
    try {
      await apiDeleteResume()
      updateField("resumeFilename", "")
      toast.success("Resume removed")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const addSkill = () => {
    const trimmed = newSkill.trim()
    if (trimmed && !profile.skills.includes(trimmed)) {
      updateField("skills", [...profile.skills, trimmed])
      setNewSkill("")
    }
  }

  const removeSkill = (skill: string) => {
    updateField("skills", profile.skills.filter((s) => s !== skill))
  }

  const addEducation = () => {
    updateField("education", [...profile.education, { ...emptyEducation }])
  }

  const removeEducation = (index: number) => {
    updateField("education", profile.education.filter((_, i) => i !== index))
  }

  const updateEducation = (index: number, field: keyof Education, value: string) => {
    const updated = [...profile.education]
    updated[index] = { ...updated[index], [field]: value }
    updateField("education", updated)
  }

  const addExperience = () => {
    updateField("experience", [...profile.experience, { ...emptyExperience }])
  }

  const removeExperience = (index: number) => {
    updateField("experience", profile.experience.filter((_, i) => i !== index))
  }

  const updateExperience = (index: number, field: keyof Experience, value: any) => {
    const updated = [...profile.experience]
    updated[index] = { ...updated[index], [field]: value }
    updateField("experience", updated)
  }

  const addProject = () => {
    updateField("projects", [...profile.projects, { ...emptyProject }])
  }

  const removeProject = (index: number) => {
    updateField("projects", profile.projects.filter((_, i) => i !== index))
  }

  const updateProject = (index: number, field: keyof Project, value: string) => {
    const updated = [...profile.projects]
    updated[index] = { ...updated[index], [field]: value }
    updateField("projects", updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground">
            Manage your personal information, resume, and job preferences
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Profile
        </Button>
      </div>

      {/* Resume Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume
          </CardTitle>
          <CardDescription>
            Upload your resume to auto-fill profile fields or store it for quick access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleParseResume}
            />
            <Button
              type="button"
              variant="default"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing}
            >
              {parsing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Upload &amp; Auto-fill
            </Button>

            <input
              ref={uploadOnlyRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleUploadOnly}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => uploadOnlyRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload Only
            </Button>
          </div>

          {profile.resumeFilename && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="gap-1.5">
                <FileText className="h-3 w-3" />
                {profile.resumeFilename}
              </Badge>
              <Button type="button" variant="ghost" size="sm" onClick={handleDownloadResume}>
                <Download className="mr-1 h-4 w-4" />
                Download
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleDeleteResume} className="text-destructive hover:text-destructive">
                <Trash2 className="mr-1 h-4 w-4" />
                Remove
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="experience">Work Experience</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="equal-employment">Equal Employment</TabsTrigger>
        </TabsList>

        {/* Personal Tab */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your basic contact details and online presence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profile.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profile.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={profile.address}
                    onChange={(e) => updateField("address", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={profile.city}
                    onChange={(e) => updateField("city", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={profile.state}
                    onChange={(e) => updateField("state", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    value={profile.zipCode}
                    onChange={(e) => updateField("zipCode", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={profile.country}
                    onChange={(e) => updateField("country", e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="linkedIn">LinkedIn</Label>
                  <Input
                    id="linkedIn"
                    placeholder="https://linkedin.com/in/..."
                    value={profile.linkedIn}
                    onChange={(e) => updateField("linkedIn", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="github">GitHub</Label>
                  <Input
                    id="github"
                    placeholder="https://github.com/..."
                    value={profile.github}
                    onChange={(e) => updateField("github", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="portfolio">Portfolio</Label>
                  <Input
                    id="portfolio"
                    placeholder="https://..."
                    value={profile.portfolio}
                    onChange={(e) => updateField("portfolio", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="otherSocials">Other Socials</Label>
                  <Input
                    id="otherSocials"
                    value={profile.otherSocials}
                    onChange={(e) => updateField("otherSocials", e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  rows={4}
                  placeholder="A brief professional summary..."
                  value={profile.summary}
                  onChange={(e) => updateField("summary", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Education Tab */}
        <TabsContent value="education">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Education</CardTitle>
                  <CardDescription>Your academic background</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addEducation}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Education
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile.education.length === 0 && (
                <p className="text-sm text-muted-foreground">No education entries yet. Click &quot;Add Education&quot; to get started.</p>
              )}
              {profile.education.map((edu, i) => (
                <div key={i} className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Education {i + 1}</h4>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeEducation(i)} className="text-destructive hover:text-destructive">
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="grid gap-2">
                      <Label>School</Label>
                      <Input value={edu.school} onChange={(e) => updateEducation(i, "school", e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Degree</Label>
                      <Input value={edu.degree} onChange={(e) => updateEducation(i, "degree", e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Field of Study</Label>
                      <Input value={edu.field} onChange={(e) => updateEducation(i, "field", e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Start Date</Label>
                      <Input value={edu.startDate} onChange={(e) => updateEducation(i, "startDate", e.target.value)} placeholder="MM/YYYY" />
                    </div>
                    <div className="grid gap-2">
                      <Label>End Date</Label>
                      <Input value={edu.endDate} onChange={(e) => updateEducation(i, "endDate", e.target.value)} placeholder="MM/YYYY" />
                    </div>
                    <div className="grid gap-2">
                      <Label>GPA</Label>
                      <Input value={edu.gpa} onChange={(e) => updateEducation(i, "gpa", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Textarea value={edu.description} onChange={(e) => updateEducation(i, "description", e.target.value)} rows={2} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Work Experience Tab */}
        <TabsContent value="experience">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Work Experience</CardTitle>
                    <CardDescription>Your professional work history</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addExperience}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Experience
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {profile.experience.length === 0 && (
                  <p className="text-sm text-muted-foreground">No experience entries yet. Click &quot;Add Experience&quot; to get started.</p>
                )}
                {profile.experience.map((exp, i) => (
                  <div key={i} className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Experience {i + 1}</h4>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeExperience(i)} className="text-destructive hover:text-destructive">
                        <Trash2 className="mr-1 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="grid gap-2">
                        <Label>Company</Label>
                        <Input value={exp.company} onChange={(e) => updateExperience(i, "company", e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Title</Label>
                        <Input value={exp.title} onChange={(e) => updateExperience(i, "title", e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Location</Label>
                        <Input value={exp.location} onChange={(e) => updateExperience(i, "location", e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Start Date</Label>
                        <Input value={exp.startDate} onChange={(e) => updateExperience(i, "startDate", e.target.value)} placeholder="MM/YYYY" />
                      </div>
                      <div className="grid gap-2">
                        <Label>End Date</Label>
                        <Input
                          value={exp.endDate}
                          onChange={(e) => updateExperience(i, "endDate", e.target.value)}
                          placeholder="MM/YYYY"
                          disabled={exp.current}
                        />
                      </div>
                      <div className="flex items-end gap-2 pb-1">
                        <input
                          type="checkbox"
                          id={`current-${i}`}
                          checked={exp.current}
                          onChange={(e) => updateExperience(i, "current", e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor={`current-${i}`} className="cursor-pointer">Currently working here</Label>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Textarea value={exp.description} onChange={(e) => updateExperience(i, "description", e.target.value)} rows={3} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Projects</CardTitle>
                    <CardDescription>Notable projects you&apos;ve worked on</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addProject}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Project
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {profile.projects.length === 0 && (
                  <p className="text-sm text-muted-foreground">No projects yet. Click &quot;Add Project&quot; to get started.</p>
                )}
                {profile.projects.map((proj, i) => (
                  <div key={i} className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Project {i + 1}</h4>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeProject(i)} className="text-destructive hover:text-destructive">
                        <Trash2 className="mr-1 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Project Name</Label>
                        <Input value={proj.name} onChange={(e) => updateProject(i, "name", e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>URL</Label>
                        <Input value={proj.url} onChange={(e) => updateProject(i, "url", e.target.value)} placeholder="https://..." />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Technologies</Label>
                      <Input value={proj.technologies} onChange={(e) => updateProject(i, "technologies", e.target.value)} placeholder="React, Node.js, ..." />
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Textarea value={proj.description} onChange={(e) => updateProject(i, "description", e.target.value)} rows={2} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills">
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
              <CardDescription>Add your technical and professional skills</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {profile.skills.length === 0 && (
                  <p className="text-sm text-muted-foreground">No skills added yet.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a skill..."
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addSkill()
                    }
                  }}
                  className="max-w-xs"
                />
                <Button type="button" variant="outline" size="icon" onClick={addSkill} disabled={!newSkill.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Equal Employment Tab */}
        <TabsContent value="equal-employment">
          <Card>
            <CardHeader>
              <CardTitle>Equal Employment Information</CardTitle>
              <CardDescription>
                This information is voluntary and will be used to auto-fill job application forms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <EERow label="Are you authorized to work in the US?" value={profile.equalEmployment.authorizedToWork} onChange={(v) => updateEE("authorizedToWork", v)} options={YES_NO_OPTIONS} />
              <EERow label="Do you have a disability?" value={profile.equalEmployment.disability} onChange={(v) => updateEE("disability", v)} options={YES_NO_OPTIONS} />
              <EERow label="What is your gender?" value={profile.equalEmployment.gender} onChange={(v) => updateEE("gender", v)} options={GENDER_OPTIONS} />
              <EERow label="Will you now or in the future require sponsorship for employment visa status?" value={profile.equalEmployment.requireSponsorship} onChange={(v) => updateEE("requireSponsorship", v)} options={YES_NO_OPTIONS} />
              <EERow label="Do you identify as LGBTQ+?" value={profile.equalEmployment.lgbtq} onChange={(v) => updateEE("lgbtq", v)} options={YES_NO_OPTIONS} />
              <EERow label="Are you a veteran?" value={profile.equalEmployment.veteran} onChange={(v) => updateEE("veteran", v)} options={YES_NO_OPTIONS} />
              <EERow label="How would you identify your race?" value={profile.equalEmployment.race} onChange={(v) => updateEE("race", v)} options={RACE_OPTIONS} />
              <EERow label="Are you Hispanic or Latino?" value={profile.equalEmployment.hispanicOrLatino} onChange={(v) => updateEE("hispanicOrLatino", v)} options={YES_NO_OPTIONS} />
              <EERow label="How would you describe your sexual orientation?" value={profile.equalEmployment.sexualOrientation} onChange={(v) => updateEE("sexualOrientation", v)} options={ORIENTATION_OPTIONS} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EERow({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Label className="text-sm font-normal sm:max-w-[60%]">{label}</Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-[220px]">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
