import type { TFunction } from 'i18next'
import { V } from '../validation/messages'

/** Map backend error codes / legacy English messages to i18n keys */
const LEGACY_MAP: Record<string, string> = {
  'first_name is required': V.itStaffFirstNameRequired,
  'last_name is required': V.itStaffLastNameRequired,
  'phone is required': V.itStaffPhoneRequired,
  'programming_languages is required': V.itStaffLangsRequired,
  'programming_languages too long': V.maxLength,
  'first_name too long': V.maxLength,
  'last_name too long': V.maxLength,
  'Invalid email format': V.itStaffEmailInvalid,
  'municipality_id is required': V.itStaffMunicipalityRequired,
  'Municipality not found': 'validationMunicipalityNotFound',
  VALIDATION_ERROR: V.formBlocked,
  'username is required': 'usernameRequired',
  'Invalid username format': 'errorUsernameFormat',
  'username already exists': 'errorUsernameExists',
  'subject is required': V.mailSubjectRequired,
  'body_html is required': V.mailBodyRequired,
  mailValidationFeedbackRequired: 'mailValidationFeedbackRequired',
  'Requested IP is required before requesting authorization': 'annexRncIpRequestedRequired',
  annexRncIpRequestedRequired: 'annexRncIpRequestedRequired',
  'Requested IP is required for each line': 'annexRncIpRequestedRequired',
  'Authorization request already pending': 'annexRncRncAlreadyPending',
  'IP already authorized': 'annexRncRncAlreadyApproved',
}

export function mapErrorCodeToI18nKey(raw: string): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  if (LEGACY_MAP[s]) return LEGACY_MAP[s]
  const lower = s.toLowerCase()
  for (const [k, v] of Object.entries(LEGACY_MAP)) {
    if (k.toLowerCase() === lower) return v
  }
  if (
    s.startsWith('validation') ||
    s.startsWith('itStaff') ||
    s.startsWith('mail') ||
    s.startsWith('login') ||
    s.startsWith('error') ||
    s.startsWith('username') ||
    s.startsWith('choose') ||
    s.startsWith('version') ||
    s.startsWith('app') ||
    s.startsWith('municipality') ||
    s.startsWith('annexRnc')
  ) {
    return s
  }
  return null
}

export function translateFieldErrors(
  fieldErrors: Record<string, string> | undefined,
  t: TFunction
): Record<string, string> {
  if (!fieldErrors) return {}
  const out: Record<string, string> = {}
  for (const [path, code] of Object.entries(fieldErrors)) {
    const key = mapErrorCodeToI18nKey(code) || code
    out[path] = t(key, { defaultValue: t(V.unknownError) })
  }
  return out
}
