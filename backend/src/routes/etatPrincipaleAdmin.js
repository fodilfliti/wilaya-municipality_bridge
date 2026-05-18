const express = require("express");

const backupServerStatusService = require("../modules/etatPrincipale/backupServerStatusService");

const mcltWorkstationService = require("../modules/etatPrincipale/mcltWorkstationService");

const annexRncAuthorizationService = require("../modules/etatPrincipale/annexRncAuthorizationService");

const { buildBackupServerWilayaExportBuffer } = require("../services/backupServerStatusExcelExport");

const { buildMcltWilayaExportBuffer } = require("../services/mcltWorkstationExcelExport");

const { buildAnnexRncWilayaExportBuffer } = require("../services/annexRncAuthorizationExcelExport");

const {

  buildBackupServerWilayaXlsxFilename,

  buildMcltWilayaXlsxFilename,

  buildAnnexRncWilayaXlsxFilename,

  attachmentContentDisposition,

  exportDateString

} = require("../services/exportFilename");

const { audit } = require("../services/audit");



const etatPrincipaleAdminRouter = express.Router();



function applyMuniFilter(service, payload, req) {

  const mid = service.parseMunicipalityIdFilter(req.query.municipalityId);

  if (mid == null) return payload;

  return service.applyMunicipalityFilter(payload, mid);

}



etatPrincipaleAdminRouter.get("/etat-principale/backup-servers", async (req, res, next) => {

  try {

    const payload = applyMuniFilter(backupServerStatusService, await backupServerStatusService.listWilaya(), req);

    res.json(payload);

  } catch (e) {

    next(e);

  }

});



etatPrincipaleAdminRouter.get("/etat-principale/backup-servers/export.xlsx", async (req, res, next) => {

  try {

    const locale = String(req.query.locale || "ar") === "fr" ? "fr" : "ar";

    const mid = backupServerStatusService.parseMunicipalityIdFilter(req.query.municipalityId);

    const payload = applyMuniFilter(backupServerStatusService, await backupServerStatusService.listWilaya(), req);

    const buf = await buildBackupServerWilayaExportBuffer(payload, locale);

    await audit(req.user.id, "BACKUP_SERVER_STATUS_EXPORT_WILAYA", { locale, municipality_id: mid }, { req });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const utf8Name = buildBackupServerWilayaXlsxFilename();

    const legacy = `backup_servers_wilaya_${exportDateString()}.xlsx`;

    res.setHeader("Content-Disposition", attachmentContentDisposition(utf8Name, legacy));

    res.send(Buffer.from(buf));

  } catch (e) {

    next(e);

  }

});



etatPrincipaleAdminRouter.patch("/etat-principale/backup-servers/:municipalityId", async (req, res, next) => {

  try {

    const payload = await backupServerStatusService.patchWilayaMunicipality(

      req.params.municipalityId,

      req.body || {},

      req.user.id

    );

    await audit(

      req.user.id,

      "BACKUP_SERVER_STATUS_ADMIN_UPDATE",

      { municipality_id: Number(req.params.municipalityId) },

      { req }

    );

    res.json(payload);

  } catch (e) {

    next(e);

  }

});



etatPrincipaleAdminRouter.get("/etat-principale/mclt-workstations", async (req, res, next) => {

  try {

    const payload = applyMuniFilter(mcltWorkstationService, await mcltWorkstationService.listWilaya(), req);

    res.json(payload);

  } catch (e) {

    next(e);

  }

});



etatPrincipaleAdminRouter.get("/etat-principale/mclt-workstations/export.xlsx", async (req, res, next) => {

  try {

    const locale = String(req.query.locale || "ar") === "fr" ? "fr" : "ar";

    const mid = mcltWorkstationService.parseMunicipalityIdFilter(req.query.municipalityId);

    const payload = applyMuniFilter(mcltWorkstationService, await mcltWorkstationService.listWilaya(), req);

    const buf = await buildMcltWilayaExportBuffer(payload, locale);

    await audit(req.user.id, "MCLT_WORKSTATION_EXPORT_WILAYA", { locale, municipality_id: mid }, { req });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const utf8Name = buildMcltWilayaXlsxFilename();

    const legacy = `mclt_wilaya_${exportDateString()}.xlsx`;

    res.setHeader("Content-Disposition", attachmentContentDisposition(utf8Name, legacy));

    res.send(Buffer.from(buf));

  } catch (e) {

    next(e);

  }

});



etatPrincipaleAdminRouter.patch("/etat-principale/mclt-workstations/:municipalityId", async (req, res, next) => {

  try {

    const payload = await mcltWorkstationService.patchWilayaMunicipality(

      req.params.municipalityId,

      req.body || {},

      req.user.id

    );

    await audit(

      req.user.id,

      "MCLT_WORKSTATION_ADMIN_UPDATE",

      { municipality_id: Number(req.params.municipalityId) },

      { req }

    );

    res.json(payload);

  } catch (e) {

    next(e);

  }

});



etatPrincipaleAdminRouter.get("/etat-principale/annex-rnc-authorizations", async (req, res, next) => {

  try {

    const payload = applyMuniFilter(annexRncAuthorizationService, await annexRncAuthorizationService.listWilaya(), req);

    res.json(payload);

  } catch (e) {

    next(e);

  }

});



etatPrincipaleAdminRouter.get("/etat-principale/annex-rnc-authorizations/export.xlsx", async (req, res, next) => {

  try {

    const locale = String(req.query.locale || "ar") === "fr" ? "fr" : "ar";

    const mid = annexRncAuthorizationService.parseMunicipalityIdFilter(req.query.municipalityId);

    const payload = applyMuniFilter(annexRncAuthorizationService, await annexRncAuthorizationService.listWilaya(), req);

    const buf = await buildAnnexRncWilayaExportBuffer(payload, locale);

    await audit(req.user.id, "ANNEX_RNC_AUTH_EXPORT_WILAYA", { locale, municipality_id: mid }, { req });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const utf8Name = buildAnnexRncWilayaXlsxFilename();

    const legacy = `annex_rnc_wilaya_${exportDateString()}.xlsx`;

    res.setHeader("Content-Disposition", attachmentContentDisposition(utf8Name, legacy));

    res.send(Buffer.from(buf));

  } catch (e) {

    next(e);

  }

});



etatPrincipaleAdminRouter.patch("/etat-principale/annex-rnc-authorizations/:municipalityId", async (req, res, next) => {

  try {

    const payload = await annexRncAuthorizationService.patchWilayaMunicipality(

      req.params.municipalityId,

      req.body || {},

      req.user.id

    );

    await audit(

      req.user.id,

      "ANNEX_RNC_AUTH_ADMIN_UPDATE",

      { municipality_id: Number(req.params.municipalityId) },

      { req }

    );

    res.json(payload);

  } catch (e) {

    next(e);

  }

});



module.exports = { etatPrincipaleAdminRouter };


