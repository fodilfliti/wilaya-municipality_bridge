import { useCallback, useState } from 'react'
import type { TFunction } from 'i18next'
import type { ZodSchema } from 'zod'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { mapErrorCodeToI18nKey } from '../snackbar/mapValidationError'
import { V } from './messages'
import { focusFirstInvalidField, zodToFieldErrors, type FieldErrors } from './zodFieldErrors'

export function useZodForm<T>(schema: ZodSchema<T>) {
  const snack = useSnackbar()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const clearErrors = useCallback(() => {
    setFieldErrors({})
    setFormError(null)
  }, [])

  const clearField = useCallback((path: string) => {
    setFieldErrors((prev) => {
      if (!prev[path]) return prev
      const next = { ...prev }
      delete next[path]
      return next
    })
  }, [])

  const validate = useCallback(
    (data: unknown, t: TFunction, orderedFieldIds?: string[]): data is T => {
      const parsed = schema.safeParse(data)
      if (parsed.success) {
        clearErrors()
        return true
      }
      const { fieldErrors: fe, formError: feKey } = zodToFieldErrors(parsed.error)
      setFieldErrors(fe)
      setFormError(t(feKey))
      snack.show(t(V.fixFields), 'error')
      if (orderedFieldIds?.length) focusFirstInvalidField(fe, orderedFieldIds)
      return false
    },
    [schema, clearErrors, snack]
  )

  const fieldErrorText = useCallback(
    (path: string, t: TFunction) => {
      const raw = fieldErrors[path]
      if (!raw) return null
      const key = mapErrorCodeToI18nKey(raw) || raw
      return t(key)
    },
    [fieldErrors]
  )

  const setFieldErrorsFromApi = useCallback((fe: FieldErrors) => {
    setFieldErrors(fe)
  }, [])

  const hasFieldError = useCallback((path: string) => Boolean(fieldErrors[path]), [fieldErrors])

  return {
    fieldErrors,
    formError,
    setFormError,
    clearErrors,
    clearField,
    validate,
    fieldErrorText,
    hasFieldError,
    setFieldErrors: setFieldErrorsFromApi,
  }
}
