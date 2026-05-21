const express = require("express");
const communeItStaffService = require("../modules/communeItStaff/communeItStaffService");
const { validateBody } = require("../middleware/validateBody");
const { communeItStaffBodySchema } = require("../validation/schemas/communeItStaff");

function sendServiceError(res, out, req) {
  if (out.fieldErrors) {
    return res.status(out.status || 400).json({
      error: "VALIDATION_ERROR",
      fieldErrors: out.fieldErrors,
      requestId: req.requestId
    });
  }
  return res.status(out.status || 400).json({ error: out.error, requestId: req.requestId });
}
const { buildMuniExportBuffer } = require("../services/communeItStaffExcelExport");
const {
  buildCommuneItStaffMuniXlsxFilename,
  attachmentContentDisposition,
  exportDateString
} = require("../services/exportFilename");
const { Municipality } = require("../db");
const { audit } = require("../services/audit");

const communeItStaffMuniRouter = express.Router();

communeItStaffMuniRouter.get("/commune-it-staff", async (req, res, next) => {
  try {
    if (req.user.role !== "MUNI_ADMIN" || !req.user.municipality_id) {
      return res.status(403).json({ error: "Only commune administrators can access this registry" });
    }
    const out = await communeItStaffService.listMuni(req.user.municipality_id);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

communeItStaffMuniRouter.get("/commune-it-staff/export.xlsx", async (req, res, next) => {
  try {
    if (req.user.role !== "MUNI_ADMIN" || !req.user.municipality_id) {
      return res.status(403).json({ error: "Only commune administrators can export this registry" });
    }
    const locale = String(req.query.locale || "ar") === "fr" ? "fr" : "ar";
    const rows = await communeItStaffService.listAllForExportMuni(req.user.municipality_id);
    const muni = await Municipality.findByPk(req.user.municipality_id);
    const buf = await buildMuniExportBuffer(rows, locale);
    await audit(
      req.user.id,
      "COMMUNE_IT_STAFF_EXPORT_COMMUNE",
      { municipality_id: req.user.municipality_id, row_count: rows.length, locale },
      { req }
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const code = muni?.code || "commune";
    const utf8Name = buildCommuneItStaffMuniXlsxFilename(code);
    const legacy = `it_staff_${String(code).replace(/[^\w.-]+/g, "_")}_${exportDateString()}.xlsx`;
    res.setHeader("Content-Disposition", attachmentContentDisposition(utf8Name, legacy));
    res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
});

communeItStaffMuniRouter.post("/commune-it-staff", validateBody(communeItStaffBodySchema), async (req, res, next) => {
  try {
    if (req.user.role !== "MUNI_ADMIN" || !req.user.municipality_id) {
      return res.status(403).json({ error: "Only commune administrators can add rows" });
    }
    const out = await communeItStaffService.createMuni(req.user.municipality_id, req.validatedBody || {});
    if (out.error) return sendServiceError(res, out, req);
    await audit(req.user.id, "COMMUNE_IT_STAFF_CREATE", { id: out.row.id, municipality_id: out.row.municipality_id }, { req });
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
});

communeItStaffMuniRouter.patch(
  "/commune-it-staff/:id",
  validateBody(communeItStaffBodySchema.partial()),
  async (req, res, next) => {
  try {
    if (req.user.role !== "MUNI_ADMIN" || !req.user.municipality_id) {
      return res.status(403).json({ error: "Only commune administrators can update rows" });
    }
    const out = await communeItStaffService.updateMuni(req.user.municipality_id, req.params.id, req.validatedBody || {});
    if (out.error) return sendServiceError(res, out, req);
    await audit(req.user.id, "COMMUNE_IT_STAFF_UPDATE", { id: out.row.id, municipality_id: out.row.municipality_id }, { req });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

communeItStaffMuniRouter.delete("/commune-it-staff/:id", async (req, res, next) => {
  try {
    if (req.user.role !== "MUNI_ADMIN" || !req.user.municipality_id) {
      return res.status(403).json({ error: "Only commune administrators can delete rows" });
    }
    const out = await communeItStaffService.deleteMuni(req.user.municipality_id, req.params.id);
    if (out.error) return res.status(out.status).json({ error: out.error });
    await audit(req.user.id, "COMMUNE_IT_STAFF_DELETE", { id: Number(req.params.id), municipality_id: req.user.municipality_id }, { req });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

module.exports = { communeItStaffMuniRouter };
