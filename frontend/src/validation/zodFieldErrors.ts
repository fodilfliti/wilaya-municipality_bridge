import type { ZodError } from 'zod'
import { V } from './messages'

export type FieldErrors = Record<string, string>

export function zodToFieldErrors(err: ZodError): { fieldErrors: FieldErrors; formError: string } {
  const fieldErrors: FieldErrors = {}
  for (const issue of err.issues) {
    const path = issue.path.join('.')
    const key = issue.message || V.required
    if (path && !fieldErrors[path]) fieldErrors[path] = key
    if (!path && !fieldErrors._form) fieldErrors._form = key
  }
  const formError = fieldErrors._form || V.formBlocked
  return { fieldErrors, formError }
}

export function firstInvalidFieldId(fieldErrors: FieldErrors, orderedIds: string[]): string | null {
  for (const id of orderedIds) {
    const path = id.replace(/^field-/, '')
    if (fieldErrors[path]) return id
  }
  const firstKey = Object.keys(fieldErrors).find((k) => k !== '_form')
  if (!firstKey) return null
  return `field-${firstKey}`
}

export function focusFirstInvalidField(fieldErrors: FieldErrors, orderedIds: string[]) {
  const id = firstInvalidFieldId(fieldErrors, orderedIds)
  if (!id) return
  requestAnimationFrame(() => {
    const el = document.getElementById(id)
    if (el && 'focus' in el) (el as HTMLElement).focus()
  })
}
