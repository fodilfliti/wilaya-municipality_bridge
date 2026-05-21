import { z } from 'zod'
import { requiredString, V } from '../messages'

export const annexFormSchema = z.object({
  name: requiredString('annexNameRequired').max(255, { message: V.maxLength }),
})
