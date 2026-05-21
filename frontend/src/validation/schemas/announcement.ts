import { z } from 'zod'

const prioritySchema = z.enum(['important', 'urgent'], { message: 'announcementPriorityInvalid' })
const statusSchema = z.enum(['active', 'finished'], { message: 'announcementStatusInvalid' })

const displayDateSchema = z
  .string()
  .trim()
  .min(1, 'announcementDateInvalid')
  .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isNaN(Date.parse(s)), 'announcementDateInvalid')
  .transform((s) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    return new Date(s).toISOString().slice(0, 10)
  })

export const announcementCreateSchema = z.object({
  body_text: z.string().trim().min(1, 'announcementBodyRequired').max(2000, 'validationMaxLength'),
  priority: prioritySchema,
  municipality_id: z
    .union([z.coerce.number().int().positive(), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v == null ? null : v)),
  display_date: displayDateSchema,
})

export const announcementPatchSchema = z
  .object({
    body_text: z.string().trim().min(1, 'announcementBodyRequired').max(2000, 'validationMaxLength').optional(),
    priority: prioritySchema.optional(),
    status: statusSchema.optional(),
    municipality_id: z
      .union([z.coerce.number().int().positive(), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' ? null : v)),
    display_date: displayDateSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'validationRequired', path: ['body_text'] })
