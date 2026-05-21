import { z } from 'zod'

/** i18n keys returned in Zod issue messages — never human-readable text */
export const V = {
  required: 'validationRequired',
  invalidEmail: 'validationInvalidEmail',
  invalidFormat: 'validationInvalidFormat',
  maxLength: 'validationMaxLength',
  fixFields: 'validationFixFields',
  formBlocked: 'validationFormBlocked',
  unknownError: 'validationUnknownError',
  loginUsernameRequired: 'loginUsernameRequired',
  loginPasswordRequired: 'loginPasswordRequired',
  itStaffFirstNameRequired: 'itStaffFirstNameRequired',
  itStaffLastNameRequired: 'itStaffLastNameRequired',
  itStaffPhoneRequired: 'itStaffPhoneRequired',
  itStaffLangsRequired: 'itStaffLangsRequired',
  itStaffEmailInvalid: 'itStaffEmailInvalid',
  itStaffMunicipalityRequired: 'itStaffMunicipalityRequired',
  mailSubjectRequired: 'mailSubjectRequired',
  mailBodyRequired: 'mailBodyRequired',
  mailTargetRequired: 'mailTargetRequired',
  mailValidatorsRequired: 'mailValidatorsRequired',
  municipalityNameArRequired: 'municipalityNameArRequired',
  municipalityNameFrRequired: 'municipalityNameFrRequired',
  municipalityCodeRequired: 'municipalityCodeRequired',
  municipalityCodeDigitsOnly: 'municipalityCodeDigitsOnly',
  annexRncIpRequestedRequired: 'annexRncIpRequestedRequired',
} as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function requiredString(key: string = V.required) {
  return z.string().trim().min(1, { message: key })
}

export function optionalEmailLegacy() {
  return z
    .string()
    .trim()
    .transform((s) => (s === '' ? null : s))
    .refine((s) => s == null || EMAIL_RE.test(s), { message: V.itStaffEmailInvalid })
}
