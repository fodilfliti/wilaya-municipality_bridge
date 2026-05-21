const { z } = require("zod");
const { V } = require("../errorKeys");

const prioritySchema = z.enum(["important", "urgent"], { message: "announcementPriorityInvalid" });
const statusSchema = z.enum(["active", "finished"], { message: "announcementStatusInvalid" });

const displayDateSchema = z
  .union([z.string(), z.date()])
  .transform((v) => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s;
  })
  .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), "announcementDateInvalid");

const announcementCreateSchema = z.object({
  body_text: z.string().trim().min(1, "announcementBodyRequired").max(2000, V.maxLength),
  priority: prioritySchema,
  municipality_id: z
    .union([z.coerce.number().int().positive(), z.null(), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  display_date: displayDateSchema
});

const announcementPatchSchema = z
  .object({
    body_text: z.string().trim().min(1, "announcementBodyRequired").max(2000, V.maxLength).optional(),
    priority: prioritySchema.optional(),
    status: statusSchema.optional(),
    municipality_id: z
      .union([z.coerce.number().int().positive(), z.null(), z.literal("")])
      .optional()
      .transform((v) => (v === "" ? null : v)),
    display_date: displayDateSchema.optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: "validationRequired", path: ["body_text"] });

module.exports = {
  announcementCreateSchema,
  announcementPatchSchema
};
