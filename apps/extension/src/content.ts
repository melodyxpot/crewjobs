import { scrapeJobData } from "./scraper"
import {
  detectFormFields,
  getProfileValue,
  fillField,
  attachFileToInput,
  DetectedField,
} from "./detector"
import {
  login,
  logout,
  createApplication,
  saveScrapedJob,
  getWorkspaces,
  isLoggedIn,
  getUser,
  getSettings,
  getProfile,
  getResumeInfo,
  generateResume,
  generateAnswer,
  getExtensionSettings,
  setExtensionSettings,
  generateCoverLetter,
  ExtSettings,
} from "./api"
import { jsPDF } from "jspdf"

let sidebarRoot: HTMLElement | null = null
let fab: HTMLElement | null = null
let isOpen = false
let detectedFields: DetectedField[] = []
let cachedProfile: any = null
let extSettings: ExtSettings = { autofillEnabled: true, saveResumeInApp: false }
let lastGeneratedResumeUrl: string | null = null

// Create floating action button on page load
function createFab() {
  if (fab) return
  fab = document.createElement("button")
  fab.id = "crewjobs-fab"
  fab.innerHTML = "📋"
  fab.title = "crewjobs - Track this job"
  fab.addEventListener("click", toggleSidebar)
  document.body.appendChild(fab)
}

function createSidebar() {
  if (sidebarRoot) return
  sidebarRoot = document.createElement("div")
  sidebarRoot.id = "crewjobs-sidebar-root"
  document.body.appendChild(sidebarRoot)
}

function toggleSidebar() {
  if (!sidebarRoot) createSidebar()
  isOpen = !isOpen
  if (isOpen) {
    sidebarRoot!.classList.add("crewjobs-open")
    fab?.classList.add("crewjobs-fab-hidden")
    renderSidebar()
  } else {
    sidebarRoot!.classList.remove("crewjobs-open")
    fab?.classList.remove("crewjobs-fab-hidden")
  }
}

function closeSidebar() {
  isOpen = false
  sidebarRoot?.classList.remove("crewjobs-open")
  fab?.classList.remove("crewjobs-fab-hidden")
}

async function renderSidebar() {
  if (!sidebarRoot) return
  const loggedIn = await isLoggedIn()
  if (!loggedIn) {
    renderLogin()
  } else {
    const user = await getUser()
    renderMain(user)
  }
}

function renderLogin() {
  if (!sidebarRoot) return

  sidebarRoot.innerHTML = `
    <div class="crewjobs-sidebar">
      <div class="crewjobs-header">
        <div class="crewjobs-header-title">📋 crewjobs</div>
        <button class="crewjobs-close-btn" id="crewjobs-close">&times;</button>
      </div>
      <div class="crewjobs-body">
        <div class="crewjobs-login-container">
          <h2>Sign In</h2>
          <p>Sign in to your crewjobs account to start tracking job applications.</p>
          <div class="crewjobs-login-form">
            <div class="crewjobs-form-group">
              <label>Email or username</label>
              <input type="text" id="crewjobs-email" placeholder="you@example.com or username" autocomplete="username" />
            </div>
            <div class="crewjobs-form-group">
              <label>Password</label>
              <input type="password" id="crewjobs-password" placeholder="Password" />
            </div>
            <div id="crewjobs-login-error" class="crewjobs-message crewjobs-message-error" style="display:none"></div>
            <button class="crewjobs-btn crewjobs-btn-primary" id="crewjobs-login-btn">Sign In</button>
          </div>
        </div>
      </div>
    </div>
  `

  bindClose()

  const loginBtn = sidebarRoot.querySelector("#crewjobs-login-btn") as HTMLButtonElement
  const emailInput = sidebarRoot.querySelector("#crewjobs-email") as HTMLInputElement
  const passwordInput = sidebarRoot.querySelector("#crewjobs-password") as HTMLInputElement
  const errorDiv = sidebarRoot.querySelector("#crewjobs-login-error") as HTMLElement

  setTimeout(() => emailInput.focus(), 50)

  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim()
    const password = passwordInput.value
    if (!email || !password) {
      showError(errorDiv, "Please enter email and password")
      return
    }

    loginBtn.disabled = true
    loginBtn.textContent = "Signing in..."
    errorDiv.style.display = "none"

    try {
      await login(email, password)
      renderSidebar()
    } catch (err: any) {
      showError(errorDiv, err.message)
      loginBtn.disabled = false
      loginBtn.textContent = "Sign In"
    }
  })

  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginBtn.click()
  })
  emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") passwordInput.focus()
  })
}

function selectedWorkspaceId() {
  const select = sidebarRoot?.querySelector("#crewjobs-workspace") as HTMLSelectElement | null
  return select?.value || undefined
}

async function renderMain(user: any) {
  if (!sidebarRoot) return

  // Profile is loaded after the workspace list is known.
  try {
    extSettings = await getExtensionSettings()
  } catch {}

  // Scan fields
  detectedFields = detectFormFields()

  const scraped = scrapeJobData()
  let settings: any = null
  try {
    const result = await getSettings()
    settings = result.settings
  } catch {}

  const jobTypes = ["Full-time", "Part-time", "Contract", "Internship", "Freelance"]
  const workLocations = settings?.workLocationOptions || ["Remote", "Hybrid", "Onsite"]
  const now = new Date().toISOString().slice(0, 16)
  const followUpDate = new Date()
  followUpDate.setDate(followUpDate.getDate() + (settings?.followUpOffsetDays || 7))
  const followUp = followUpDate.toISOString().split("T")[0]
  const hasScraped = !!(scraped.title || scraped.company)
  const canPickWorkspace =
    !!user?.isSuperAdmin ||
    ["leader", "moderator", "caller", "finance", "developer"].includes(user?.role)
  let workspaces: { _id: string; name: string }[] = []
  if (canPickWorkspace) {
    try {
      const result = await getWorkspaces()
      workspaces = result.workspaces || []
    } catch {}
  }
  const presetWorkspaceId = workspaces.length === 1 ? workspaces[0]._id : undefined
  try {
    const result = await getProfile(presetWorkspaceId)
    cachedProfile = result.profile
  } catch {
    cachedProfile = null
  }

  const workspaceField = workspaces.length
    ? `<div class="crewjobs-form-group">
          <label>Workspace</label>
          <select id="crewjobs-workspace">
            ${workspaces.length > 1 ? `<option value="" selected>Choose a workspace</option>` : ""}
            ${workspaces.map((workspace) => `<option value="${workspace._id}" ${workspaces.length === 1 ? "selected" : ""}>${escapeHtml(workspace.name)}</option>`).join("")}
          </select>
        </div>`
    : ""

  sidebarRoot.innerHTML = `
    <div class="crewjobs-sidebar">
      <div class="crewjobs-header">
        <div class="crewjobs-header-title">📋 crewjobs</div>
        <button class="crewjobs-close-btn" id="crewjobs-close">&times;</button>
      </div>
      <div class="crewjobs-user-bar">
        <span class="crewjobs-user-email">${escapeHtml(user?.username || user?.email || "User")}</span>
        <button class="crewjobs-signout-btn" id="crewjobs-logout">Sign Out</button>
      </div>
      
      <div class="crewjobs-tabs">
        <button class="crewjobs-tab crewjobs-tab-active" data-tab="autofill">Auto-Fill</button>
        <button class="crewjobs-tab" data-tab="save">Save Job</button>
        <button class="crewjobs-tab" data-tab="settings">⚙️</button>
      </div>
      
      <div class="crewjobs-body" id="crewjobs-tab-autofill">
        <div class="crewjobs-section-title">Custom Resume</div>
        <p style="font-size:11px;color:#888;margin:0 0 8px">Generate an ATS-optimized resume tailored to this job</p>
        <button class="crewjobs-btn crewjobs-btn-secondary" id="crewjobs-generate-resume" style="margin-bottom:4px">📄 Generate Custom Resume</button>
        <div id="crewjobs-generate-result"></div>
        
        <div style="margin-top:8px">
          <div class="crewjobs-section-title">Cover Letter</div>
          <p style="font-size:11px;color:#888;margin:0 0 8px">Generate a cover letter tailored to this job</p>
          <button class="crewjobs-btn crewjobs-btn-secondary" id="crewjobs-generate-cover-letter" style="margin-bottom:4px">✉️ Generate Cover Letter</button>
          <div id="crewjobs-cover-letter-result"></div>
        </div>
        
        <div class="crewjobs-divider"></div>
        
        <div id="crewjobs-autofill-section">
          ${renderAutofillSection()}
        </div>
      </div>
      
      <div class="crewjobs-body" id="crewjobs-tab-save" style="display:none">
        ${hasScraped ? '<div class="crewjobs-scraped-bar">Scraped from page <span class="crewjobs-scraped-badge">Auto-detected</span></div>' : ""}
        <div id="crewjobs-message-area"></div>
        
        <div class="crewjobs-form-group">
          <label>Company *</label>
          <input type="text" id="crewjobs-company" value="${escapeHtml(scraped.company)}" />
        </div>
        <div class="crewjobs-form-group">
          <label>Job Title *</label>
          <input type="text" id="crewjobs-title" value="${escapeHtml(scraped.title)}" />
        </div>
        <div class="crewjobs-form-group">
          <label>Job Link</label>
          <input type="url" id="crewjobs-link" value="${escapeHtml(scraped.link)}" />
        </div>
        <div class="crewjobs-form-group">
          <label>Platform</label>
          <input type="text" id="crewjobs-platform" value="${escapeHtml(scraped.platform)}" />
        </div>
        <div class="crewjobs-form-row">
          <div class="crewjobs-form-group">
            <label>Job Type</label>
            <select id="crewjobs-jobtype">
              <option value="">—</option>
              ${jobTypes.map((t: string) => `<option value="${t}" ${t === scraped.jobType ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
          <div class="crewjobs-form-group">
            <label>Work Location</label>
            <select id="crewjobs-worklocation">
              <option value="">—</option>
              ${workLocations.map((w: string) => `<option value="${w}" ${w === scraped.workLocation ? "selected" : ""}>${w}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="crewjobs-form-group">
          <label>Location</label>
          <input type="text" id="crewjobs-location" value="${escapeHtml(scraped.location)}" />
        </div>
        <div class="crewjobs-divider"></div>
        <div class="crewjobs-form-row">
          <div class="crewjobs-form-group">
            <label>Applied Date</label>
            <input type="datetime-local" id="crewjobs-appliedat" value="${now}" />
          </div>
          <div class="crewjobs-form-group">
            <label>Follow-up</label>
            <input type="date" id="crewjobs-followup" value="${followUp}" />
          </div>
        </div>
        <div class="crewjobs-form-group">
          <label>Notes</label>
          <textarea id="crewjobs-notes" rows="2" placeholder="Optional notes..."></textarea>
        </div>
        ${workspaceField}
        <button class="crewjobs-btn crewjobs-btn-primary" id="crewjobs-save">Save Application</button>
        <button class="crewjobs-btn crewjobs-btn-outline" id="crewjobs-save-job" style="margin-top:8px">Save remote job</button>
      </div>
      
      <div class="crewjobs-body" id="crewjobs-tab-settings" style="display:none">
        <div class="crewjobs-section-title" style="margin-bottom:16px">Extension Settings</div>
        
        <div class="crewjobs-settings-row">
          <div>
            <div style="font-size:13px;font-weight:600;color:#171717">Auto-Fill</div>
            <div style="font-size:11px;color:#888;margin-top:2px">Detect form fields and show the auto-fill panel</div>
          </div>
          <label class="crewjobs-toggle">
            <input type="checkbox" id="crewjobs-setting-autofill" ${extSettings.autofillEnabled ? "checked" : ""} />
            <span class="crewjobs-toggle-slider"></span>
          </label>
        </div>
        
        <div class="crewjobs-settings-row">
          <div>
            <div style="font-size:13px;font-weight:600;color:#171717">Save Resume in Application</div>
            <div style="font-size:11px;color:#888;margin-top:2px">Save generated resume URL when saving a job application</div>
          </div>
          <label class="crewjobs-toggle">
            <input type="checkbox" id="crewjobs-setting-save-resume" ${extSettings.saveResumeInApp ? "checked" : ""} />
            <span class="crewjobs-toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  `

  bindClose()

  // Tab switching
  const tabs = sidebarRoot.querySelectorAll(".crewjobs-tab")
  const allTabPanels = ["#crewjobs-tab-autofill", "#crewjobs-tab-save", "#crewjobs-tab-settings"]
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("crewjobs-tab-active"))
      tab.classList.add("crewjobs-tab-active")
      const tabName = tab.getAttribute("data-tab")
      allTabPanels.forEach((id) => {
        const panel = sidebarRoot!.querySelector(id) as HTMLElement
        if (panel) panel.style.display = id === `#crewjobs-tab-${tabName}` ? "" : "none"
      })
    })
  })

  // Settings toggles
  const autofillToggle = sidebarRoot.querySelector("#crewjobs-setting-autofill") as HTMLInputElement
  if (autofillToggle) {
    autofillToggle.addEventListener("change", async () => {
      extSettings.autofillEnabled = autofillToggle.checked
      await setExtensionSettings(extSettings)
      refreshAutofillSection()
    })
  }
  const saveResumeToggle = sidebarRoot.querySelector(
    "#crewjobs-setting-save-resume",
  ) as HTMLInputElement
  if (saveResumeToggle) {
    saveResumeToggle.addEventListener("change", async () => {
      extSettings.saveResumeInApp = saveResumeToggle.checked
      await setExtensionSettings(extSettings)
    })
  }

  // Logout
  sidebarRoot.querySelector("#crewjobs-logout")!.addEventListener("click", async () => {
    await logout()
    renderSidebar()
  })

  // Bind scan + autofill-all buttons
  bindAutofillEvents()
  sidebarRoot.querySelector("#crewjobs-workspace")?.addEventListener("change", async () => {
    try {
      const result = await getProfile(selectedWorkspaceId())
      cachedProfile = result.profile
    } catch {
      cachedProfile = null
    }
    refreshAutofillSection()
  })

  // Generate custom resume
  sidebarRoot.querySelector("#crewjobs-generate-resume")?.addEventListener("click", async () => {
    const btn = sidebarRoot!.querySelector("#crewjobs-generate-resume") as HTMLButtonElement
    const resultDiv = sidebarRoot!.querySelector("#crewjobs-generate-result") as HTMLElement

    btn.disabled = true
    btn.textContent = "Generating..."
    resultDiv.innerHTML =
      '<div style="font-size:11px;color:#888;margin-top:8px">⏳ AI is generating your custom resume...</div>'

    try {
      const scraped = scrapeJobData()
      const jobDescription = document.body.innerText.substring(0, 15000)

      const result = await generateResume({
        jobTitle: scraped.title,
        company: scraped.company,
        jobDescription,
        workspaceId: selectedWorkspaceId(),
      })

      lastGeneratedResumeUrl = result.url
      resultDiv.innerHTML = `
        <div class="crewjobs-message crewjobs-message-success" style="margin-top:8px">
          ✓ Resume generated!
          <a href="${escapeHtml(result.url)}" target="_blank" download="${escapeHtml(result.filename)}" 
             style="display:block;margin-top:6px;color:#1e40af;font-weight:600;text-decoration:underline">
            📥 Download Resume
          </a>
        </div>
      `
    } catch (err: any) {
      resultDiv.innerHTML = `<div class="crewjobs-message crewjobs-message-error" style="margin-top:8px">${escapeHtml(err.message)}</div>`
    }

    btn.disabled = false
    btn.textContent = "📄 Generate Custom Resume"
  })

  // Generate cover letter
  sidebarRoot
    .querySelector("#crewjobs-generate-cover-letter")
    ?.addEventListener("click", async () => {
      const btn = sidebarRoot!.querySelector("#crewjobs-generate-cover-letter") as HTMLButtonElement
      const resultDiv = sidebarRoot!.querySelector("#crewjobs-cover-letter-result") as HTMLElement

      btn.disabled = true
      btn.textContent = "Generating..."
      resultDiv.innerHTML =
        '<div style="font-size:11px;color:#888;margin-top:8px">⏳ AI is writing your cover letter...</div>'

      try {
        const scraped = scrapeJobData()
        const jobDescription = document.body.innerText.substring(0, 12000)

        const result = await generateCoverLetter({
          jobTitle: scraped.title,
          company: scraped.company,
          jobDescription,
          workspaceId: selectedWorkspaceId(),
        })

        resultDiv.innerHTML = `
        <div class="crewjobs-message crewjobs-message-success" style="margin-top:8px">
          ✓ Cover letter generated!
          <div style="margin-top:8px;padding:10px;background:#f9fafb;border:1px solid #e5e5e5;border-radius:6px;font-size:12px;line-height:1.6;color:#333;max-height:200px;overflow-y:auto;white-space:pre-wrap">${escapeHtml(result.coverLetter)}</div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="crewjobs-btn crewjobs-btn-outline" id="crewjobs-copy-cover-letter" style="flex:1;font-size:12px">📋 Copy to Clipboard</button>
            <button class="crewjobs-btn crewjobs-btn-outline" id="crewjobs-download-cover-letter-pdf" style="flex:1;font-size:12px">📥 Download PDF</button>
          </div>
        </div>
      `

        sidebarRoot!.querySelector("#crewjobs-copy-cover-letter")?.addEventListener("click", () => {
          navigator.clipboard.writeText(result.coverLetter)
          const copyBtn = sidebarRoot!.querySelector(
            "#crewjobs-copy-cover-letter",
          ) as HTMLButtonElement
          copyBtn.textContent = "✓ Copied!"
          setTimeout(() => {
            copyBtn.textContent = "📋 Copy to Clipboard"
          }, 2000)
        })

        sidebarRoot!
          .querySelector("#crewjobs-download-cover-letter-pdf")
          ?.addEventListener("click", () => {
            const doc = new jsPDF()
            const margin = 20
            const pageWidth = doc.internal.pageSize.getWidth()
            const maxWidth = pageWidth - margin * 2

            doc.setFont("helvetica", "normal")
            doc.setFontSize(12)

            const lines = doc.splitTextToSize(result.coverLetter, maxWidth)
            const lineHeight = 7
            let y = margin

            for (const line of lines) {
              if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage()
                y = margin
              }
              doc.text(line, margin, y)
              y += lineHeight
            }

            const filename = `Cover_Letter_${scraped.company ? scraped.company.replace(/\s+/g, "_") : "Job"}.pdf`
            const pdfBlob = doc.output("blob")
            const url = URL.createObjectURL(pdfBlob)
            const a = document.createElement("a")
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          })
      } catch (err: any) {
        resultDiv.innerHTML = `<div class="crewjobs-message crewjobs-message-error" style="margin-top:8px">${escapeHtml(err.message)}</div>`
      }

      btn.disabled = false
      btn.textContent = "✉️ Generate Cover Letter"
    })

  // Save application
  const saveBtn = sidebarRoot.querySelector("#crewjobs-save") as HTMLButtonElement
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const company = (
        sidebarRoot!.querySelector("#crewjobs-company") as HTMLInputElement
      ).value.trim()
      const title = (sidebarRoot!.querySelector("#crewjobs-title") as HTMLInputElement).value.trim()
      const msgArea = sidebarRoot!.querySelector("#crewjobs-message-area") as HTMLElement

      if (!company || !title) {
        msgArea.innerHTML =
          '<div class="crewjobs-message crewjobs-message-error">Company and job title are required.</div>'
        return
      }
      const workspaceSelect = sidebarRoot!.querySelector(
        "#crewjobs-workspace",
      ) as HTMLSelectElement | null
      if (workspaceSelect && !workspaceSelect.value) {
        msgArea.innerHTML =
          '<div class="crewjobs-message crewjobs-message-error">Choose a workspace.</div>'
        return
      }

      saveBtn.disabled = true
      saveBtn.textContent = "Saving..."
      msgArea.innerHTML = ""

      try {
        await createApplication({
          company,
          title,
          link: (sidebarRoot!.querySelector("#crewjobs-link") as HTMLInputElement).value || null,
          platform:
            (sidebarRoot!.querySelector("#crewjobs-platform") as HTMLInputElement).value || "Other",
          status: settings?.defaultStatus || "Applied",
          jobType:
            (sidebarRoot!.querySelector("#crewjobs-jobtype") as HTMLSelectElement).value || null,
          workLocation:
            (sidebarRoot!.querySelector("#crewjobs-worklocation") as HTMLSelectElement).value ||
            null,
          location:
            (sidebarRoot!.querySelector("#crewjobs-location") as HTMLInputElement).value || null,
          appliedAt: new Date(
            (sidebarRoot!.querySelector("#crewjobs-appliedat") as HTMLInputElement).value,
          ).toISOString(),
          followUpAt: (sidebarRoot!.querySelector("#crewjobs-followup") as HTMLInputElement).value
            ? new Date(
                (sidebarRoot!.querySelector("#crewjobs-followup") as HTMLInputElement).value,
              ).toISOString()
            : null,
          notes:
            (sidebarRoot!.querySelector("#crewjobs-notes") as HTMLTextAreaElement).value || null,
          resume:
            extSettings.saveResumeInApp && lastGeneratedResumeUrl ? lastGeneratedResumeUrl : null,
          workspaceId:
            (sidebarRoot!.querySelector("#crewjobs-workspace") as HTMLSelectElement | null)
              ?.value || undefined,
        })

        msgArea.innerHTML =
          '<div class="crewjobs-message crewjobs-message-success">✓ Application saved!</div>'
        saveBtn.textContent = "Saved!"
        setTimeout(() => {
          saveBtn.disabled = false
          saveBtn.textContent = "Save Application"
        }, 2000)
      } catch (err: any) {
        msgArea.innerHTML = `<div class="crewjobs-message crewjobs-message-error">${escapeHtml(err.message)}</div>`
        saveBtn.disabled = false
        saveBtn.textContent = "Save Application"
      }
    })
  }

  const saveJobBtn = sidebarRoot.querySelector("#crewjobs-save-job") as HTMLButtonElement
  if (saveJobBtn) {
    saveJobBtn.addEventListener("click", async () => {
      const company = (
        sidebarRoot!.querySelector("#crewjobs-company") as HTMLInputElement
      ).value.trim()
      const title = (sidebarRoot!.querySelector("#crewjobs-title") as HTMLInputElement).value.trim()
      const workLocation = (
        sidebarRoot!.querySelector("#crewjobs-worklocation") as HTMLSelectElement
      ).value
      const msgArea = sidebarRoot!.querySelector("#crewjobs-message-area") as HTMLElement

      if (!company || !title) {
        msgArea.innerHTML =
          '<div class="crewjobs-message crewjobs-message-error">Company and job title are required.</div>'
        return
      }
      if (workLocation !== "Remote") {
        msgArea.innerHTML =
          '<div class="crewjobs-message crewjobs-message-error">Only remote jobs can be saved to the job board.</div>'
        return
      }
      const workspaceSelect = sidebarRoot!.querySelector(
        "#crewjobs-workspace",
      ) as HTMLSelectElement | null
      if (workspaceSelect && !workspaceSelect.value) {
        msgArea.innerHTML =
          '<div class="crewjobs-message crewjobs-message-error">Choose a workspace.</div>'
        return
      }

      saveJobBtn.disabled = true
      saveJobBtn.textContent = "Saving..."
      try {
        await saveScrapedJob({
          company,
          title,
          link: (sidebarRoot!.querySelector("#crewjobs-link") as HTMLInputElement).value || null,
          platform:
            (sidebarRoot!.querySelector("#crewjobs-platform") as HTMLInputElement).value || "Other",
          jobType:
            (sidebarRoot!.querySelector("#crewjobs-jobtype") as HTMLSelectElement).value || null,
          location:
            (sidebarRoot!.querySelector("#crewjobs-location") as HTMLInputElement).value || null,
          notes:
            (sidebarRoot!.querySelector("#crewjobs-notes") as HTMLTextAreaElement).value || null,
          workLocation: "Remote",
          workspaceId:
            (sidebarRoot!.querySelector("#crewjobs-workspace") as HTMLSelectElement | null)
              ?.value || undefined,
        })
        msgArea.innerHTML =
          '<div class="crewjobs-message crewjobs-message-success">✓ Remote job saved for assignment.</div>'
        saveJobBtn.textContent = "Saved!"
        setTimeout(() => {
          saveJobBtn.disabled = false
          saveJobBtn.textContent = "Save remote job"
        }, 2000)
      } catch (err: any) {
        msgArea.innerHTML = `<div class="crewjobs-message crewjobs-message-error">${escapeHtml(err.message)}</div>`
        saveJobBtn.disabled = false
        saveJobBtn.textContent = "Save remote job"
      }
    })
  }

  // Bind AI buttons for initial render
  bindAIButtons()
}

function isCustomQuestion(field: DetectedField): boolean {
  if (field.profileKey) return false
  if (field.type !== "text" && field.type !== "textarea") return false
  const label = field.label.toLowerCase()
  // Skip generic unlabeled fields
  if (label.startsWith("unlabeled")) return false
  // Consider it a question if label is long enough to be a question or contains question words
  if (label.length > 20) return true
  if (label.includes("?")) return true
  if (
    label.match(
      /^(why|how|what|describe|tell|explain|please|are you|do you|have you|would you|can you)/,
    )
  )
    return true
  return false
}

function renderAutofillSection(): string {
  if (extSettings.autofillEnabled) {
    return `
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button class="crewjobs-btn crewjobs-btn-primary" id="crewjobs-autofill-all" style="flex:1">
          ✨ Auto-fill All
        </button>
        <button class="crewjobs-btn crewjobs-btn-outline" id="crewjobs-scan" style="width:auto;padding:9px 14px" title="Re-scan fields">
          🔄
        </button>
      </div>
      ${!cachedProfile ? '<div class="crewjobs-message crewjobs-message-error">Could not load profile. Please set up your profile first.</div>' : ""}
      <div class="crewjobs-field-count">${detectedFields.length} field${detectedFields.length !== 1 ? "s" : ""} detected</div>
      <div id="crewjobs-fields-list">
        ${renderFieldsList(detectedFields, false)}
      </div>
    `
  }
  return `
    <div id="crewjobs-fields-list">
      ${renderFieldsListDisabled(detectedFields)}
    </div>
    ${detectedFields.filter((f) => isCustomQuestion(f)).length === 0 ? '<div style="font-size:12px;color:#888;text-align:center;padding:12px 0">Auto-fill is disabled. Enable it in Settings (⚙️).</div>' : ""}
  `
}

function refreshAutofillSection() {
  if (!sidebarRoot) return
  const section = sidebarRoot.querySelector("#crewjobs-autofill-section")
  if (section) {
    section.innerHTML = renderAutofillSection()
    bindAutofillEvents()
    bindAIButtons()
  }
}

function bindAutofillEvents() {
  if (!sidebarRoot) return

  sidebarRoot.querySelector("#crewjobs-scan")?.addEventListener("click", () => {
    detectedFields = detectFormFields()
    refreshAutofillSection()
  })

  sidebarRoot.querySelector("#crewjobs-autofill-all")?.addEventListener("click", async () => {
    if (!cachedProfile) return

    const btn = sidebarRoot!.querySelector("#crewjobs-autofill-all") as HTMLButtonElement
    btn.disabled = true
    btn.textContent = "Filling..."

    for (const field of detectedFields) {
      if (field.filled || !field.profileKey) continue

      if (field.profileKey === "resumeFile" || field.profileKey === "coverLetterFile") {
        try {
          const resumeInfo = await getResumeInfo(selectedWorkspaceId())
          if (resumeInfo.url) {
            const success = await attachFileToInput(
              field.element as HTMLInputElement,
              resumeInfo.url,
              resumeInfo.filename || "resume.pdf",
            )
            if (success) field.filled = true
          }
        } catch {}
      } else {
        const value = getProfileValue(cachedProfile, field.profileKey)
        if (value) {
          const success = fillField(field, value)
          if (success) field.filled = true
        }
      }
    }

    refreshAutofillSection()
  })
}

function renderFieldsListDisabled(fields: DetectedField[]): string {
  const filtered = fields.filter(
    (f) => f.type !== "select" && (f.type === "text" || f.type === "textarea"),
  )
  if (filtered.length === 0) return ""

  return filtered
    .map((f) => {
      const idx = fields.indexOf(f)
      const isQuestion = isCustomQuestion(f)
      const statusIcon = f.filled ? "✅" : isQuestion ? "💬" : "⬜"
      const labelClass = f.filled
        ? "crewjobs-field-label crewjobs-field-filled"
        : "crewjobs-field-label"
      const typeLabel = "✎ text"
      const matchDot = isQuestion
        ? '<span class="crewjobs-match-dot" style="background:#f59e0b"></span>'
        : '<span class="crewjobs-unmatch-dot"></span>'

      const aiBtn =
        isQuestion && !f.filled
          ? `<div class="crewjobs-field-actions"><button class="crewjobs-ai-btn" data-field-idx="${idx}" title="Generate AI answer">✨ AI</button></div>`
          : ""
      const answerBlock = f.aiAnswer
        ? `<div style="margin:4px 0 8px 24px;padding:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:11px;line-height:1.5;color:#166534;white-space:pre-wrap">${escapeHtml(f.aiAnswer)}</div>`
        : ""

      return `
      <div class="crewjobs-field-row${isQuestion ? " crewjobs-field-row-question" : ""}">
        <span class="crewjobs-field-status">${statusIcon}</span>
        <div class="crewjobs-field-info">
          <span class="${labelClass}">${escapeHtml(f.label)}</span>
          <span class="crewjobs-field-type">${typeLabel} ${matchDot}</span>
        </div>
        ${aiBtn}
      </div>
      ${answerBlock}
    `
    })
    .join("")
}

function renderFieldsList(fields: DetectedField[], questionsOnly = false): string {
  if (fields.length === 0) {
    return '<div style="font-size:12px;color:#888;text-align:center;padding:20px 0">No form fields detected on this page.<br>Navigate to a job application form and click 🔄</div>'
  }

  const filtered = questionsOnly ? fields.filter((f) => isCustomQuestion(f)) : fields
  if (filtered.length === 0 && questionsOnly) {
    return ""
  }

  return filtered
    .map((f) => {
      const idx = fields.indexOf(f)
      const matched = f.profileKey !== null
      const isQuestion = isCustomQuestion(f)
      const statusIcon = f.filled ? "✅" : matched ? "⬜" : isQuestion ? "💬" : "❌"
      const labelClass = f.filled
        ? "crewjobs-field-label crewjobs-field-filled"
        : "crewjobs-field-label"
      const typeLabel =
        f.type === "file"
          ? "📎 file"
          : f.type === "checkbox"
            ? "☑ check"
            : f.type === "radio"
              ? "◉ radio"
              : f.type === "select"
                ? "▾ select"
                : "✎ text"
      const matchDot = matched
        ? '<span class="crewjobs-match-dot"></span>'
        : isQuestion
          ? '<span class="crewjobs-match-dot" style="background:#f59e0b"></span>'
          : '<span class="crewjobs-unmatch-dot"></span>'

      const rowClass = isQuestion
        ? "crewjobs-field-row crewjobs-field-row-question"
        : "crewjobs-field-row"
      const aiBtn =
        isQuestion && !f.filled
          ? `<div class="crewjobs-field-actions"><button class="crewjobs-ai-btn" data-field-idx="${idx}" title="Generate AI answer">✨ AI</button></div>`
          : ""
      const answerBlock = f.aiAnswer
        ? `<div style="margin:4px 0 8px 24px;padding:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:11px;line-height:1.5;color:#166534;white-space:pre-wrap">${escapeHtml(f.aiAnswer)}</div>`
        : ""

      return `
      <div class="${rowClass}">
        <span class="crewjobs-field-status">${statusIcon}</span>
        <div class="crewjobs-field-info">
          <span class="${labelClass}">${escapeHtml(f.label)}</span>
          <span class="crewjobs-field-type">${typeLabel} ${matchDot}</span>
        </div>
        ${aiBtn}
      </div>
      ${answerBlock}
    `
    })
    .join("")
}

function bindClose() {
  sidebarRoot?.querySelector("#crewjobs-close")?.addEventListener("click", closeSidebar)
}

function bindAIButtons() {
  if (!sidebarRoot) return
  const btns = sidebarRoot.querySelectorAll<HTMLButtonElement>(".crewjobs-ai-btn")
  btns.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation()
      const idx = parseInt(btn.getAttribute("data-field-idx") || "-1")
      if (idx < 0 || idx >= detectedFields.length) return

      const field = detectedFields[idx]
      const scraped = scrapeJobData()
      const jobDescription = document.body.innerText.substring(0, 8000)

      btn.disabled = true
      btn.classList.add("crewjobs-ai-btn-generating")
      btn.textContent = "⏳..."

      try {
        const { answer } = await generateAnswer({
          question: field.label,
          jobTitle: scraped.title,
          company: scraped.company,
          jobDescription,
          workspaceId: selectedWorkspaceId(),
        })

        if (answer) {
          const success = fillField(field, answer)
          if (success) field.filled = true
          field.aiAnswer = answer

          // Update UI
          refreshAutofillSection()
        }
      } catch (err: any) {
        btn.textContent = "❌ Error"
        setTimeout(() => {
          btn.textContent = "✨ AI"
          btn.classList.remove("crewjobs-ai-btn-generating")
          btn.disabled = false
        }, 2000)
        return
      }

      btn.disabled = false
      btn.classList.remove("crewjobs-ai-btn-generating")
      btn.textContent = "✨ AI"
    })
  })
}

function showError(el: HTMLElement, msg: string) {
  el.textContent = msg
  el.style.display = "block"
}

function escapeHtml(str: string): string {
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML.replace(/"/g, "&quot;")
}

// Init: inject the floating button
createFab()

// Listen for messages from extension icon click
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TOGGLE_SIDEBAR") {
    toggleSidebar()
  }
})
