import { z } from 'zod'
import { optionalEmailLegacy, requiredString, V } from '../messages'

const langsMax = 16000

export const communeItStaffBodySchema = z.object({
  first_name: requiredString(V.itStaffFirstNameRequired).max(120, { message: V.maxLength }),
  last_name: requiredString(V.itStaffLastNameRequired).max(120, { message: V.maxLength }),
  nin: z
    .string()
    .trim()
    .max(50, { message: V.maxLength })
    .optional()
    .nullable()
    .transform((s) => (s == null || s === '' ? null : s)),
  phone: requiredString(V.itStaffPhoneRequired).max(40, { message: V.maxLength }),
  email: optionalEmailLegacy(),
  programming_languages: requiredString(V.itStaffLangsRequired).max(langsMax, { message: V.maxLength }),
})

export const communeItStaffAdminCreateSchema = communeItStaffBodySchema.extend({
  municipality_id: z.coerce.number().int().positive({ message: V.itStaffMunicipalityRequired }),
})

export type CommuneItStaffBody = z.infer<typeof communeItStaffBodySchema>
export type CommuneItStaffAdminCreate = z.infer<typeof communeItStaffAdminCreateSchema>
