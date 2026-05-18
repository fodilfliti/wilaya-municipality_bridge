const express = require("express");
const communeItStaffService = require("../modules/communeItStaff/communeItStaffService");
const { buildWilayaExportBuffer } = require("../services/communeItStaffExcelExport");
const {
  buildCommuneItStaffWilayaXlsxFilename,
  attachmentContentDisposition,
  exportDateString
} = require("../services/exportFilename");
const { audit } = require("../services/audit");

const communeItStaffAdminRouter = express.Router();

communeItStaffAdminRouter.get("/commune-it-staff", async (req, res, next) => {
  try {
    const out = await communeItStaffService.listWilaya({
      page: req.query.page,
      pageSize: req.query.pageSize,
      q: req.query.q,
      municipality_id: req.query.municipality_id
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

communeItStaffAdminRouter.get("/commune-it-staff/export.xlsx", async (req, res, next) => {
  try {
    const locale = String(req.query.locale || "ar") === "fr" ? "fr" : "ar";
    const rows = await communeItStaffService.listAllForExportWilaya({
      municipality_id: req.query.municipality_id
    });
    const buf = await buildWilayaExportBuffer(rows, locale);
    await audit(req.user.id, "COMMUNE_IT_STAFF_EXPORT_WILAYA", { row_count: rows.length, locale }, { req });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const utf8Name = buildCommuneItStaffWilayaXlsxFilename();
    const legacy = `it_staff_wilaya_${exportDateString()}.xlsx`;
    res.setHeader("Content-Disposition", attachmentContentDisposition(utf8Name, legacy));
    res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
});

communeItStaffAdminRouter.get("/commune-it-staff/:id", async (req, res, next) => {
  try {
    const out = await communeItStaffService.getByIdForWilaya(req.params.id);
    if (out.error) return res.status(out.status).json({ error: out.error });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

communeItStaffAdminRouter.post("/commune-it-staff", async (req, res, next) => {
  try {
    const out = await communeItStaffService.createWilaya(req.body || {});
    if (out.error) return res.status(out.status).json({ error: out.error });
    await audit(req.user.id, "COMMUNE_IT_STAFF_CREATE", { id: out.row.id, municipality_id: out.row.municipality_id }, { req });
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
});

communeItStaffAdminRouter.patch("/commune-it-staff/:id", async (req, res, next) => {
  try {
    const out = await communeItStaffService.updateWilaya(req.params.id, req.body || {});
    if (out.error) return res.status(out.status).json({ error: out.error });
    await audit(req.user.id, "COMMUNE_IT_STAFF_UPDATE", { id: out.row.id, municipality_id: out.row.municipality_id }, { req });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

communeItStaffAdminRouter.delete("/commune-it-staff/:id", async (req, res, next) => {
  try {
    const out = await communeItStaffService.deleteWilaya(req.params.id);
    if (out.error) return res.status(out.status).json({ error: out.error });
    await audit(req.user.id, "COMMUNE_IT_STAFF_DELETE", { id: Number(req.params.id) }, { req });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

module.exports = { communeItStaffAdminRouter };
