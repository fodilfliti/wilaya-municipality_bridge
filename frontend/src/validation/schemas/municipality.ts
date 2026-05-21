import { z } from 'zod'
import { requiredString, V } from '../messages'

export const municipalityCreateSchema = z.object({
  name_ar: requiredString(V.municipalityNameArRequired).max(255, { message: V.maxLength }),
  name_fr: requiredString(V.municipalityNameFrRequired).max(255, { message: V.maxLength }),
  code: requiredString(V.municipalityCodeRequired)
    .max(32, { message: V.maxLength })
    .regex(/^\d+$/, { message: V.municipalityCodeDigitsOnly }),
})

export type MunicipalityCreateForm = z.infer<typeof municipalityCreateSchema>
