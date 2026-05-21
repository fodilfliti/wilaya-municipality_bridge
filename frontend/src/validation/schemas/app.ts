import { z } from 'zod'
import { requiredString, V } from '../messages'

export const appCreateSchema = z.object({
  app_name: requiredString('appNameRequired').max(255, { message: V.maxLength }),
  description: z.string().trim().max(2000, { message: V.maxLength }).optional(),
})

export const appVersionUploadSchema = z.object({
  version_number: requiredString('versionNumberRequired').max(64, { message: V.maxLength }),
})
