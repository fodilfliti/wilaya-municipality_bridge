const { z } = require("zod");
const { V } = require("../errorKeys");

const USERNAME_RE = /^[A-Za-z0-9_]+$/;

const appCreateSchema = z.object({
  app_name: z.string().trim().min(1, V.appNameRequired).max(255, V.maxLength),
  description: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null) return null;
      const s = String(v).trim();
      return s ? s.slice(0, 2000) : null;
    }),
});

const appPatchSchema = appCreateSchema.partial();

const municipalityCreateSchema = z.object({
  name_ar: z.string().trim().min(1, V.municipalityNameArRequired).max(255, V.maxLength),
  name_fr: z.string().trim().min(1, V.municipalityNameFrRequired).max(255, V.maxLength),
  code: z
    .string()
    .trim()
    .min(1, V.municipalityCodeRequired)
    .max(32, V.maxLength)
    .regex(/^\d+$/, V.municipalityCodeDigitsOnly),
});

const municipalityPatchSchema = municipalityCreateSchema.partial();

// Validate only username + basic fields; allow extra profile fields through.
const userCreateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, V.usernameRequired)
      .max(120, V.maxLength)
      .refine((s) => USERNAME_RE.test(s), V.errorUsernameFormat),
    name: z
      .union([z.string(), z.null()])
      .optional()
      .transform((v) => {
        if (v == null) return null;
        const s = String(v).trim();
        return s ? s.slice(0, 255) : null;
      }),
  })
  .passthrough();

module.exports = {
  appCreateSchema,
  appPatchSchema,
  municipalityCreateSchema,
  municipalityPatchSchema,
  userCreateSchema,
};

