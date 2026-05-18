const express = require("express");
const operationService = require("../modules/operations/operationService");
const { buildMuniExportBuffer } = require("../services/operationExcelExport");
const { buildMuniOperationXlsxFilename, attachmentContentDisposition, exportDateString } = require("../services/exportFilename");
const { Municipality } = require("../db");
const { audit } = require("../services/audit");

const operationsMuniRouter = express.Router();

operationsMuniRouter.get("/operations", async (req, res, next) => {
  try {
    const page = req.query.page;
    const pageSize = req.query.pageSize;
    const q = req.query.q;
    const status = req.query.status;
    const out = await operationService.listOperationsMuni(req.user.id, { page, pageSize, q, status });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

operationsMuniRouter.get("/operations/:operationId", async (req, res, next) => {
  try {
    await operationService.assertRecipient(req.user.id, req.params.operationId);
    const op = await operationService.loadOperationDetail(req.params.operationId, { includeTarget: false });
    if (!op) return res.status(404).json({ error: "Operation not found" });
    res.json({ operation: op });
  } catch (e) {
    next(e);
  }
});

operationsMuniRouter.get("/operations/:operationId/sheet", async (req, res, next) => {
  try {
    await operationService.assertRecipient(req.user.id, req.params.operationId);
    const municipalityId = await operationService.getMunicipalityIdForUser(req.user.id);
    const sheet = await operationService.getSheetBundle(req.params.operationId, municipalityId);
    res.json({ sheet: sheet || null, municipality_id: municipalityId });
  } catch (e) {
    next(e);
  }
});

operationsMuniRouter.put("/operations/:operationId/sheet", async (req, res, next) => {
  try {
    await operationService.assertRecipient(req.user.id, req.params.operationId);
    const municipalityId = await operationService.getMunicipalityIdForUser(req.user.id);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const sheet = await operationService.replaceSheetForMunicipality(
      req.params.operationId,
      municipalityId,
      req.user.id,
      rows
    );
    await audit(
      req.user.id,
      "OPERATION_SHEET_UPDATE",
      { operation_id: Number(req.params.operationId), municipality_id: municipalityId, row_count: rows.length },
      { req }
    );
    res.json({ sheet });
  } catch (e) {
    next(e);
  }
});

operationsMuniRouter.get("/operations/:operationId/export.xlsx", async (req, res, next) => {
  try {
    await operationService.assertRecipient(req.user.id, req.params.operationId);
    const municipalityId = await operationService.getMunicipalityIdForUser(req.user.id);
    const locale = String(req.query.locale || "ar") === "fr" ? "fr" : "ar";
    const op = await operationService.loadOperationDetail(req.params.operationId, { includeTarget: false });
    if (!op) return res.status(404).json({ error: "Operation not found" });
    const muni = await Municipality.findByPk(municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });
    const sheet = await operationService.getSheetBundle(req.params.operationId, municipalityId);
    const buf = await buildMuniExportBuffer(op, muni, sheet, locale);
    await audit(req.user.id, "OPERATION_EXPORT_COMMUNE", { operation_id: Number(req.params.operationId), municipality_id: municipalityId, locale }, { req });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const opId = Number(req.params.operationId);
    const code = muni.code != null ? String(muni.code) : "";
    const utf8Name = buildMuniOperationXlsxFilename(op.title, code, opId);
    const legacyCode = String(code).replace(/[^\w.-]+/g, "_").slice(0, 40) || "commune";
    const legacy = `operation_${opId}_${exportDateString()}_${legacyCode}.xlsx`;
    res.setHeader("Content-Disposition", attachmentContentDisposition(utf8Name, legacy));
    res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
});

module.exports = { operationsMuniRouter };
