const API_BASE = "https://api-crewjobsapp.melodyxpot.com/api"

function getStorageData(key: string): Promise<any> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result[key]))
  })
}

function setStorageData(key: string, value: any): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve())
  })
}

async function getToken(): Promise<string | null> {
  return getStorageData("crewjobs_token")
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken()
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Login failed")
  await setStorageData("crewjobs_token", data.token)
  await setStorageData("crewjobs_user", data.user)
  return data
}

export async function getMe() {
  const res = await authFetch(`${API_BASE}/auth/me`)
  if (!res.ok) {
    await setStorageData("crewjobs_token", null)
    await setStorageData("crewjobs_user", null)
    throw new Error("Not authenticated")
  }
  return res.json()
}

export async function logout() {
  await setStorageData("crewjobs_token", null)
  await setStorageData("crewjobs_user", null)
}

export async function getSettings() {
  const res = await authFetch(`${API_BASE}/settings`)
  if (!res.ok) throw new Error("Failed to get settings")
  return res.json()
}

export async function createApplication(data: any) {
  const res = await authFetch(`${API_BASE}/applications`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to create application")
  return result
}

export async function saveScrapedJob(data: any) {
  const res = await authFetch(`${API_BASE}/jobs`, {
    method: "POST",
    body: JSON.stringify({ ...data, workLocation: "Remote" }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to save remote job")
  return result
}

export async function getWorkspaces() {
  const res = await authFetch(`${API_BASE}/workspaces`)
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to fetch workspaces")
  return result
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken()
  return !!token
}

export async function getUser() {
  return getStorageData("crewjobs_user")
}

export async function getProfile() {
  const res = await authFetch(`${API_BASE}/profile`)
  if (!res.ok) throw new Error("Failed to fetch profile")
  return res.json()
}

export async function getResumeInfo() {
  const res = await authFetch(`${API_BASE}/profile/resume`)
  if (!res.ok) throw new Error("No resume found")
  return res.json()
}

export async function generateResume(data: { jobTitle: string; company: string; jobDescription: string }) {
  const res = await authFetch(`${API_BASE}/profile/generate-resume`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to generate resume")
  return result
}

export async function detectFieldsWithAI(fields: { label: string; type: string; name: string; id: string }[]) {
  const res = await authFetch(`${API_BASE}/profile/detect-fields`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to detect fields")
  return result
}

export async function generateAnswer(data: { question: string; jobTitle: string; company: string; jobDescription: string }) {
  const res = await authFetch(`${API_BASE}/profile/generate-answer`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to generate answer")
  return result
}

export interface ExtSettings {
  autofillEnabled: boolean
  saveResumeInApp: boolean
}

export async function getExtensionSettings(): Promise<ExtSettings> {
  const data = await getStorageData("crewjobs_ext_settings")
  return { autofillEnabled: true, saveResumeInApp: false, ...data }
}

export async function setExtensionSettings(settings: ExtSettings): Promise<void> {
  await setStorageData("crewjobs_ext_settings", settings)
}

export async function generateCoverLetter(data: { jobTitle: string; company: string; jobDescription: string }) {
  const res = await authFetch(`${API_BASE}/profile/generate-cover-letter`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to generate cover letter")
  return result
}
