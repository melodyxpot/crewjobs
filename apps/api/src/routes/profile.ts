import { Router } from "express"
import multer from "multer"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import { generateText, Output } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import { put, del } from "@vercel/blob"
import PDFDocument from "pdfkit"
import { authenticate, AuthRequest } from "../middleware/auth"
import { Profile } from "../models/Profile"
import { Workspace } from "../models/Workspace"
import { isManager } from "../lib/roles"
import { resolveWorkspaceId, workspacesForUser } from "../lib/workspace-scope"

const router = Router()
router.use(authenticate)

function requestedWorkspaceId(req: AuthRequest) {
  const fromQuery = typeof req.query.workspaceId === "string" ? req.query.workspaceId : ""
  const fromBody = req.body && typeof req.body.workspaceId === "string" ? req.body.workspaceId : ""
  return fromQuery || fromBody || ""
}

async function loadWorkspaceProfile(req: AuthRequest, write = false) {
  if (write && !isManager(req.user!)) {
    return {
      ok: false as const,
      error: "Only a leader or moderator can edit a workspace profile",
      status: 403,
    }
  }

  const requested = requestedWorkspaceId(req)
  let workspace = null
  if (requested) {
    const resolved = await resolveWorkspaceId(req.user!, requested, { required: true })
    if (resolved.error || !resolved.workspaceId) {
      const status = resolved.error === "You cannot use that workspace" ? 403 : 400
      return { ok: false as const, error: resolved.error || "Workspace not found", status }
    }
    workspace = await Workspace.findById(resolved.workspaceId)
  } else {
    const list = await workspacesForUser(req.user!)
    if (list.length === 1) workspace = list[0]
    else if (list.length === 0) {
      return { ok: false as const, error: "No workspace is assigned to you", status: 404 }
    } else {
      return { ok: false as const, error: "Choose a workspace", status: 400 }
    }
  }

  if (!workspace) return { ok: false as const, error: "Workspace not found", status: 404 }
  let profile = await Profile.findOne({ workspaceId: workspace._id })
  if (!profile) {
    const parts = String(workspace.name || "")
      .split(/\s+/)
      .filter(Boolean)
    profile = await Profile.create({
      workspaceId: workspace._id,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
    })
  }
  return { ok: true as const, workspace, profile }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    cb(null, allowed.includes(file.mimetype))
  },
})

// GET /api/profile
router.get("/", async (req: AuthRequest, res) => {
  try {
    const loaded = await loadWorkspaceProfile(req)
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error })
    res.json({ profile: loaded.profile, workspaceId: loaded.workspace._id })
  } catch (error) {
    res.status(500).json({ error: "Failed to get profile" })
  }
})

// PUT /api/profile
router.put("/", async (req: AuthRequest, res) => {
  try {
    const loaded = await loadWorkspaceProfile(req, true)
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error })
    const {
      resumeUrl: _resumeUrl,
      resumeFilename: _resumeFilename,
      userId: _userId,
      workspaceId: _workspaceId,
      ...updateData
    } = req.body
    const profile = await Profile.findOneAndUpdate(
      { workspaceId: loaded.workspace._id },
      { ...updateData, workspaceId: loaded.workspace._id },
      { new: true, upsert: true, runValidators: true },
    )
    const fullName = `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim()
    if (fullName) {
      loaded.workspace.name = fullName
      await loaded.workspace.save()
    }
    res.json({ profile, workspaceName: loaded.workspace.name })
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" })
  }
})

// POST /api/profile/resume - Upload resume
router.post("/resume", upload.single("resume"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }
    const loaded = await loadWorkspaceProfile(req, true)
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error })

    const blob = await put(
      `resumes/${loaded.workspace._id}/${req.file.originalname}`,
      req.file.buffer,
      {
        access: "public",
        contentType: req.file.mimetype,
      },
    )

    await Profile.findOneAndUpdate(
      { workspaceId: loaded.workspace._id },
      {
        workspaceId: loaded.workspace._id,
        resumeFilename: req.file.originalname,
        resumeUrl: blob.url,
      },
      { upsert: true },
    )

    res.json({
      filename: req.file.originalname,
      url: blob.url,
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to upload resume" })
  }
})

// GET /api/profile/resume - Download resume
router.get("/resume", async (req: AuthRequest, res) => {
  try {
    const loaded = await loadWorkspaceProfile(req)
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error })
    const profile = loaded.profile
    if (!profile?.resumeUrl) {
      return res.status(404).json({ error: "No resume found" })
    }

    res.json({ url: profile.resumeUrl, filename: profile.resumeFilename })
  } catch (error) {
    res.status(500).json({ error: "Failed to get resume" })
  }
})

// DELETE /api/profile/resume - Delete resume
router.delete("/resume", async (req: AuthRequest, res) => {
  try {
    const loaded = await loadWorkspaceProfile(req, true)
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error })
    const profile = loaded.profile
    if (profile?.resumeUrl) {
      try {
        await del(profile.resumeUrl)
      } catch {}
    }
    await Profile.updateOne({ _id: profile._id }, { $unset: { resumeUrl: 1, resumeFilename: 1 } })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to delete resume" })
  }
})

// POST /api/profile/parse-resume - Parse resume with AI
router.post("/parse-resume", upload.single("resume"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    // Extract text from file
    let text = ""
    if (req.file.mimetype === "application/pdf") {
      const parsed = await pdfParse(req.file.buffer)
      text = parsed.text
    } else {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer })
      text = result.value
    }

    if (!text.trim()) {
      return res.status(400).json({ error: "Could not extract text from file" })
    }

    const loaded = await loadWorkspaceProfile(req, true)
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error })

    const blob = await put(
      `resumes/${loaded.workspace._id}/${req.file.originalname}`,
      req.file.buffer,
      {
        access: "public",
        contentType: req.file.mimetype,
      },
    )

    await Profile.findOneAndUpdate(
      { workspaceId: loaded.workspace._id },
      {
        workspaceId: loaded.workspace._id,
        resumeFilename: req.file.originalname,
        resumeUrl: blob.url,
      },
      { upsert: true },
    )

    // Parse with AI SDK
    const resumeSchema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
      phone: z.string(),
      address: z.string(),
      city: z.string(),
      state: z.string(),
      zipCode: z.string(),
      country: z.string(),
      linkedIn: z.string(),
      github: z.string(),
      portfolio: z.string(),
      otherSocials: z.string(),
      summary: z.string(),
      education: z.array(
        z.object({
          school: z.string(),
          degree: z.string(),
          field: z.string(),
          startDate: z.string().describe("YYYY-MM or YYYY format"),
          endDate: z.string().describe("YYYY-MM, YYYY, or 'Present'"),
          gpa: z.string(),
          description: z.string(),
        }),
      ),
      experience: z.array(
        z.object({
          company: z.string(),
          title: z.string(),
          location: z.string(),
          startDate: z.string().describe("YYYY-MM or YYYY format"),
          endDate: z.string().describe("YYYY-MM, YYYY, or 'Present'"),
          current: z.boolean().describe("true if currently working here"),
          description: z.string(),
        }),
      ),
      projects: z.array(
        z.object({
          name: z.string(),
          url: z.string(),
          description: z.string(),
          technologies: z.string(),
        }),
      ),
      skills: z.array(z.string()).describe("Flat list of individual skills"),
    })

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelId = process.env.AI_MODEL || "gpt-4o-mini"

    const result = await generateText({
      model: openai(modelId),
      experimental_output: Output.object({ schema: resumeSchema }),
      system: `You are a resume parser. Extract structured data from the resume text. Extract as much information as possible. For dates, use YYYY-MM format when month is available, otherwise YYYY. If endDate is current/present, use "Present" and set current to true. Use empty strings for missing fields.`,
      prompt: `Parse this resume:\n\n${text.substring(0, 15000)}`,
    })

    const parsed = result.experimental_output

    res.json({
      parsed,
      filename: req.file.originalname,
    })
  } catch (error: any) {
    console.error("Resume parse error:", error)
    res.status(500).json({ error: error.message || "Failed to parse resume" })
  }
})

// POST /api/profile/generate-resume - Generate custom resume for a job
router.post("/generate-resume", async (req: AuthRequest, res) => {
  try {
    const { jobTitle, company, jobDescription } = req.body
    if (!jobDescription) {
      return res.status(400).json({ error: "Job description is required" })
    }

    const loaded = await loadWorkspaceProfile(req)
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error })
    const profile = loaded.profile

    const profileData = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zipCode: profile.zipCode,
      country: profile.country,
      linkedIn: profile.linkedIn,
      github: profile.github,
      portfolio: profile.portfolio,
      summary: profile.summary,
      education: profile.education,
      experience: profile.experience,
      projects: profile.projects,
      skills: profile.skills,
    }

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelId = process.env.AI_MODEL || "gpt-4o-mini"

    const resumeContentSchema = z.object({
      summary: z.string().describe("Professional summary tailored to the job"),
      experience: z.array(
        z.object({
          title: z.string(),
          company: z.string(),
          location: z.string(),
          dates: z.string(),
          bullets: z.array(z.string()),
        }),
      ),
      education: z.array(
        z.object({
          degree: z.string(),
          school: z.string(),
          dates: z.string(),
          details: z.string(),
        }),
      ),
      skills: z.array(z.string()),
      projects: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          technologies: z.string(),
        }),
      ),
    })

    const result = await generateText({
      model: openai(modelId),
      experimental_output: Output.object({ schema: resumeContentSchema }),
      system: `You are an expert ATS resume writer creating a resume that will score 100% match against the job description. Your goal is maximum keyword alignment and relevance.

CRITICAL RULES — follow these exactly:
1. SUMMARY: Write 2-3 sentences that mirror the exact job title and top 3-4 requirements from the posting. If the job says "Senior React Developer with 5+ years", the summary must say something like "Senior React Developer with X years of experience..."
2. SKILLS: Extract EVERY technical skill, tool, framework, language, and methodology mentioned in the job description. Include them ALL in the skills section. Use the EXACT same terms the job posting uses (e.g., if they say "CI/CD" don't write "continuous integration").
3. EXPERIENCE: Rewrite each bullet point to naturally incorporate keywords from the job requirements. Every bullet should demonstrate a skill or responsibility mentioned in the job description. Use strong action verbs and include metrics (numbers, percentages, dollar values).
4. KEYWORD MATCHING: If the job mentions a technology or skill and the candidate has any related experience, find a way to include that exact keyword. For example, if the job requires "Kubernetes" and the candidate used Docker, mention both.
5. ORDER: Put the most job-relevant experience first. Lead with bullets that match the top requirements.
6. FORMAT: Use standard ATS headings only: "Professional Summary", "Experience", "Education", "Skills", "Projects". No fancy formatting.
7. TAILORING: The professional summary and experience descriptions must read as if the candidate is a perfect fit for THIS specific role. Customize everything — nothing should be generic.
8. CONCISENESS: Keep it to 1 page if possible. Every word must earn its place.`,
      prompt: `Candidate Profile:\n${JSON.stringify(profileData, null, 2)}\n\nJob Description:\n${jobDescription.substring(0, 10000)}`,
    })

    const content = result.experimental_output

    // Generate PDF with professional styling
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 40, bottom: 40, left: 55, right: 55 },
    })
    const chunks: Buffer[] = []
    doc.on("data", (chunk: Buffer) => chunks.push(chunk))

    const pdfDone = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)))
    })

    const pageWidth = 612 - 55 - 55 // LETTER width minus margins
    const lineY = () => doc.y

    function drawSectionLine() {
      const y = lineY()
      doc.save()
      doc
        .moveTo(55, y)
        .lineTo(55 + pageWidth, y)
        .lineWidth(0.75)
        .strokeColor("#333333")
        .stroke()
      doc.restore()
      doc.moveDown(0.35)
    }

    // === HEADER ===
    const fullName = `${profile.firstName} ${profile.lastName}`.trim()
    if (fullName) {
      doc
        .fontSize(22)
        .font("Helvetica-Bold")
        .fillColor("#1a1a1a")
        .text(fullName, { align: "center" })
      doc.moveDown(0.15)
    }

    // Contact line
    const contactParts = [
      profile.email,
      profile.phone,
      [profile.city, profile.state].filter(Boolean).join(", "),
    ].filter(Boolean)
    if (contactParts.length) {
      doc
        .fontSize(9.5)
        .font("Helvetica")
        .fillColor("#444444")
        .text(contactParts.join("  •  "), { align: "center" })
    }

    // Links line
    const linkParts = [profile.linkedIn, profile.github, profile.portfolio].filter(Boolean)
    if (linkParts.length) {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#555555")
        .text(linkParts.join("  •  "), { align: "center" })
    }

    doc.moveDown(0.6)
    doc
      .moveTo(55, lineY())
      .lineTo(55 + pageWidth, lineY())
      .lineWidth(1.5)
      .strokeColor("#1a1a1a")
      .stroke()
    doc.moveDown(0.5)

    // === PROFESSIONAL SUMMARY ===
    if (content.summary) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1a1a1a").text("PROFESSIONAL SUMMARY")
      drawSectionLine()
      doc.fontSize(9.5).font("Helvetica").fillColor("#333333").text(content.summary, { lineGap: 2 })
      doc.moveDown(0.6)
    }

    // === EXPERIENCE ===
    if (content.experience?.length) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1a1a1a").text("EXPERIENCE")
      drawSectionLine()
      for (let i = 0; i < content.experience.length; i++) {
        const exp = content.experience[i]
        // Title and company on one line, dates on the right
        const titleText = `${exp.title}`
        const companyText = exp.company
        const datesText = exp.dates || ""
        const locationText = exp.location || ""

        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#1a1a1a")
          .text(titleText, { continued: false })

        const metaParts = [companyText, locationText, datesText].filter(Boolean)
        doc.fontSize(9).font("Helvetica").fillColor("#555555").text(metaParts.join("  |  "))
        doc.moveDown(0.15)

        for (const bullet of exp.bullets) {
          doc.fontSize(9.5).font("Helvetica").fillColor("#333333").text(`•  ${bullet}`, {
            indent: 8,
            lineGap: 1.5,
          })
        }
        if (i < content.experience.length - 1) doc.moveDown(0.45)
      }
      doc.moveDown(0.6)
    }

    // === SKILLS ===
    if (content.skills?.length) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1a1a1a").text("SKILLS")
      drawSectionLine()
      doc
        .fontSize(9.5)
        .font("Helvetica")
        .fillColor("#333333")
        .text(content.skills.join("  •  "), { lineGap: 2 })
      doc.moveDown(0.6)
    }

    // === EDUCATION ===
    if (content.education?.length) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1a1a1a").text("EDUCATION")
      drawSectionLine()
      for (let i = 0; i < content.education.length; i++) {
        const edu = content.education[i]
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#1a1a1a").text(edu.degree)
        const eduMeta = [edu.school, edu.dates].filter(Boolean)
        doc.fontSize(9).font("Helvetica").fillColor("#555555").text(eduMeta.join("  |  "))
        if (edu.details) {
          doc.moveDown(0.1)
          doc.fontSize(9).font("Helvetica").fillColor("#444444").text(edu.details, { lineGap: 1 })
        }
        if (i < content.education.length - 1) doc.moveDown(0.3)
      }
      doc.moveDown(0.6)
    }

    // === PROJECTS ===
    if (content.projects?.length) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1a1a1a").text("PROJECTS")
      drawSectionLine()
      for (let i = 0; i < content.projects.length; i++) {
        const proj = content.projects[i]
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#1a1a1a").text(proj.name)
        if (proj.technologies) {
          doc.fontSize(8.5).font("Helvetica").fillColor("#666666").text(proj.technologies)
        }
        doc
          .fontSize(9.5)
          .font("Helvetica")
          .fillColor("#333333")
          .text(proj.description, { lineGap: 1.5 })
        if (i < content.projects.length - 1) doc.moveDown(0.3)
      }
    }

    doc.end()
    const pdfBuffer = await pdfDone

    // Upload to Vercel Blob
    const now = new Date()
    const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const safeTitle = (jobTitle || "resume")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 30)
    const safeCompany = (company || "unknown")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 20)
    const filename = `${safeTitle}_${safeCompany}_${dateStr}.pdf`

    const blob = await put(`generated-resumes/${loaded.workspace._id}/${filename}`, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
    })

    await Profile.findOneAndUpdate(
      { workspaceId: loaded.workspace._id },
      {
        $push: {
          generatedResumes: {
            jobTitle: jobTitle || "",
            company: company || "",
            url: blob.url,
            createdAt: new Date(),
          },
        },
      },
    )

    res.json({
      url: blob.url,
      filename,
      jobTitle,
      company,
    })
  } catch (error: any) {
    console.error("Generate resume error:", error)
    res.status(500).json({ error: error.message || "Failed to generate resume" })
  }
})

// POST /api/profile/detect-fields - AI-powered field detection
router.post("/detect-fields", async (req: AuthRequest, res) => {
  try {
    const { fields } = req.body
    if (!fields?.length) {
      return res.status(400).json({ error: "No fields provided" })
    }

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelId = process.env.AI_MODEL || "gpt-4o-mini"

    const result = await generateText({
      model: openai(modelId),
      system: `You are a form field analyzer. Given a list of form fields from a job application page, map each field to the correct profile data key. Return a JSON array where each item has "index" (0-based) and "profileKey" (the mapped key or null if unknown).

Valid profileKey values:
- Personal: "firstName", "lastName", "fullName", "email", "phone", "address", "city", "state", "zipCode", "country"
- Links: "linkedIn", "github", "portfolio"
- Professional: "summary"
- Files: "resumeFile", "coverLetterFile"
- Equal Employment: "ee.authorizedToWork", "ee.disability", "ee.gender", "ee.requireSponsorship", "ee.lgbtq", "ee.veteran", "ee.race", "ee.hispanicOrLatino", "ee.sexualOrientation"
- null if you cannot determine what the field is for

Return ONLY a JSON array like: [{"index":0,"profileKey":"firstName"},{"index":1,"profileKey":null}]`,
      prompt: JSON.stringify(
        fields.slice(0, 50).map((f: any, i: number) => ({
          index: i,
          label: f.label,
          type: f.type,
          name: f.name,
          id: f.id,
        })),
      ),
    })

    let mappings: any[] = []
    try {
      const text = result.text
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) mappings = JSON.parse(jsonMatch[0])
    } catch {}

    res.json({ mappings })
  } catch (error: any) {
    console.error("Field detection error:", error)
    res.status(500).json({ error: error.message || "Failed to detect fields" })
  }
})

// POST /api/profile/generate-answer - Generate AI answer for custom job questions
router.post("/generate-answer", async (req: AuthRequest, res) => {
  try {
    const { question, jobTitle, company, jobDescription } = req.body
    if (!question) {
      return res.status(400).json({ error: "Question is required" })
    }

    const loaded = await loadWorkspaceProfile(req)
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error })
    const profile = loaded.profile

    const profileSummary = profile
      ? [
          profile.firstName && profile.lastName
            ? `Name: ${profile.firstName} ${profile.lastName}`
            : "",
          profile.summary ? `Summary: ${profile.summary}` : "",
          profile.experience?.length
            ? `Experience: ${profile.experience.map((e: any) => `${e.title} at ${e.company}`).join(", ")}`
            : "",
          profile.education?.length
            ? `Education: ${profile.education.map((e: any) => `${e.degree} in ${e.field} from ${e.school}`).join(", ")}`
            : "",
          profile.skills?.length ? `Skills: ${profile.skills.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : ""

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelId = process.env.AI_MODEL || "gpt-4o-mini"

    const result = await generateText({
      model: openai(modelId),
      system: `You are helping a job applicant answer application questions. Write concise, natural, human-sounding answers — not robotic or overly formal. The tone should be professional but conversational, like a real person wrote it. Keep answers brief (2-4 sentences for short questions, up to a paragraph for longer ones). Use first person. Don't use buzzwords or clichés. Be specific and reference the candidate's actual experience where relevant.`,
      prompt: `Candidate profile:\n${profileSummary || "No profile available"}\n\n${jobTitle ? `Job: ${jobTitle}` : ""}${company ? ` at ${company}` : ""}\n${jobDescription ? `\nJob context (excerpt):\n${jobDescription.substring(0, 3000)}` : ""}\n\nQuestion: "${question}"\n\nWrite a natural, human-sounding answer:`,
    })

    res.json({ answer: result.text.trim() })
  } catch (error: any) {
    console.error("Generate answer error:", error)
    res.status(500).json({ error: error.message || "Failed to generate answer" })
  }
})

// POST /api/profile/generate-cover-letter - Generate a cover letter for a job
router.post("/generate-cover-letter", async (req: AuthRequest, res) => {
  try {
    const { jobTitle, company, jobDescription } = req.body
    if (!jobDescription) {
      return res.status(400).json({ error: "Job description is required" })
    }

    const loaded = await loadWorkspaceProfile(req)
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error })
    const profile = loaded.profile

    const profileSummary = [
      `Name: ${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
      profile.email ? `Email: ${profile.email}` : "",
      profile.phone ? `Phone: ${profile.phone}` : "",
      profile.summary ? `Summary: ${profile.summary}` : "",
      profile.experience?.length
        ? `Experience:\n${(profile.experience as any[]).map((e: any) => `- ${e.title} at ${e.company} (${e.startDate}–${e.endDate}): ${e.description || ""}`).join("\n")}`
        : "",
      profile.education?.length
        ? `Education:\n${(profile.education as any[]).map((e: any) => `- ${e.degree} in ${e.field} from ${e.school}`).join("\n")}`
        : "",
      profile.skills?.length ? `Skills: ${profile.skills.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelId = process.env.AI_MODEL || "gpt-4o-mini"

    const result = await generateText({
      model: openai(modelId),
      system: `You are a professional cover letter writer. Write a concise, compelling cover letter that:
- Sounds natural and human (not robotic or template-like)
- Is addressed to the hiring manager at the specific company
- Opens with a strong hook that shows genuine interest in the role
- Highlights 2-3 most relevant experiences/skills that match the job requirements
- Uses specific examples and metrics where possible
- Shows knowledge of the company (reference something from the job description)
- Closes with enthusiasm and a call to action
- Is 3-4 paragraphs, about 250-350 words
- Does NOT include the candidate's address or date header — just the letter body
- Uses first person and professional but warm tone`,
      prompt: `Candidate:\n${profileSummary}\n\nJob: ${jobTitle || "Position"} at ${company || "the company"}\n\nJob Description:\n${jobDescription.substring(0, 8000)}\n\nWrite the cover letter:`,
    })

    res.json({ coverLetter: result.text.trim() })
  } catch (error: any) {
    console.error("Cover letter error:", error)
    res.status(500).json({ error: error.message || "Failed to generate cover letter" })
  }
})

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    cb(null, allowed.includes(file.mimetype))
  },
})

// POST /api/profile/chat - Chat with crewjobs AI
router.post("/chat", chatUpload.array("files", 5), async (req: AuthRequest, res) => {
  try {
    const { message } = req.body
    if (!message && (!req.files || (req.files as Express.Multer.File[]).length === 0)) {
      return res.status(400).json({ error: "Message or file is required" })
    }

    const loaded = await loadWorkspaceProfile(req)
    const profile = loaded.ok ? loaded.profile : null

    const profileSummary = profile
      ? [
          profile.firstName && profile.lastName
            ? `Name: ${profile.firstName} ${profile.lastName}`
            : "",
          profile.summary ? `Summary: ${profile.summary}` : "",
          profile.experience?.length
            ? `Experience: ${(profile.experience as any[]).map((e: any) => `${e.title} at ${e.company}`).join(", ")}`
            : "",
          profile.education?.length
            ? `Education: ${(profile.education as any[]).map((e: any) => `${e.degree} in ${e.field} from ${e.school}`).join(", ")}`
            : "",
          profile.skills?.length ? `Skills: ${profile.skills.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : ""

    // Process attached files
    const fileContents: string[] = []
    const files = (req.files as Express.Multer.File[]) || []
    for (const file of files) {
      try {
        if (file.mimetype === "application/pdf") {
          const parsed = await pdfParse(file.buffer)
          fileContents.push(`[File: ${file.originalname}]\n${parsed.text.substring(0, 10000)}`)
        } else if (
          file.mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          const result = await mammoth.extractRawText({ buffer: file.buffer })
          fileContents.push(`[File: ${file.originalname}]\n${result.value.substring(0, 10000)}`)
        } else if (file.mimetype === "text/plain") {
          fileContents.push(
            `[File: ${file.originalname}]\n${file.buffer.toString("utf-8").substring(0, 10000)}`,
          )
        } else if (file.mimetype.startsWith("image/")) {
          fileContents.push(
            `[Image attached: ${file.originalname} (${file.mimetype}, ${Math.round(file.size / 1024)}KB)]`,
          )
        }
      } catch {
        fileContents.push(`[File: ${file.originalname} - could not read contents]`)
      }
    }

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const modelId = process.env.AI_MODEL || "gpt-4o-mini"

    const attachmentText =
      fileContents.length > 0 ? `\n\nAttached files:\n${fileContents.join("\n\n")}` : ""

    const result = await generateText({
      model: openai(modelId),
      system: `You are crewjobs AI, a helpful career assistant. You help with resume writing, interview preparation, cover letters, job application questions, and career advice. You have access to the user's profile and should reference their actual experience, skills, and education when relevant. Be concise, practical, and encouraging. If the user asks to generate a resume or cover letter, do so in full. Format your responses with markdown when appropriate.`,
      prompt: `User profile:\n${profileSummary || "No profile available"}\n\nUser message: ${message || "Please review the attached file(s)."}${attachmentText}`,
    })

    res.json({ reply: result.text.trim() })
  } catch (error: any) {
    console.error("Chat error:", error)
    res.status(500).json({ error: error.message || "Failed to generate response" })
  }
})

export { router as profileRouter }
