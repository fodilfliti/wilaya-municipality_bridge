import { z } from 'zod'
import { requiredString, V } from '../messages'

const targetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ALL_COMMUNES') }),
  z.object({
    type: z.literal('COMMUNES'),
    municipality_ids: z.array(z.number().int().positive()).min(1, { message: V.mailTargetRequired }),
  }),
  z.object({
    type: z.literal('USERS'),
    user_ids: z.array(z.number().int().positive()).min(1, { message: V.mailTargetRequired }),
  }),
])

export const mailComposeSchema = z
  .object({
    subject: requiredString(V.mailSubjectRequired).max(500, { message: V.maxLength }),
    body_html: requiredString(V.mailBodyRequired),
    target: targetSchema,
    send_mode: z.enum(['DIRECT', 'VALIDATION']),
    validator_user_ids: z.array(z.number().int().positive()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.send_mode === 'VALIDATION') {
      const ids = data.validator_user_ids || []
      if (ids.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: V.mailValidatorsRequired,
          path: ['validator_user_ids'],
        })
      }
    }
  })

export type MailComposeForm = z.infer<typeof mailComposeSchema>

const muniTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ALL_WILAYA_ADMINS') }),
  z.object({
    type: z.literal('WILAYA_ADMINS'),
    user_ids: z.array(z.number().int().positive()).min(1, { message: V.mailTargetRequired }),
  }),
])

export const muniMailComposeSchema = z
  .object({
    subject: requiredString(V.mailSubjectRequired).max(500, { message: V.maxLength }),
    body_html: requiredString(V.mailBodyRequired),
    target: muniTargetSchema,
    send_mode: z.enum(['DIRECT', 'VALIDATION']),
    validator_user_ids: z.array(z.number().int().positive()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.send_mode === 'VALIDATION') {
      const ids = data.validator_user_ids || []
      if (ids.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: V.mailValidatorsRequired,
          path: ['validator_user_ids'],
        })
      }
    }
  })
