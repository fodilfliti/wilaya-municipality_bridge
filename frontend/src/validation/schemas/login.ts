import { z } from 'zod'
import { requiredString, V } from '../messages'

export const loginSchema = z.object({
  username: requiredString(V.loginUsernameRequired),
  password: requiredString(V.loginPasswordRequired),
})

export type LoginForm = z.infer<typeof loginSchema>
