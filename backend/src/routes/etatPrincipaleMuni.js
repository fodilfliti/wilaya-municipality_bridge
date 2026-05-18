const express = require("express");
const backupServerStatusService = require("../modules/etatPrincipale/backupServerStatusService");
const mcltWorkstationService = require("../modules/etatPrincipale/mcltWorkstationService");
const annexRncAuthorizationService = require("../modules/etatPrincipale/annexRncAuthorizationService");
const { buildBackupServerMuniExportBuffer } = require("../services/backupServerStatusExcelExport");
const { buildMcltMuniExportBuffer } = require("../services/mcltWorkstationExcelExport");
const { buildAnnexRncMuniExportBuffer } = require("../services/annexRncAuthorizationExcelExport");
const { sendMcltRncAuthorizationRequestMail } = require("../services/mcltRncAuthorizationMail");
const { sendAnnexRncAuthorizationRequestMail } = require("../services/annexRncAuthorizationMail");
const {
  buildBackupServerMuniXlsxFilename,
  buildMcltMuniXlsxFilename,
  buildAnnexRncMuniXlsxFilename,
  attachmentContentDisposition,
  exportDateString
} = require("../services/exportFilename");
const { audit } = require("../services/audit");

const etatPrincipaleMuniRouter = express.Router();

etatPrincipaleMuniRouter.get("/etat-principale/backup-servers", async (req, res, next) => {
  try {
    const out = await backupServerStatusService.getForMuniUser(req.user.id);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

etatPrincipaleMuniRouter.patch("/etat-principale/backup-servers", async (req, res, next) => {
  try {
    const out = await backupServerStatusService.patchForMuniUser(req.user.id, req.body || {});
    await audit(req.user.id, "BACKUP_SERVER_STATUS_UPDATE", { municipality_id: out.municipality_id }, { req });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

etatPrincipaleMuniRouter.get("/etat-principale/backup-servers/export.xlsx", async (req, res, next) => {
  try {
    const locale = String(req.query.locale || "ar") === "fr" ? "fr" : "ar";
    const out = await backupServerStatusService.getForMuniUser(req.user.id);
    const muni = out.municipality;
    if (!muni) return res.status(404).json({ error: "Municipality not found" });
    const buf = await buildBackupServerMuniExportBuffer(muni, out, locale);
    await audit(req.user.id, "BACKUP_SERVER_STATUS_EXPORT_COMMUNE", { municipality_id: out.municipality_id, locale }, { req });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const utf8Name = buildBackupServerMuniXlsxFilename(muni.code);
    const legacy = `backup_servers_${String(muni.code || "commune").replace(/[^\w.-]+/g, "_")}_${exportDateString()}.xlsx`;
    res.setHeader("Content-Disposition", attachmentContentDisposition(utf8Name, legacy));
    res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
});

etatPrincipaleMuniRouter.get("/etat-principale/mclt-workstations", async (req, res, next) => {
  try {
    const out = await mcltWorkstationService.getForMuniUser(req.user.id);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

etatPrincipaleMuniRouter.patch("/etat-principale/mclt-workstations", async (req, res, next) => {
  try {
    const out = await mcltWorkstationService.patchForMuniUser(req.user.id, req.body || {});
    await audit(req.user.id, "MCLT_WORKSTATION_UPDATE", { municipality_id: out.municipality_id }, { req });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

etatPrincipaleMuniRouter.post("/etat-principale/mclt-workstations/:id/request-rnc-authorization", async (req, res, next) => {
  try {
    const out = await mcltWorkstationService.requestRncAuthorization(req.user.id, req.params.id, req.body || {});
    let mailThreadId = null;
    try {
      mailThreadId = await sendMcltRncAuthorizationRequestMail(req, out);
    } catch (mailErr) {
      // eslint-disable-next-line no-console
      console.error("MCLT RNC mail failed:", mailErr);
    }
    await audit(
      req.user.id,
      "MCLT_RNC_AUTH_REQUEST",
      { workstation_id: Number(req.params.id), municipality_id: out.municipality?.id, mail_thread_id: mailThreadId },
      { req }
    );
    res.json({ ...out, mail_thread_id: mailThreadId });
  } catch (e) {
    next(e);
  }
});

etatPrincipaleMuniRouter.get("/etat-principale/mclt-workstations/export.xlsx", async (req, res, next) => {
  try {
    const locale = String(req.query.locale || "ar") === "fr" ? "fr" : "ar";
    const out = await mcltWorkstationService.getForMuniUser(req.user.id);
    const muni = out.municipality;
    if (!muni) return res.status(404).json({ error: "Municipality not found" });
    const buf = await buildMcltMuniExportBuffer(muni, out, locale);
    await audit(req.user.id, "MCLT_WORKSTATION_EXPORT_COMMUNE", { municipality_id: out.municipality_id, locale }, { req });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const utf8Name = buildMcltMuniXlsxFilename(muni.code);
    const legacy = `mclt_${String(muni.code || "commune").replace(/[^\w.-]+/g, "_")}_${exportDateString()}.xlsx`;
    res.setHeader("Content-Disposition", attachmentContentDisposition(utf8Name, legacy));
    res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
});

etatPrincipaleMuniRouter.get("/etat-principale/annex-rnc-authorizations", async (req, res, next) => {
  try {
    const out = await annexRncAuthorizationService.getForMuniUser(req.user.id);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

etatPrincipaleMuniRouter.patch("/etat-principale/annex-rnc-authorizations", async (req, res, next) => {
  try {
    const out = await annexRncAuthorizationService.patchForMuniUser(req.user.id, req.body || {});
    await audit(req.user.id, "ANNEX_RNC_AUTH_UPDATE", { municipality_id: out.municipality_id }, { req });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

etatPrincipaleMuniRouter.post("/etat-principale/annex-rnc-authorizations/:id/request-rnc-authorization", async (req, res, next) => {
  try {
    const out = await annexRncAuthorizationService.requestRncAuthorization(req.user.id, req.params.id);
    let mailThreadId = null;
    try {
      mailThreadId = await sendAnnexRncAuthorizationRequestMail(req, out);
    } catch (mailErr) {
      // eslint-disable-next-line no-console
      console.error("Annex RNC mail failed:", mailErr);
    }
    await audit(
      req.user.id,
      "ANNEX_RNC_AUTH_REQUEST",
      { line_id: Number(req.params.id), municipality_id: out.municipality?.id, mail_thread_id: mailThreadId },
      { req }
    );
    res.json({ ...out, mail_thread_id: mailThreadId });
  } catch (e) {
    next(e);
  }
});

etatPrincipaleMuniRouter.get("/etat-principale/annex-rnc-authorizations/export.xlsx", async (req, res, next) => {
  try {
    const locale = String(req.query.locale || "ar") === "fr" ? "fr" : "ar";
    const out = await annexRncAuthorizationService.getForMuniUser(req.user.id);
    const muni = out.municipality;
    if (!muni) return res.status(404).json({ error: "Municipality not found" });
    const buf = await buildAnnexRncMuniExportBuffer(muni, out, locale);
    await audit(req.user.id, "ANNEX_RNC_AUTH_EXPORT_COMMUNE", { municipality_id: out.municipality_id, locale }, { req });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const utf8Name = buildAnnexRncMuniXlsxFilename(muni.code);
    const legacy = `annex_rnc_${String(muni.code || "commune").replace(/[^\w.-]+/g, "_")}_${exportDateString()}.xlsx`;
    res.setHeader("Content-Disposition", attachmentContentDisposition(utf8Name, legacy));
    res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
});

module.exports = { etatPrincipaleMuniRouter };
