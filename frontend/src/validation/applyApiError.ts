import type { TFunction } from 'i18next'
import * as api from '../api'
import { formatApiErrorMessage } from '../snackbar/formatApiErrorMessage'
import type { FieldErrors } from './zodFieldErrors'

export function applyApiErrorToForm(
  e: unknown,
  t: TFunction,
  opts: {
    setFormError: (msg: string | null) => void
    setFieldErrors?: (fe: FieldErrors) => void
    snackShow?: (msg: string, variant: 'error') => void
  }
) {
  const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'VALIDATION_ERROR')
  const msg = formatApiErrorMessage(raw, t)
  opts.setFormError(msg)
  opts.snackShow?.(msg, 'error')
  if (opts.setFieldErrors && e instanceof api.ApiError && e.fieldErrors) {
    opts.setFieldErrors({ ...e.fieldErrors })
  }
}

export function apiErrorMessage(e: unknown, t: TFunction): string {
  const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || 'VALIDATION_ERROR')
  return formatApiErrorMessage(raw, t)
}
