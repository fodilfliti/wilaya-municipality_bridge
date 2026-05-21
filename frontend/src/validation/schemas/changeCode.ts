import { z } from 'zod'
import { requiredString } from '../messages'

export const changeCodeSchema = z.object({
  current_code: requiredString('currentCodeRequired'),
  new_code: requiredString('newCodeRequired'),
})
