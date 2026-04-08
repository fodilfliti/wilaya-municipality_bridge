export type LoginResponse = {
  token: string
  user: {
    id: number
    username: string
    name: string | null
    role: 'SUPER_ADMIN' | 'MUNI_ADMIN'
    municipality_id: number | null
    can_create_wilaya_admins?: boolean
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, opts: { status: number; code?: string }) {
    super(message)
    this.name = 'ApiError'
    this.status = opts.status
    this.code = opts.code
  }
}

async function http<T>(path: string, opts: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(opts.headers)
  headers.set('Content-Type', 'application/json')
  if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`)

  const res = await fetch(`${API_URL}${path}`, { ...opts, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((data as any).error || 'Erreur', { status: res.status, code: (data as any).code })
  return data as T
}

export async function login(username: string, password: string) {
  return http<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

export async function adminCreateApp(token: string, body: { app_name: string; description?: string }) {
  return http<{ app: any }>('/admin/apps', { method: 'POST', token, body: JSON.stringify(body) })
}

export async function adminCreateMunicipality(token: string, body: { name_ar: string; name_fr: string; code: string }) {
  return http<{ municipality: any }>('/admin/municipalities', { method: 'POST', token, body: JSON.stringify(body) })
}

export async function adminListMunicipalities(token: string, opts: { page?: number; pageSize?: number } = {}) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 10
  return http<{ municipalities: any[]; total: number; page: number; pageSize: number }>(
    `/admin/municipalities?page=${page}&pageSize=${pageSize}`,
    { method: 'GET', token },
  )
}

export async function adminGetMunicipality(token: string, municipalityId: number) {
  return http<{ municipality: any }>(`/admin/municipalities/${municipalityId}`, { method: 'GET', token })
}

export async function adminUpdateMunicipality(
  token: string,
  municipalityId: number,
  body: { name_ar?: string; name_fr?: string; code?: string },
) {
  return http<{ municipality: any }>(`/admin/municipalities/${municipalityId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function adminDeleteMunicipality(token: string, municipalityId: number) {
  return http<{ success: boolean }>(`/admin/municipalities/${municipalityId}`, { method: 'DELETE', token })
}

export async function adminMunicipalityOverview(token: string, municipalityId: number) {
  return http<{ municipality: any; apps: any[] }>(`/admin/municipalities/${municipalityId}/overview`, { method: 'GET', token })
}

export async function adminCreateMuniUser(token: string, municipalityId: number, body: { username?: string; name?: string }) {
  return http<{ user: any; credentials: { code8: string; pdf_url: string } }>(
    `/admin/municipalities/${municipalityId}/users`,
    { method: 'POST', token, body: JSON.stringify(body) },
  )
}

export async function adminListMunicipalityUsers(
  token: string,
  municipalityId: number,
  opts: { page?: number; pageSize?: number } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 10
  return http<{ municipality: any; users: any[]; total: number; page: number; pageSize: number }>(
    `/admin/municipalities/${municipalityId}/users?page=${page}&pageSize=${pageSize}`,
    { method: 'GET', token },
  )
}

export async function adminResetUser(token: string, userId: number) {
  return http<{ user: any; credentials: { code8: string; pdf_url: string } }>(`/admin/users/${userId}/reset`, { method: 'POST', token })
}

export async function adminBlockUser(token: string, userId: number) {
  return http<{ user: any }>(`/admin/users/${userId}/block`, { method: 'POST', token })
}

export async function adminUnblockUser(token: string, userId: number) {
  return http<{ user: any }>(`/admin/users/${userId}/unblock`, { method: 'POST', token })
}

export async function adminProgress(token: string) {
  return http<{ municipalities: any[] }>('/admin/dashboard/progress', { method: 'GET', token })
}

export async function adminListApps(token: string, opts: { page?: number; pageSize?: number } = {}) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 10
  return http<{ apps: any[]; total: number; page: number; pageSize: number }>(
    `/admin/apps?page=${page}&pageSize=${pageSize}`,
    { method: 'GET', token },
  )
}

export async function adminGetApp(token: string, appId: number) {
  return http<{ app: any; versions: any[] }>(`/admin/apps/${appId}`, { method: 'GET', token })
}

export async function adminUpdateApp(token: string, appId: number, body: { app_name?: string; description?: string }) {
  return http<{ app: any }>(`/admin/apps/${appId}`, { method: 'PATCH', token, body: JSON.stringify(body) })
}

export async function adminDeleteApp(token: string, appId: number) {
  return http<{ success: boolean }>(`/admin/apps/${appId}`, { method: 'DELETE', token })
}

export async function adminUploadLogo(token: string, appId: number, file: File) {
  const fd = new FormData()
  fd.append('logo', file)
  const res = await fetch(`${API_URL}/admin/apps/${appId}/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || 'Erreur')
  return data as { app: any }
}

export async function adminUploadVersion(
  token: string,
  appId: number,
  opts: { file: File; version_number: string; release_notes?: string; logoFile?: File | null },
) {
  const fd = new FormData()
  fd.append('file', opts.file)
  fd.append('version_number', opts.version_number)
  if (opts.release_notes) fd.append('release_notes', opts.release_notes)
  if (opts.logoFile) fd.append('logo', opts.logoFile)

  const res = await fetch(`${API_URL}/admin/apps/${appId}/versions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || 'Erreur')
  return data as { version: any; app: any }
}

export async function adminUpdateVersion(token: string, versionId: number, body: { version_number?: string; release_notes?: string }) {
  return http<{ version: any }>(`/admin/versions/${versionId}`, { method: 'PATCH', token, body: JSON.stringify(body) })
}

export async function adminDeleteVersion(token: string, versionId: number) {
  return http<{ success: boolean }>(`/admin/versions/${versionId}`, { method: 'DELETE', token })
}

export async function adminVersionMunicipalities(
  token: string,
  versionId: number,
  opts: { page?: number; pageSize?: number; search?: string } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 20
  const search = opts.search ? encodeURIComponent(opts.search) : ''
  const q = [`page=${page}`, `pageSize=${pageSize}`, search ? `search=${search}` : ''].filter(Boolean).join('&')
  return http<{ version: any; municipalities: any[]; total: number; page: number; pageSize: number }>(
    `/admin/versions/${versionId}/municipalities?${q}`,
    { method: 'GET', token },
  )
}

export async function adminVersionProgress(
  token: string,
  versionId: number,
  opts: { status?: 'ALL' | 'DOWNLOADED' | 'NOT_DOWNLOADED'; page?: number; pageSize?: number; search?: string } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 50
  const status = (opts.status || 'ALL').toUpperCase()
  const search = opts.search ? encodeURIComponent(opts.search) : ''
  const q = [`status=${status}`, `page=${page}`, `pageSize=${pageSize}`, search ? `search=${search}` : ''].filter(Boolean).join('&')
  return http<{
    version: unknown
    summary: { total_municipalities: number; downloaded_municipalities: number; not_downloaded_municipalities: number }
    status: string
    municipalities: unknown[]
    total: number
    page: number
    pageSize: number
  }>(`/admin/versions/${versionId}/progress?${q}`, { method: 'GET', token })
}

export async function adminVersionProgressPdf(token: string, versionId: number, opts: { lang?: 'ar' | 'fr' } = {}) {
  const lang = opts.lang || 'ar'
  return http<{ pdf_url: string }>(`/admin/versions/${versionId}/progress/pdf?lang=${encodeURIComponent(lang)}`, { method: 'POST', token })
}

export async function adminMunicipalityApps(token: string, municipalityId: number) {
  return http<{ municipality: any; apps: any[] }>(`/admin/municipalities/${municipalityId}/apps`, { method: 'GET', token })
}

export async function muniApps(token: string) {
  return http<{ apps: any[] }>('/muni/apps', { method: 'GET', token })
}

export async function muniGetApp(token: string, appId: number) {
  return http<{ app: any; versions: any[]; status: string; last: any | null }>(`/muni/apps/${appId}`, { method: 'GET', token })
}

export async function muniDownload(token: string, version_id: number) {
  return http<{ file_url: string }>('/muni/downloads', { method: 'POST', token, body: JSON.stringify({ version_id }) })
}

export async function muniChangeCode(token: string, body: { current_code: string; new_code: string }) {
  return http<{ success: boolean }>('/muni/me/change-code', { method: 'POST', token, body: JSON.stringify(body) })
}

export async function adminUserSearch(token: string, q: string) {
  const qq = encodeURIComponent(q || '')
  return http<{
    users: {
      id: number
      username: string
      name: string | null
      role: 'SUPER_ADMIN' | 'MUNI_ADMIN'
      municipality_id: number | null
      municipality: any | null
    }[]
  }>(`/admin/users/search?q=${qq}`, { method: 'GET', token })
}

export async function adminListWilayaAdmins(token: string) {
  return http<{ admins: { id: number; name: string | null; role: 'SUPER_ADMIN' }[] }>(`/admin/wilaya-admins`, { method: 'GET', token })
}

export async function adminCreateWilayaAdmin(token: string, body: { username: string; name?: string }) {
  return http<{ user: { id: number; name: string | null; role: 'SUPER_ADMIN' }; credentials: { code8: string; pdf_url: string } }>(`/admin/wilaya-admins`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export type MailThreadListItem = {
  id: number
  subject: string
  last_message_at: string
  created_at: string
  recipient_kind: 'DIRECT_USER' | 'MUNICIPALITY_TARGET' | 'ALL_MUNICIPALITIES'
  recipient_municipality: { id: number; code: string; name_ar: string; name_fr: string } | null
  created_by: { id: number; username: string; name: string | null; role: 'SUPER_ADMIN' | 'MUNI_ADMIN' } | null
  created_by_municipality: { id: number; code: string; name_ar: string; name_fr: string } | null
  unread: boolean
}

export async function adminMailThreads(
  token: string,
  opts: { page?: number; pageSize?: number; q?: string; unread?: 0 | 1 } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 20
  const q = opts.q ? encodeURIComponent(opts.q) : ''
  const unread = opts.unread ?? 0
  const qs = [`page=${page}`, `pageSize=${pageSize}`, q ? `q=${q}` : '', `unread=${unread}`].filter(Boolean).join('&')
  return http<{ threads: MailThreadListItem[]; total: number; page: number; pageSize: number }>(`/admin/mail/threads?${qs}`, {
    method: 'GET',
    token,
  })
}

export async function adminMailUnreadCount(token: string) {
  return http<{ unread: number }>(`/admin/mail/unread-count`, { method: 'GET', token })
}

export async function adminMailThread(token: string, threadId: number) {
  return http<{ thread: any; messages: any[]; my_recipient: any }>(`/admin/mail/threads/${threadId}`, { method: 'GET', token })
}

export async function adminMailRecipients(token: string, threadId: number) {
  return http<{ recipients: any[] }>(`/admin/mail/threads/${threadId}/recipients`, { method: 'GET', token })
}

export async function adminMailCreateThread(
  token: string,
  opts: {
    subject: string
    body_html: string
    target: { type: 'ALL_COMMUNES' } | { type: 'COMMUNES'; municipality_ids: number[] } | { type: 'USERS'; user_ids: number[] }
    attachments?: File[]
  },
) {
  const fd = new FormData()
  fd.append('subject', opts.subject)
  fd.append('body_html', opts.body_html)
  fd.append('target', JSON.stringify(opts.target))
  for (const f of opts.attachments || []) fd.append('attachments', f)

  const res = await fetch(`${API_URL}/admin/mail/threads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || 'Erreur')
  return data as { thread_ids: number[] }
}

export async function adminMailReply(
  token: string,
  threadId: number,
  opts: { body_html: string; attachments?: File[]; reply_to_message_id?: number | null },
) {
  const fd = new FormData()
  fd.append('body_html', opts.body_html)
  if (opts.reply_to_message_id) fd.append('reply_to_message_id', String(opts.reply_to_message_id))
  for (const f of opts.attachments || []) fd.append('attachments', f)

  const res = await fetch(`${API_URL}/admin/mail/threads/${threadId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || 'Erreur')
  return data as { message: any }
}

export async function muniMailThreads(
  token: string,
  opts: { page?: number; pageSize?: number; q?: string; unread?: 0 | 1 } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 20
  const q = opts.q ? encodeURIComponent(opts.q) : ''
  const unread = opts.unread ?? 0
  const qs = [`page=${page}`, `pageSize=${pageSize}`, q ? `q=${q}` : '', `unread=${unread}`].filter(Boolean).join('&')
  return http<{ threads: MailThreadListItem[]; total: number; page: number; pageSize: number }>(`/muni/mail/threads?${qs}`, {
    method: 'GET',
    token,
  })
}

export async function muniMailUnreadCount(token: string) {
  return http<{ unread: number }>(`/muni/mail/unread-count`, { method: 'GET', token })
}

export async function muniMailThread(token: string, threadId: number) {
  return http<{ thread: any; messages: any[]; my_recipient: any }>(`/muni/mail/threads/${threadId}`, { method: 'GET', token })
}

export async function muniListWilayaAdmins(token: string) {
  return http<{ admins: { id: number; name: string | null; role: 'SUPER_ADMIN' }[] }>(`/muni/wilaya-admins`, { method: 'GET', token })
}

export async function muniMailCreateThread(
  token: string,
  opts: {
    subject: string
    body_html: string
    target: { type: 'ALL_WILAYA_ADMINS' } | { type: 'WILAYA_ADMINS'; user_ids: number[] }
    attachments?: File[]
  },
) {
  const fd = new FormData()
  fd.append('subject', opts.subject)
  fd.append('body_html', opts.body_html)
  fd.append('target', JSON.stringify(opts.target))
  for (const f of opts.attachments || []) fd.append('attachments', f)

  const res = await fetch(`${API_URL}/muni/mail/threads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || 'Erreur')
  return data as { thread: any }
}

export async function muniMailWilayaSeen(token: string, threadId: number) {
  return http<{ wilaya_admins: any[] }>(`/muni/mail/threads/${threadId}/wilaya-seen`, { method: 'GET', token })
}

export async function muniMailReply(
  token: string,
  threadId: number,
  opts: { body_html: string; attachments?: File[]; reply_to_message_id?: number | null },
) {
  const fd = new FormData()
  fd.append('body_html', opts.body_html)
  if (opts.reply_to_message_id) fd.append('reply_to_message_id', String(opts.reply_to_message_id))
  for (const f of opts.attachments || []) fd.append('attachments', f)

  const res = await fetch(`${API_URL}/muni/mail/threads/${threadId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || 'Erreur')
  return data as { message: any }
}

export async function muniMailPrivateReply(
  token: string,
  threadId: number,
  opts: { subject?: string; body_html: string; attachments?: File[]; parent_message_id?: number | null },
) {
  const fd = new FormData()
  if (opts.subject) fd.append('subject', opts.subject)
  fd.append('body_html', opts.body_html)
  if (opts.parent_message_id) fd.append('parent_message_id', String(opts.parent_message_id))
  for (const f of opts.attachments || []) fd.append('attachments', f)

  const res = await fetch(`${API_URL}/muni/mail/threads/${threadId}/private-reply`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || 'Erreur')
  return data as { thread: any }
}

