const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("crewjobs_token")
}

export function setToken(token: string) {
  localStorage.setItem("crewjobs_token", token)
}

export function removeToken() {
  localStorage.removeItem("crewjobs_token")
  localStorage.removeItem("crewjobs_user")
}

export function getStoredUser() {
  if (typeof window === "undefined") return null
  const user = localStorage.getItem("crewjobs_user")
  return user ? JSON.parse(user) : null
}

export function setStoredUser(user: any) {
  localStorage.setItem("crewjobs_user", JSON.stringify(user))
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}

// Auth
export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Login failed")
  setToken(data.token)
  setStoredUser(data.user)
  return data
}

export async function apiRegister(email: string, username: string, password: string, role: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password, role }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Registration failed")
  if (data.token) {
    setToken(data.token)
    setStoredUser(data.user)
  }
  return data
}

export async function apiGetMe() {
  const res = await authFetch(`${API_BASE}/auth/me`)
  if (!res.ok) throw new Error("Not authenticated")
  return res.json()
}

// Applications
export async function apiGetApplications(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await authFetch(`${API_BASE}/applications?${query}`)
  if (!res.ok) throw new Error("Failed to fetch applications")
  return res.json()
}

export async function apiGetApplication(id: string) {
  const res = await authFetch(`${API_BASE}/applications/${id}`)
  if (!res.ok) throw new Error("Failed to fetch application")
  return res.json()
}

export async function apiCreateApplication(data: any) {
  const res = await authFetch(`${API_BASE}/applications`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to create application")
  return result
}

export async function apiUpdateApplication(id: string, data: any) {
  const res = await authFetch(`${API_BASE}/applications/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to update application")
  return result
}

export async function apiDeleteApplication(id: string) {
  const res = await authFetch(`${API_BASE}/applications/${id}`, { method: "DELETE" })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to delete application")
  return result
}

export async function apiBulkCreateApplications(applications: any[], workspaceId?: string) {
  const res = await authFetch(`${API_BASE}/applications/bulk`, {
    method: "POST",
    body: JSON.stringify({ applications, workspaceId }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to bulk create")
  return result
}

// Dashboard
export async function apiGetDashboardStats() {
  const res = await authFetch(`${API_BASE}/dashboard/stats`)
  if (!res.ok) throw new Error("Failed to fetch stats")
  return res.json()
}

export async function apiGetChartData(days = 14) {
  const res = await authFetch(
    `${API_BASE}/dashboard/chart?days=${days}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
  )
  if (!res.ok) throw new Error("Failed to fetch chart data")
  return res.json()
}

// Settings
export async function apiGetSettings() {
  const res = await authFetch(`${API_BASE}/settings`)
  if (!res.ok) throw new Error("Failed to fetch settings")
  return res.json()
}

export async function apiUpdateSettings(data: any) {
  const res = await authFetch(`${API_BASE}/settings`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to update settings")
  return result
}

// Profile
export async function apiGetProfile() {
  const res = await authFetch(`${API_BASE}/profile`)
  if (!res.ok) throw new Error("Failed to fetch profile")
  return res.json()
}

export async function apiUpdateProfile(data: any) {
  const res = await authFetch(`${API_BASE}/profile`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to update profile")
  return result
}

export async function apiUploadResume(file: File) {
  const token = getToken()
  const formData = new FormData()
  formData.append("resume", file)
  const res = await fetch(`${API_BASE}/profile/resume`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to upload resume")
  return result
}

export async function apiDownloadResume() {
  const res = await authFetch(`${API_BASE}/profile/resume`)
  if (!res.ok) throw new Error("Failed to get resume")
  return res.json()
}

export async function apiGenerateResume(data: {
  jobTitle: string
  company: string
  jobDescription: string
}) {
  const res = await authFetch(`${API_BASE}/profile/generate-resume`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to generate resume")
  return result
}

export async function apiDeleteResume() {
  const res = await authFetch(`${API_BASE}/profile/resume`, { method: "DELETE" })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to delete resume")
  return result
}

export async function apiParseResume(file: File) {
  const token = getToken()
  const formData = new FormData()
  formData.append("resume", file)
  const res = await fetch(`${API_BASE}/profile/parse-resume`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to parse resume")
  return result
}

// Teams
export async function apiGetTeams() {
  const res = await authFetch(`${API_BASE}/teams`)
  if (!res.ok) throw new Error("Failed to fetch teams")
  return res.json()
}

export async function apiCreateTeam(name: string) {
  const res = await authFetch(`${API_BASE}/teams`, {
    method: "POST",
    body: JSON.stringify({ name }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to create team")
  return result
}

export async function apiGetTeam(id: string) {
  const res = await authFetch(`${API_BASE}/teams/${id}`)
  if (!res.ok) throw new Error("Failed to fetch team")
  return res.json()
}

export async function apiUpdateTeam(id: string, name: string) {
  const res = await authFetch(`${API_BASE}/teams/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to update team")
  return result
}

export async function apiDeleteTeam(id: string) {
  const res = await authFetch(`${API_BASE}/teams/${id}`, { method: "DELETE" })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to delete team")
  return result
}

export async function apiAddTeamMember(teamId: string, email: string, role = "member") {
  const res = await authFetch(`${API_BASE}/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to add member")
  return result
}

export async function apiChangeTeamRole(teamId: string, userId: string, role: string) {
  const res = await authFetch(`${API_BASE}/teams/${teamId}/members/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to change role")
  return result
}

export async function apiRemoveTeamMember(teamId: string, userId: string) {
  const res = await authFetch(`${API_BASE}/teams/${teamId}/members/${userId}`, { method: "DELETE" })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to remove member")
  return result
}

export async function apiLeaveTeam(teamId: string) {
  const res = await authFetch(`${API_BASE}/teams/${teamId}/leave`, { method: "POST" })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to leave team")
  return result
}

export async function apiGetTeamDashboard(teamId: string, days = 14) {
  const res = await authFetch(
    `${API_BASE}/teams/${teamId}/dashboard?days=${days}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
  )
  if (!res.ok) throw new Error("Failed to fetch team dashboard")
  return res.json()
}

export async function apiGetTeamApplications(teamId: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await authFetch(`${API_BASE}/teams/${teamId}/applications?${query}`)
  if (!res.ok) throw new Error("Failed to fetch team applications")
  return res.json()
}

export async function apiGetUsers(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await authFetch(`${API_BASE}/users?${query}`)
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to fetch users")
  return result
}

export async function apiApproveUser(id: string) {
  const res = await authFetch(`${API_BASE}/users/${id}/approve`, { method: "POST" })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to approve user")
  return result
}

export async function apiRejectUser(id: string) {
  const res = await authFetch(`${API_BASE}/users/${id}/reject`, { method: "POST" })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to reject user")
  return result
}

export async function apiUpdateUserRole(id: string, role: string) {
  const res = await authFetch(`${API_BASE}/users/${id}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to update role")
  return result
}

export async function apiGetWorkspaces() {
  const res = await authFetch(`${API_BASE}/workspaces`)
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to fetch workspaces")
  return result
}

export async function apiCreateWorkspace(name: string) {
  const res = await authFetch(`${API_BASE}/workspaces`, {
    method: "POST",
    body: JSON.stringify({ name }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to create workspace")
  return result
}

export async function apiUpdateWorkspace(id: string, name: string) {
  const res = await authFetch(`${API_BASE}/workspaces/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to update workspace")
  return result
}

export async function apiUpdateWorkspaceMembers(
  id: string,
  bidderIds: string[],
  callerIds: string[],
) {
  const res = await authFetch(`${API_BASE}/workspaces/${id}/members`, {
    method: "PUT",
    body: JSON.stringify({ bidderIds, callerIds }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to update members")
  return result
}

export async function apiDeleteWorkspace(id: string) {
  const res = await authFetch(`${API_BASE}/workspaces/${id}`, { method: "DELETE" })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to delete workspace")
  return result
}

export async function apiGetJobs(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await authFetch(`${API_BASE}/jobs?${query}`)
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to fetch jobs")
  return result
}

export async function apiCreateJob(data: Record<string, unknown>) {
  const res = await authFetch(`${API_BASE}/jobs`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to save job")
  return result
}

export async function apiUpdateJob(id: string, data: Record<string, unknown>) {
  const res = await authFetch(`${API_BASE}/jobs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to update job")
  return result
}

export async function apiDeleteJob(id: string) {
  const res = await authFetch(`${API_BASE}/jobs/${id}`, { method: "DELETE" })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to delete job")
  return result
}

export async function apiGetBidFilters() {
  const res = await authFetch(`${API_BASE}/applications/filters`)
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to load filters")
  return result
}

export async function apiGetChatInbox() {
  const res = await authFetch(`${API_BASE}/chat/inbox`)
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to load messages")
  return result
}

export async function apiGetChatMessages(userId: string) {
  const res = await authFetch(`${API_BASE}/chat/messages/${userId}`)
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to load messages")
  return result
}

export async function apiSendChatMessage(userId: string, body: string) {
  const res = await authFetch(`${API_BASE}/chat/messages/${userId}`, {
    method: "POST",
    body: JSON.stringify({ body }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to send message")
  return result
}

export async function apiChat(message: string, files?: File[]) {
  const token = getToken()
  const formData = new FormData()
  formData.append("message", message)
  if (files) {
    files.forEach((file) => formData.append("files", file))
  }
  const res = await fetch(`${API_BASE}/profile/chat`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to get response")
  return result
}
