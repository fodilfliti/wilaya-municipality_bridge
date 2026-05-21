import { z } from 'zod'
import { requiredString, V } from '../messages'

const annexRncLineSchema = z.object({
  municipality_annex_id: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === 'string' ? Number(v) : v))
    .pipe(z.number().int().positive({ message: V.required })),
  ip_requested: requiredString('annexRncIpRequestedRequired'),
})

export const annexRncMuniSaveSchema = z.object({
  lines: z.array(annexRncLineSchema).min(1, { message: V.required }),
})
