export type AccessLevel = 'none' | 'view' | 'manage'

export type LoginResponse = {
  token: string
  user: {
    id: number
    username: string
    name: string | null
    role: 'SUPER_ADMIN' | 'MUNI_ADMIN'
    municipality_id: number | null
    can_create_wilaya_admins?: boolean
    can_manage_access_roles?: boolean
    use_custom_permissions?: boolean
    access_role_template_id?: number | null
    effective_permissions?: Record<string, AccessLevel>
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
  if (!res.ok) {
    const base = String((data as any).error || 'Erreur')
    const detail = (data as any).detail != null ? String((data as any).detail) : ''
    const msg = detail && detail !== base ? `${base}: ${detail}` : base
    throw new ApiError(msg, { status: res.status, code: (data as any).code })
  }
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

export type UserCreateProfileBody = {
  job_title?: string
  email?: string
  email_hidden?: boolean
  access_role_template_id?: number
}

export async function adminCreateMuniUser(
  token: string,
  municipalityId: number,
  body: { username?: string; name?: string } & UserCreateProfileBody,
) {
  return http<{ user: any; credentials: { code8: string; pdf_url: string } }>(
    `/admin/municipalities/${municipalityId}/users`,
    { method: 'POST', token, body: JSON.stringify(body) },
  )
}

export type AccessRoleTemplateRow = {
  id: number
  slug: string
  account_scope: 'wilaya' | 'commune'
  name_ar: string
  name_fr: string
  description_ar?: string | null
  description_fr?: string | null
  is_system: boolean
  is_active: boolean
}

export type UserAccessProfileUser = {
  id: number
  username: string
  name: string | null
  role: 'SUPER_ADMIN' | 'MUNI_ADMIN'
  municipality_id: number | null
  is_blocked: boolean
  job_title: string | null
  email: string | null
  email_hidden: boolean
  access_role_template_id: number | null
  use_custom_permissions: boolean
  can_manage_access_roles: boolean
  can_create_wilaya_admins: boolean
  department: { id: number; name_ar: string; name_fr: string } | null
  access_role_template: { id: number; slug: string; name_ar: string; name_fr: string; account_scope: string } | null
}

export type CommuneAgentRow = {
  id: number
  username: string
  name: string | null
  role: 'MUNI_ADMIN'
  municipality_id: number | null
  is_blocked: boolean
  municipality: { id: number; code: string; name_ar: string; name_fr: string } | null
  job_title?: string | null
  email?: string | null
  email_hidden?: boolean
  access_role_template_id?: number | null
  access_role_template?: { id: number; slug: string; name_ar: string; name_fr: string } | null
}

export async function adminCommuneAgentsList(
  token: string,
  opts: { page?: number; pageSize?: number; q?: string; municipalityId?: number } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 20
  const q = opts.q ? `&q=${encodeURIComponent(opts.q)}` : ''
  const mid =
    opts.municipalityId != null && Number.isFinite(opts.municipalityId)
      ? `&municipality_id=${opts.municipalityId}`
      : ''
  return http<{ rows: CommuneAgentRow[]; total: number; page: number; pageSize: number }>(
    `/admin/commune-agents?page=${page}&pageSize=${pageSize}${q}${mid}`,
    { method: 'GET', token },
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

export type WilayaAdminRow = {
  id: number
  username: string
  name: string | null
  role: 'SUPER_ADMIN'
  is_blocked: boolean
  can_create_wilaya_admins: boolean
  can_manage_access_roles?: boolean
  job_title?: string | null
  email?: string | null
  email_hidden?: boolean
  access_role_template_id?: number | null
  use_custom_permissions?: boolean
  access_role_template?: { id: number; slug: string; name_ar: string; name_fr: string } | null
}

export async function adminAccessRoleTemplatesList(
  token: string,
  opts: { account_scope?: 'wilaya' | 'commune' } = {},
) {
  const scope = opts.account_scope ? `?account_scope=${opts.account_scope}` : ''
  return http<{ templates: AccessRoleTemplateRow[] }>(`/admin/access/role-templates${scope}`, { method: 'GET', token })
}

export async function adminAccessRoleTemplateGet(token: string, templateId: number) {
  return http<{
    template: AccessRoleTemplateRow & {
      permissions: { permission_key: string; access_level: AccessLevel }[]
    }
  }>(`/admin/access/role-templates/${templateId}`, { method: 'GET', token })
}

export async function adminAccessPermissionCatalog(
  token: string,
  opts: { account_scope?: 'wilaya' | 'commune' } = {},
) {
  const scope = opts.account_scope ? `?account_scope=${opts.account_scope}` : ''
  return http<{
    permissions: { key: string; module: string; label_fr: string; label_ar: string }[]
    modules: string[]
  }>(`/admin/access/permission-catalog${scope}`, { method: 'GET', token })
}

export type AccessRoleTemplateDetail = AccessRoleTemplateRow & {
  permissions: { permission_key: string; access_level: AccessLevel }[]
}

export async function adminAccessRoleTemplateCreate(
  token: string,
  body: {
    account_scope: 'wilaya' | 'commune'
    name_ar: string
    name_fr: string
    description_ar?: string | null
    description_fr?: string | null
    permissions?: { permission_key: string; access_level: AccessLevel }[]
  },
) {
  return http<{ template: AccessRoleTemplateDetail }>(`/admin/access/role-templates`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function adminAccessRoleTemplatePermissionsUpdate(
  token: string,
  templateId: number,
  permissions: { permission_key: string; access_level: AccessLevel }[],
) {
  return http<{ template: AccessRoleTemplateDetail }>(
    `/admin/access/role-templates/${templateId}/permissions`,
    { method: 'PUT', token, body: JSON.stringify({ permissions }) },
  )
}

export async function adminUserAccessProfileGet(token: string, userId: number) {
  return http<{
    user: UserAccessProfileUser
    effective_permissions: Record<string, AccessLevel>
    permission_overrides: { permission_key: string; access_level: AccessLevel }[]
  }>(`/admin/users/${userId}/access-profile`, { method: 'GET', token })
}

export async function adminUserAccessProfilePatch(
  token: string,
  userId: number,
  body: {
    job_title?: string | null
    email?: string | null
    email_hidden?: boolean
    access_role_template_id?: number
    use_custom_permissions?: boolean
    permission_overrides?: { permission_key: string; access_level: AccessLevel }[]
  },
) {
  return http<{ profile: Awaited<ReturnType<typeof adminUserAccessProfileGet>> }>(
    `/admin/users/${userId}/access-profile`,
    { method: 'PATCH', token, body: JSON.stringify(body) },
  )
}

export async function adminWilayaAdminsList(
  token: string,
  opts: { page?: number; pageSize?: number; q?: string } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 20
  const q = opts.q ? `&q=${encodeURIComponent(opts.q)}` : ''
  return http<{ rows: WilayaAdminRow[]; total: number; page: number; pageSize: number }>(
    `/admin/wilaya-admins?page=${page}&pageSize=${pageSize}${q}`,
    { method: 'GET', token },
  )
}

/** Brief list for pickers (id + name only). */
export async function adminListWilayaAdmins(token: string) {
  return http<{ admins: { id: number; name: string | null; role: 'SUPER_ADMIN' }[] }>(
    `/admin/wilaya-admins?brief=1`,
    { method: 'GET', token },
  )
}

export async function adminCreateWilayaAdmin(
  token: string,
  body: { username: string; name?: string } & UserCreateProfileBody,
) {
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
  validation_outcome?: 'VALIDATED' | 'SENT_WITHOUT_VALIDATION' | null
  unread: boolean
}

export type MailSendRequestListItem = {
  id: number
  subject: string
  status: 'PENDING_VALIDATION' | 'CHANGES_REQUESTED' | 'SENT' | 'SENT_WITHOUT_VALIDATION' | 'CANCELLED'
  revision: number
  thread_id: number | null
  updated_at: string
  created_by: { id: number; username: string; name: string | null } | null
  validator_summary: { total: number; approved: number; rejected: number; pending: number }
  my_validator_decision: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  is_author: boolean
}

export type MailSendRequestDetail = MailSendRequestListItem & {
  body_html: string
  target: unknown
  created_at: string
  sent_at: string | null
  validators: Array<{
    id: number
    validator_user_id: number
    decision: 'PENDING' | 'APPROVED' | 'REJECTED'
    feedback_html: string | null
    decided_at: string | null
    user: { id: number; username: string; name: string | null; role: string } | null
  }>
  discussion: Array<{
    id: number
    body_html: string
    created_at: string
    author: { id: number; username: string; name: string | null; role: string } | null
  }>
  attachments: Array<{ id: number; filename: string; mime_type: string; size_bytes: number; file_url: string }>
  my_role: 'author' | 'validator' | 'author_and_validator'
}

function mailPrefix(mode: 'admin' | 'muni') {
  return mode === 'admin' ? '/admin/mail' : '/muni/mail'
}

export async function mailValidatorCandidates(token: string, mode: 'admin' | 'muni') {
  return http<{ users: { id: number; username: string; name: string | null; role: string }[] }>(
    `${mailPrefix(mode)}/validator-candidates`,
    { method: 'GET', token },
  )
}

export async function mailValidationPendingCount(token: string, mode: 'admin' | 'muni') {
  return http<{ as_author: number; as_validator: number; total: number }>(
    `${mailPrefix(mode)}/validation-pending-count`,
    { method: 'GET', token },
  )
}

export async function mailSendRequests(
  token: string,
  mode: 'admin' | 'muni',
  opts: { view?: 'author' | 'validator'; status?: string; page?: number; pageSize?: number; q?: string } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 20
  const view = opts.view ?? 'author'
  const qs = [
    `page=${page}`,
    `pageSize=${pageSize}`,
    `view=${view}`,
    opts.status ? `status=${encodeURIComponent(opts.status)}` : '',
    opts.q ? `q=${encodeURIComponent(opts.q)}` : '',
  ]
    .filter(Boolean)
    .join('&')
  return http<{ rows: MailSendRequestListItem[]; total: number; page: number; pageSize: number }>(
    `${mailPrefix(mode)}/send-requests?${qs}`,
    { method: 'GET', token },
  )
}

export async function mailSendRequestDetail(token: string, mode: 'admin' | 'muni', id: number) {
  return http<{ send_request: MailSendRequestDetail }>(`${mailPrefix(mode)}/send-requests/${id}`, {
    method: 'GET',
    token,
  })
}

export async function mailSendRequestDiscussion(
  token: string,
  mode: 'admin' | 'muni',
  id: number,
  body_html: string,
) {
  return http<{ send_request: MailSendRequestDetail }>(`${mailPrefix(mode)}/send-requests/${id}/discussion`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body_html }),
  })
}

export async function mailSendRequestApprove(token: string, mode: 'admin' | 'muni', id: number) {
  return http<{ finalized: boolean; thread_id: number | null; send_request: MailSendRequestDetail }>(
    `${mailPrefix(mode)}/send-requests/${id}/approve`,
    { method: 'POST', token },
  )
}

export async function mailSendRequestReject(
  token: string,
  mode: 'admin' | 'muni',
  id: number,
  feedback_html: string,
) {
  return http<{ send_request: MailSendRequestDetail }>(`${mailPrefix(mode)}/send-requests/${id}/reject`, {
    method: 'POST',
    token,
    body: JSON.stringify({ feedback_html }),
  })
}

export async function mailSendRequestForceSend(token: string, mode: 'admin' | 'muni', id: number) {
  return http<{ thread_id: number; finalized: boolean }>(
    `${mailPrefix(mode)}/send-requests/${id}/send-without-validation`,
    { method: 'POST', token },
  )
}

export async function mailSendRequestResubmit(
  token: string,
  mode: 'admin' | 'muni',
  id: number,
  opts: { subject?: string; body_html?: string; attachments?: File[] },
) {
  const fd = new FormData()
  fd.append('subject', opts.subject ?? '')
  fd.append('body_html', opts.body_html ?? '')
  for (const f of opts.attachments || []) fd.append('attachments', f)
  const res = await fetch(`${API_URL}${mailPrefix(mode)}/send-requests/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || 'Erreur')
  return data as { send_request: MailSendRequestDetail }
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
    send_mode?: 'DIRECT' | 'VALIDATION'
    validator_user_ids?: number[]
  },
) {
  const fd = new FormData()
  fd.append('subject', opts.subject)
  fd.append('body_html', opts.body_html)
  fd.append('target', JSON.stringify(opts.target))
  if (opts.send_mode) fd.append('send_mode', opts.send_mode)
  if (opts.validator_user_ids?.length) fd.append('validator_user_ids', JSON.stringify(opts.validator_user_ids))
  for (const f of opts.attachments || []) fd.append('attachments', f)

  const res = await fetch(`${API_URL}/admin/mail/threads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || 'Erreur')
  return data as { thread_ids: number[]; send_request_id?: number }
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
    send_mode?: 'DIRECT' | 'VALIDATION'
    validator_user_ids?: number[]
  },
) {
  const fd = new FormData()
  fd.append('subject', opts.subject)
  fd.append('body_html', opts.body_html)
  fd.append('target', JSON.stringify(opts.target))
  if (opts.send_mode) fd.append('send_mode', opts.send_mode)
  if (opts.validator_user_ids?.length) fd.append('validator_user_ids', JSON.stringify(opts.validator_user_ids))
  for (const f of opts.attachments || []) fd.append('attachments', f)

  const res = await fetch(`${API_URL}/muni/mail/threads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || 'Erreur')
  return data as { thread: any; send_request_id?: number }
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

export type OperationTarget =
  | { type: 'ALL_COMMUNES' }
  | { type: 'COMMUNES'; municipality_ids: number[] }
  | { type: 'USERS'; user_ids: number[] }

export type OperationColumnInput = {
  key: string
  label_ar: string
  label_fr?: string | null
  column_type: 'BOOLEAN' | 'NUMBER' | 'TEXT' | 'DATE' | 'CHOICE'
  position?: number
  is_result?: boolean
  default_value?: unknown
  choices?: {
    value_key: string
    label_ar: string
    label_fr?: string | null
    color_hex: string
    palette_index?: number | null
    position?: number
  }[]
}

export async function adminOperationPaletteColors(token: string) {
  return http<{ colors: { id: number; palette_index: number; hex: string }[] }>(
    '/admin/operations/palette-colors',
    { method: 'GET', token },
  )
}

export async function adminOperationsList(
  token: string,
  opts: { page?: number; pageSize?: number; q?: string; status?: 'EN_COURS' | 'ARCHIVE' | '' } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 20
  const q = opts.q ? `&q=${encodeURIComponent(opts.q)}` : ''
  const status =
    opts.status === 'EN_COURS' || opts.status === 'ARCHIVE' ? `&status=${encodeURIComponent(opts.status)}` : ''
  return http<{ operations: any[]; total: number; page: number; pageSize: number }>(
    `/admin/operations?page=${page}&pageSize=${pageSize}${q}${status}`,
    { method: 'GET', token },
  )
}

export async function adminOperationGet(token: string, operationId: number) {
  return http<{ operation: any }>(`/admin/operations/${operationId}`, { method: 'GET', token })
}

export async function adminOperationCreate(
  token: string,
  body: { title: string; description?: string | null; target: OperationTarget; columns: OperationColumnInput[]; status?: 'EN_COURS' | 'ARCHIVE' },
) {
  return http<{ operation: any; notification_mail?: { ok: boolean; thread_id?: number; error?: string } }>(
    `/admin/operations`,
    { method: 'POST', token, body: JSON.stringify(body) },
  )
}

export async function adminOperationNotifyUpdateMail(token: string, operationId: number, body?: { note?: string }) {
  return http<{ thread_id: number }>(`/admin/operations/${operationId}/notify-update-mail`, {
    method: 'POST',
    token,
    body: JSON.stringify(body || {}),
  })
}

export async function adminOperationPatch(
  token: string,
  operationId: number,
  body: { title?: string; description?: string | null; status?: 'EN_COURS' | 'ARCHIVE' },
) {
  return http<{ operation: any }>(`/admin/operations/${operationId}`, { method: 'PATCH', token, body: JSON.stringify(body) })
}

export async function adminOperationRecipientsPut(token: string, operationId: number, target: OperationTarget) {
  return http<{ operation: any }>(`/admin/operations/${operationId}/recipients`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ target }),
  })
}

export async function adminOperationAddColumn(token: string, operationId: number, body: OperationColumnInput) {
  return http<{ operation: any }>(`/admin/operations/${operationId}/columns`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function adminOperationDeleteColumn(token: string, operationId: number, columnId: number) {
  return http<{ operation: any }>(`/admin/operations/${operationId}/columns/${columnId}`, { method: 'DELETE', token })
}

export async function adminOperationUpdateColumn(
  token: string,
  operationId: number,
  columnId: number,
  body: {
    label_ar?: string
    label_fr?: string | null
    position?: number
    is_result?: boolean
    default_value?: unknown | null
  },
) {
  return http<{ operation: any }>(`/admin/operations/${operationId}/columns/${columnId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function adminOperationAddChoice(
  token: string,
  operationId: number,
  columnId: number,
  body: {
    value_key: string
    label_ar: string
    label_fr?: string | null
    color_hex: string
    palette_index?: number | null
    position?: number
  },
) {
  return http<{ operation: any }>(`/admin/operations/${operationId}/columns/${columnId}/choices`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function adminOperationUpdateChoice(
  token: string,
  operationId: number,
  columnId: number,
  choiceId: number,
  body: {
    label_ar?: string
    label_fr?: string | null
    color_hex?: string
    position?: number
    palette_index?: number | null
  },
) {
  return http<{ operation: any }>(`/admin/operations/${operationId}/columns/${columnId}/choices/${choiceId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function adminOperationDeleteChoice(token: string, operationId: number, columnId: number, choiceId: number) {
  return http<{ operation: any }>(`/admin/operations/${operationId}/columns/${columnId}/choices/${choiceId}`, {
    method: 'DELETE',
    token,
  })
}

export async function adminOperationResults(token: string, operationId: number) {
  return http<{ operation: any; municipalities: any[]; analytics: Record<string, any>; submission?: { total: number; submitted: number; pending: number } }>(
    `/admin/operations/${operationId}/results`,
    { method: 'GET', token },
  )
}

function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*=(?:UTF-8|utf-8)''([^;\n]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"+|"+$/g, ''))
    } catch {
      /* fall through */
    }
  }
  const quoted = /filename="((?:\\.|[^"\\])*)"/i.exec(header)
  if (quoted?.[1]) return quoted[1].replace(/\\"/g, '"')
  const unquoted = /filename=([^;\n]+)/i.exec(header)
  if (unquoted?.[1]) return unquoted[1].trim().replace(/^"+|"+$/g, '')
  return null
}

async function fetchBlobAttachment(path: string, token: string, fallbackFilename: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError((data as any).error || 'Erreur', { status: res.status })
  }
  const fromHeader = parseFilenameFromContentDisposition(res.headers.get('content-disposition'))
  const blob = await res.blob()
  return { blob, filename: fromHeader || fallbackFilename }
}

export async function downloadAdminOperationXlsx(token: string, operationId: number, locale: 'ar' | 'fr' = 'ar') {
  const path = `/admin/operations/${operationId}/export.xlsx?locale=${locale}`
  return fetchBlobAttachment(path, token, `operation-${operationId}.xlsx`)
}

export async function downloadAdminOperationSubmissionXlsx(token: string, operationId: number, locale: 'ar' | 'fr' = 'ar') {
  const path = `/admin/operations/${operationId}/export-submission.xlsx?locale=${locale}`
  return fetchBlobAttachment(path, token, `operation-${operationId}-submission.xlsx`)
}

export type BackupServerLine = {
  id: number
  existe: boolean
  server_type: string | null
  configured: boolean
  os_type: string | null
  os_active: boolean
  anomalie: string | null
  submitted_at?: string | null
  updated_at?: string | null
  display_order?: number
}

export type BackupServerStatusPayload = {
  municipalities: Array<{
    municipality: { id: number; code: string; name_ar: string; name_fr: string }
    servers: BackupServerLine[]
    has_submitted: boolean
  }>
  submission: { total: number; submitted: number; pending: number }
  analytics: {
    existe: { yes: number; no: number }
    configured: { yes: number; no: number }
    os_active: { yes: number; no: number }
    anomalies_nonempty: number
  }
}

export async function adminBackupServerStatusList(token: string, opts?: { municipalityId?: number }) {
  const q = opts?.municipalityId != null ? `?municipalityId=${opts.municipalityId}` : ''
  return http<BackupServerStatusPayload>(`/admin/etat-principale/backup-servers${q}`, { method: 'GET', token })
}

export async function adminBackupServerStatusPatchMunicipality(
  token: string,
  municipalityId: number,
  body: {
    servers?: Array<{
      id?: number
      existe: boolean
      server_type?: string | null
      configured: boolean
      os_type?: string | null
      os_active: boolean
      anomalie?: string | null
    }>
    existe?: boolean
    server_type?: string | null
    configured?: boolean
    os_type?: string | null
    os_active?: boolean
    anomalie?: string | null
  },
) {
  return http<BackupServerStatusPayload>(`/admin/etat-principale/backup-servers/${municipalityId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function downloadAdminBackupServerStatusXlsx(
  token: string,
  locale: 'ar' | 'fr' = 'ar',
  opts?: { municipalityId?: number },
) {
  const params = new URLSearchParams({ locale })
  if (opts?.municipalityId != null) params.set('municipalityId', String(opts.municipalityId))
  const path = `/admin/etat-principale/backup-servers/export.xlsx?${params}`
  return fetchBlobAttachment(path, token, `backup-servers-wilaya.xlsx`)
}

export async function muniOperationsList(
  token: string,
  opts: { page?: number; pageSize?: number; q?: string; status?: '' | 'EN_COURS' | 'ARCHIVE' } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 20
  const q = opts.q ? `&q=${encodeURIComponent(opts.q)}` : ''
  const st =
    opts.status === 'EN_COURS' || opts.status === 'ARCHIVE' ? `&status=${encodeURIComponent(opts.status)}` : ''
  return http<{ operations: any[]; total: number; page: number; pageSize: number }>(
    `/muni/operations?page=${page}&pageSize=${pageSize}${q}${st}`,
    { method: 'GET', token },
  )
}

export async function muniOperationGet(token: string, operationId: number) {
  return http<{ operation: any }>(`/muni/operations/${operationId}`, { method: 'GET', token })
}

export async function muniOperationSheetGet(token: string, operationId: number) {
  return http<{ sheet: any | null; municipality_id: number }>(`/muni/operations/${operationId}/sheet`, { method: 'GET', token })
}

export async function muniOperationSheetPut(token: string, operationId: number, rows: { row_index?: number; cells: Record<string, unknown> }[]) {
  return http<{ sheet: any }>(`/muni/operations/${operationId}/sheet`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ rows }),
  })
}

export async function downloadMuniOperationXlsx(token: string, operationId: number, locale: 'ar' | 'fr' = 'ar') {
  const path = `/muni/operations/${operationId}/export.xlsx?locale=${locale}`
  return fetchBlobAttachment(path, token, `operation-${operationId}-commune.xlsx`)
}

export async function muniBackupServerStatusGet(token: string) {
  return http<{
    municipality_id: number
    municipality: { id: number; code: string; name_ar: string; name_fr: string } | null
    servers: BackupServerLine[]
    submitted_at: string | null
  }>(`/muni/etat-principale/backup-servers`, { method: 'GET', token })
}

export async function muniBackupServerStatusPatch(
  token: string,
  body: {
    servers?: Array<{
      id?: number
      existe: boolean
      server_type?: string | null
      configured: boolean
      os_type?: string | null
      os_active: boolean
      anomalie?: string | null
    }>
    existe?: boolean
    server_type?: string | null
    configured?: boolean
    os_type?: string | null
    os_active?: boolean
    anomalie?: string | null
    submit?: boolean
  },
) {
  return http<{
    municipality_id: number
    municipality: { id: number; code: string; name_ar: string; name_fr: string } | null
    servers: BackupServerLine[]
    submitted_at: string | null
  }>(`/muni/etat-principale/backup-servers`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function downloadMuniBackupServerStatusXlsx(token: string, locale: 'ar' | 'fr' = 'ar') {
  const path = `/muni/etat-principale/backup-servers/export.xlsx?locale=${locale}`
  return fetchBlobAttachment(path, token, `backup-servers-commune.xlsx`)
}

export type McltWorkstationLine = {
  id: number
  ip_mclt: string | null
  pc_usage: string | null
  installed_application: string | null
  windows_version: string | null
  pc_name: string | null
  antivirus_name: string | null
  ip_rnc_authorized: string | null
  ip_rnc_requested: string | null
  rnc_auth_status: 'none' | 'pending' | 'approved' | 'rejected'
  rnc_auth_requested_at?: string | null
  submitted_at?: string | null
  updated_at?: string | null
  display_order?: number
}

export type McltWorkstationPayload = {
  municipalities: Array<{
    municipality: { id: number; code: string; name_ar: string; name_fr: string }
    workstations: McltWorkstationLine[]
    has_submitted: boolean
  }>
  submission: { total: number; submitted: number; pending: number }
  analytics: { rnc_pending: number; rnc_approved: number }
}

export async function adminMcltWorkstationsList(token: string, opts?: { municipalityId?: number }) {
  const q = opts?.municipalityId != null ? `?municipalityId=${opts.municipalityId}` : ''
  return http<McltWorkstationPayload>(`/admin/etat-principale/mclt-workstations${q}`, { method: 'GET', token })
}

export async function adminMcltWorkstationsPatchMunicipality(
  token: string,
  municipalityId: number,
  body: {
    workstations: Array<{
      id?: number
      ip_mclt?: string | null
      pc_usage?: string | null
      installed_application?: string | null
      windows_version?: string | null
      pc_name?: string | null
      antivirus_name?: string | null
      ip_rnc_authorized?: string | null
      ip_rnc_requested?: string | null
      rnc_auth_status?: string
    }>
  },
) {
  return http<McltWorkstationPayload>(`/admin/etat-principale/mclt-workstations/${municipalityId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function downloadAdminMcltWorkstationsXlsx(
  token: string,
  locale: 'ar' | 'fr' = 'ar',
  opts?: { municipalityId?: number },
) {
  const params = new URLSearchParams({ locale })
  if (opts?.municipalityId != null) params.set('municipalityId', String(opts.municipalityId))
  const path = `/admin/etat-principale/mclt-workstations/export.xlsx?${params}`
  return fetchBlobAttachment(path, token, `mclt-wilaya.xlsx`)
}

export async function muniMcltWorkstationsGet(token: string) {
  return http<{
    municipality_id: number
    municipality: { id: number; code: string; name_ar: string; name_fr: string } | null
    workstations: McltWorkstationLine[]
    submitted_at: string | null
  }>(`/muni/etat-principale/mclt-workstations`, { method: 'GET', token })
}

export async function muniMcltWorkstationsPatch(
  token: string,
  body: {
    workstations: Array<{
      id?: number
      ip_mclt?: string | null
      pc_usage?: string | null
      installed_application?: string | null
      windows_version?: string | null
      pc_name?: string | null
      antivirus_name?: string | null
      ip_rnc_requested?: string | null
    }>
    submit?: boolean
  },
) {
  return http<{
    municipality_id: number
    municipality: { id: number; code: string; name_ar: string; name_fr: string } | null
    workstations: McltWorkstationLine[]
    submitted_at: string | null
  }>(`/muni/etat-principale/mclt-workstations`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function muniMcltRequestRncAuthorization(
  token: string,
  workstationId: number,
  body: { request_mode: 'specific' | 'generic'; ip_rnc_requested?: string | null },
) {
  return http<{
    workstation: McltWorkstationLine
    municipality: { id: number; code: string; name_ar: string; name_fr: string }
    mail_thread_id: number | null
    request_mode?: string
  }>(`/muni/etat-principale/mclt-workstations/${workstationId}/request-rnc-authorization`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function downloadMuniMcltWorkstationsXlsx(token: string, locale: 'ar' | 'fr' = 'ar') {
  const path = `/muni/etat-principale/mclt-workstations/export.xlsx?locale=${locale}`
  return fetchBlobAttachment(path, token, `mclt-commune.xlsx`)
}

export type AnnexRncLine = {
  id: number
  municipality_annex_id: number
  annex_name?: string | null
  ip_authorized: string | null
  authorization_year: string | null
  authorized_ip_count: string | null
  pc_used: string | null
  ip_requested: string | null
  rnc_auth_status: 'none' | 'pending' | 'approved' | 'rejected'
  rnc_auth_requested_at?: string | null
  submitted_at?: string | null
  updated_at?: string | null
  display_order?: number
}

export type AnnexRncPayload = {
  municipalities: Array<{
    municipality: { id: number; code: string; name_ar: string; name_fr: string }
    lines: AnnexRncLine[]
    has_submitted: boolean
  }>
  submission: { total: number; submitted: number; pending: number }
  analytics: { rnc_pending: number; rnc_approved: number }
}

export async function adminAnnexRncList(token: string, opts?: { municipalityId?: number }) {
  const q = opts?.municipalityId != null ? `?municipalityId=${opts.municipalityId}` : ''
  return http<AnnexRncPayload>(`/admin/etat-principale/annex-rnc-authorizations${q}`, { method: 'GET', token })
}

export async function adminAnnexRncPatchMunicipality(
  token: string,
  municipalityId: number,
  body: {
    lines: Array<{
      id?: number
      municipality_annex_id?: number
      ip_authorized?: string | null
      authorization_year?: string | null
      authorized_ip_count?: string | null
      pc_used?: string | null
      ip_requested?: string | null
      rnc_auth_status?: string
    }>
  },
) {
  return http<AnnexRncPayload>(`/admin/etat-principale/annex-rnc-authorizations/${municipalityId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function downloadAdminAnnexRncXlsx(
  token: string,
  locale: 'ar' | 'fr' = 'ar',
  opts?: { municipalityId?: number },
) {
  const params = new URLSearchParams({ locale })
  if (opts?.municipalityId != null) params.set('municipalityId', String(opts.municipalityId))
  const path = `/admin/etat-principale/annex-rnc-authorizations/export.xlsx?${params}`
  return fetchBlobAttachment(path, token, `annex-rnc-wilaya.xlsx`)
}

export async function muniAnnexRncGet(token: string) {
  return http<{
    municipality_id: number
    municipality: { id: number; code: string; name_ar: string; name_fr: string } | null
    annexes: Array<{ id: number; name: string }>
    lines: AnnexRncLine[]
    submitted_at: string | null
  }>(`/muni/etat-principale/annex-rnc-authorizations`, { method: 'GET', token })
}

export async function muniAnnexRncPatch(
  token: string,
  body: {
    lines: Array<{
      id?: number
      municipality_annex_id?: number
      pc_used?: string | null
      ip_requested?: string | null
    }>
    submit?: boolean
  },
) {
  return http<{
    municipality_id: number
    municipality: { id: number; code: string; name_ar: string; name_fr: string } | null
    annexes: Array<{ id: number; name: string }>
    lines: AnnexRncLine[]
    submitted_at: string | null
  }>(`/muni/etat-principale/annex-rnc-authorizations`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function muniAnnexRncRequestAuthorization(token: string, lineId: number) {
  return http<{
    line: AnnexRncLine
    municipality: { id: number; code: string; name_ar: string; name_fr: string }
    mail_thread_id: number | null
  }>(`/muni/etat-principale/annex-rnc-authorizations/${lineId}/request-rnc-authorization`, {
    method: 'POST',
    token,
    body: JSON.stringify({}),
  })
}

export async function downloadMuniAnnexRncXlsx(token: string, locale: 'ar' | 'fr' = 'ar') {
  const path = `/muni/etat-principale/annex-rnc-authorizations/export.xlsx?locale=${locale}`
  return fetchBlobAttachment(path, token, `annex-rnc-commune.xlsx`)
}

export async function adminListMunicipalityAnnexes(token: string, municipalityId: number) {
  return http<{ annexes: any[]; statuses: string[]; ville_positions: string[] }>(
    `/admin/municipalities/${municipalityId}/annexes`,
    { method: 'GET', token },
  )
}

export async function adminCreateMunicipalityAnnex(
  token: string,
  municipalityId: number,
  body: {
    name: string
    phone_numbers?: string | null
    status?: string
    ville_position?: string
  },
) {
  return http<{ annex: any }>(`/admin/municipalities/${municipalityId}/annexes`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function adminUpdateMunicipalityAnnex(
  token: string,
  municipalityId: number,
  annexId: number,
  body: {
    name?: string
    phone_numbers?: string | null
    status?: string
    ville_position?: string
  },
) {
  return http<{ annex: any }>(`/admin/municipalities/${municipalityId}/annexes/${annexId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function adminDeleteMunicipalityAnnex(token: string, municipalityId: number, annexId: number) {
  return http<{ success: boolean }>(`/admin/municipalities/${municipalityId}/annexes/${annexId}`, {
    method: 'DELETE',
    token,
  })
}

export async function muniListAnnexes(token: string) {
  return http<{ annexes: any[]; statuses: string[]; ville_positions: string[] }>(`/muni/annexes`, {
    method: 'GET',
    token,
  })
}

export async function muniPatchAnnexStatus(token: string, annexId: number, body: { status: string }) {
  return http<{ annex: any }>(`/muni/annexes/${annexId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export type CommuneItStaffRow = {
  id: number
  municipality_id: number
  municipality: { id: number; code: string; name_ar: string; name_fr: string } | null
  first_name: string
  last_name: string
  nin: string | null
  phone: string
  email: string | null
  programming_languages: string
  created_at: string
  updated_at: string
}

export async function adminCommuneItStaffList(
  token: string,
  opts: { page?: number; pageSize?: number; q?: string; municipalityId?: number } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 20
  const q = opts.q ? `&q=${encodeURIComponent(opts.q)}` : ''
  const mid = opts.municipalityId ? `&municipality_id=${opts.municipalityId}` : ''
  return http<{ rows: CommuneItStaffRow[]; total: number; page: number; pageSize: number }>(
    `/admin/commune-it-staff?page=${page}&pageSize=${pageSize}${q}${mid}`,
    { method: 'GET', token },
  )
}

export async function adminCommuneItStaffCreate(
  token: string,
  body: {
    municipality_id: number
    first_name: string
    last_name: string
    nin?: string | null
    phone: string
    email?: string | null
    programming_languages: string
  },
) {
  return http<{ row: CommuneItStaffRow }>(`/admin/commune-it-staff`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function adminCommuneItStaffUpdate(
  token: string,
  id: number,
  body: Partial<{
    municipality_id: number
    first_name: string
    last_name: string
    nin: string | null
    phone: string
    email: string | null
    programming_languages: string
  }>,
) {
  return http<{ row: CommuneItStaffRow }>(`/admin/commune-it-staff/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function adminCommuneItStaffDelete(token: string, id: number) {
  return http<{ success: boolean }>(`/admin/commune-it-staff/${id}`, { method: 'DELETE', token })
}

export async function downloadAdminCommuneItStaffXlsx(
  token: string,
  opts: { locale?: 'ar' | 'fr'; municipalityId?: number } = {},
) {
  const locale = opts.locale || 'ar'
  let path = `/admin/commune-it-staff/export.xlsx?locale=${locale}`
  if (opts.municipalityId) path += `&municipality_id=${opts.municipalityId}`
  return fetchBlobAttachment(path, token, `it-staff-wilaya.xlsx`)
}

export async function muniCommuneItStaffList(token: string) {
  return http<{ rows: CommuneItStaffRow[] }>(`/muni/commune-it-staff`, { method: 'GET', token })
}

export async function muniCommuneItStaffCreate(
  token: string,
  body: {
    first_name: string
    last_name: string
    nin?: string | null
    phone: string
    email?: string | null
    programming_languages: string
  },
) {
  return http<{ row: CommuneItStaffRow }>(`/muni/commune-it-staff`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function muniCommuneItStaffUpdate(
  token: string,
  id: number,
  body: Partial<{
    first_name: string
    last_name: string
    nin: string | null
    phone: string
    email: string | null
    programming_languages: string
  }>,
) {
  return http<{ row: CommuneItStaffRow }>(`/muni/commune-it-staff/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function muniCommuneItStaffDelete(token: string, id: number) {
  return http<{ success: boolean }>(`/muni/commune-it-staff/${id}`, { method: 'DELETE', token })
}

export async function downloadMuniCommuneItStaffXlsx(token: string, locale: 'ar' | 'fr' = 'ar') {
  const path = `/muni/commune-it-staff/export.xlsx?locale=${locale}`
  return fetchBlobAttachment(path, token, `it-staff-commune.xlsx`)
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

