import type { TFunction } from 'i18next'
import { mapErrorCodeToI18nKey } from './mapValidationError'
import { V } from '../validation/messages'

/** Turn raw API / DB errors into short, translated hints where possible. */
export function formatApiErrorMessage(raw: string, t: TFunction): string {
  const mapped = mapErrorCodeToI18nKey(raw)
  if (mapped) return t(mapped)
  const s = String(raw || '')
  const lower = s.toLowerCase()
  if (
    (lower.includes('column') && lower.includes('does not exist')) ||
    lower.includes('unknown column')
  ) {
    return t('errorDbMissingColumn')
  }
  if (lower.includes('relation') && lower.includes('does not exist')) {
    return t('errorDbMissingTable')
  }
  if (lower.includes('econnrefused') || lower.includes('failed to fetch') || lower.includes('network')) {
    return t('errorNetwork')
  }
  if (s === 'VALIDATION_ERROR') return t(V.formBlocked)
  return s || t(V.unknownError)
}
