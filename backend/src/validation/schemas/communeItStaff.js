const { z } = require("zod");
const { V } = require("../errorKeys");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const communeItStaffBodySchema = z.object({
  first_name: z.string().trim().min(1, V.itStaffFirstNameRequired).max(120, V.maxLength),
  last_name: z.string().trim().min(1, V.itStaffLastNameRequired).max(120, V.maxLength),
  nin: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null) return null;
      const s = String(v).trim();
      return s ? s.slice(0, 50) : null;
    }),
  phone: z.string().trim().min(1, V.itStaffPhoneRequired).max(40, V.maxLength),
  email: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const s = String(v).trim().slice(0, 255);
      return s || null;
    })
    .refine((v) => v == null || EMAIL_RE.test(v), V.invalidEmail),
  programming_languages: z
    .string()
    .trim()
    .min(1, V.itStaffLangsRequired)
    .max(16000, V.maxLength)
});

const communeItStaffAdminCreateSchema = communeItStaffBodySchema.extend({
  municipality_id: z.coerce.number().int().positive(V.itStaffMunicipalityRequired)
});

module.exports = {
  communeItStaffBodySchema,
  communeItStaffAdminCreateSchema
};
