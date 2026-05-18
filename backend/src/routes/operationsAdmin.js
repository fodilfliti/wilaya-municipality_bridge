const express = require("express");
const operationService = require("../modules/operations/operationService");
const { buildWilayaExportBuffer, buildWilayaSubmissionReportBuffer } = require("../services/operationExcelExport");
const {
  buildWilayaOperationXlsxFilename,
  buildWilayaSubmissionXlsxFilename,
  attachmentContentDisposition,
  exportDateString,
} = require("../services/exportFilename");
const { audit } = require("../services/audit");
const { getLogger } = require("../logger");
const {
  sendOperationCreatedAnnouncement,
  sendOperationSchemaUpdatedAnnouncement,
} = require("../services/operationAnnouncementMail");

const log = getLogger();

const operationsAdminRouter = express.Router();

operationsAdminRouter.get("/operations/palette-colors", async (req, res, next) => {
  try {
    const colors = await operationService.listPaletteColors();
    res.json({ colors });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.get("/operations", async (req, res, next) => {
  try {
    const page = req.query.page;
    const pageSize = req.query.pageSize;
    const q = req.query.q;
    const status = req.query.status;
    const out = await operationService.listOperationsAdmin({ page, pageSize, q, status });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.post("/operations", async (req, res, next) => {
  try {
    const op = await operationService.createOperation(req.user.id, req.body || {});
    if (!op?.id) throw new Error("Operation create did not return an id");
    await audit(req.user.id, "OPERATION_CREATE", { operation_id: op.id, title: op.title }, { req });
    let notification_mail = { ok: true };
    try {
      const threadId = await sendOperationCreatedAnnouncement(req, op);
      notification_mail = { ok: true, thread_id: threadId };
      await audit(req.user.id, "OPERATION_NOTIFY_MAIL_CREATED", { operation_id: op.id, thread_id: threadId }, { req });
    } catch (mailErr) {
      log.warn({ err: mailErr, operation_id: op.id }, "operation_created_mail_failed");
      notification_mail = { ok: false, error: mailErr?.message || "mail_failed" };
    }
    res.status(201).json({ operation: op, notification_mail });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.post("/operations/:operationId/notify-update-mail", async (req, res, next) => {
  try {
    const op = await operationService.loadOperationDetail(req.params.operationId, { includeTarget: true });
    if (!op) return res.status(404).json({ error: "Operation not found" });
    const note = req.body?.note != null ? String(req.body.note) : "";
    const threadId = await sendOperationSchemaUpdatedAnnouncement(req, op, { note });
    await audit(req.user.id, "OPERATION_NOTIFY_MAIL_UPDATE", { operation_id: op.id, thread_id: threadId }, { req });
    res.json({ thread_id: threadId });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.get("/operations/:operationId", async (req, res, next) => {
  try {
    const op = await operationService.loadOperationDetail(req.params.operationId, { includeTarget: true });
    if (!op) return res.status(404).json({ error: "Operation not found" });
    res.json({ operation: op });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.patch("/operations/:operationId", async (req, res, next) => {
  try {
    const op = await operationService.patchOperation(req.params.operationId, req.body || {});
    await audit(req.user.id, "OPERATION_UPDATE", { operation_id: Number(req.params.operationId) }, { req });
    res.json({ operation: op });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.put("/operations/:operationId/recipients", async (req, res, next) => {
  try {
    const target = req.body?.target ?? req.body;
    const op = await operationService.replaceRecipients(req.params.operationId, target);
    await audit(req.user.id, "OPERATION_RECIPIENTS_REPLACE", { operation_id: Number(req.params.operationId) }, { req });
    res.json({ operation: op });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.post("/operations/:operationId/columns", async (req, res, next) => {
  try {
    const op = await operationService.addColumn(req.params.operationId, req.body || {});
    await audit(req.user.id, "OPERATION_COLUMN_CREATE", { operation_id: Number(req.params.operationId) }, { req });
    res.status(201).json({ operation: op });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.patch("/operations/:operationId/columns/:columnId", async (req, res, next) => {
  try {
    const op = await operationService.updateColumn(req.params.operationId, req.params.columnId, req.body || {});
    await audit(req.user.id, "OPERATION_COLUMN_UPDATE", { operation_id: Number(req.params.operationId), column_id: Number(req.params.columnId) }, { req });
    res.json({ operation: op });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.delete("/operations/:operationId/columns/:columnId", async (req, res, next) => {
  try {
    const op = await operationService.deleteColumn(req.params.operationId, req.params.columnId);
    await audit(req.user.id, "OPERATION_COLUMN_DELETE", { operation_id: Number(req.params.operationId), column_id: Number(req.params.columnId) }, { req });
    res.json({ operation: op });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.post("/operations/:operationId/columns/:columnId/choices", async (req, res, next) => {
  try {
    const op = await operationService.addChoice(req.params.operationId, req.params.columnId, req.body || {});
    await audit(req.user.id, "OPERATION_CHOICE_CREATE", { operation_id: Number(req.params.operationId), column_id: Number(req.params.columnId) }, { req });
    res.status(201).json({ operation: op });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.patch("/operations/:operationId/columns/:columnId/choices/:choiceId", async (req, res, next) => {
  try {
    const op = await operationService.updateChoice(
      req.params.operationId,
      req.params.columnId,
      req.params.choiceId,
      req.body || {}
    );
    await audit(
      req.user.id,
      "OPERATION_CHOICE_UPDATE",
      { operation_id: Number(req.params.operationId), column_id: Number(req.params.columnId), choice_id: Number(req.params.choiceId) },
      { req }
    );
    res.json({ operation: op });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.delete("/operations/:operationId/columns/:columnId/choices/:choiceId", async (req, res, next) => {
  try {
    const op = await operationService.deleteChoice(req.params.operationId, req.params.columnId, req.params.choiceId);
    await audit(
      req.user.id,
      "OPERATION_CHOICE_DELETE",
      { operation_id: Number(req.params.operationId), column_id: Number(req.params.columnId), choice_id: Number(req.params.choiceId) },
      { req }
    );
    res.json({ operation: op });
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.get("/operations/:operationId/results", async (req, res, next) => {
  try {
    const payload = await operationService.getResults(req.params.operationId);
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.get("/operations/:operationId/export.xlsx", async (req, res, next) => {
  try {
    const locale = String(req.query.locale || "ar") === "fr" ? "fr" : "ar";
    const results = await operationService.getResults(req.params.operationId);
    const buf = await buildWilayaExportBuffer(results, locale);
    await audit(req.user.id, "OPERATION_EXPORT_WILAYA", { operation_id: Number(req.params.operationId), locale }, { req });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const opId = Number(req.params.operationId);
    const utf8Name = buildWilayaOperationXlsxFilename(results.operation?.title, opId);
    const legacy = `operation_${opId}_${exportDateString()}.xlsx`;
    res.setHeader("Content-Disposition", attachmentContentDisposition(utf8Name, legacy));
    res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
});

operationsAdminRouter.get("/operations/:operationId/export-submission.xlsx", async (req, res, next) => {
  try {
    const locale = String(req.query.locale || "ar") === "fr" ? "fr" : "ar";
    const results = await operationService.getResults(req.params.operationId);
    const buf = await buildWilayaSubmissionReportBuffer(results, locale);
    await audit(req.user.id, "OPERATION_EXPORT_SUBMISSION", { operation_id: Number(req.params.operationId), locale }, { req });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const opId = Number(req.params.operationId);
    const utf8Name = buildWilayaSubmissionXlsxFilename(results.operation?.title, opId);
    const legacy = `operation_${opId}_${exportDateString()}_submission.xlsx`;
    res.setHeader("Content-Disposition", attachmentContentDisposition(utf8Name, legacy));
    res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
});

module.exports = { operationsAdminRouter };
