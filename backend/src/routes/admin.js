const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const { requireAuth, attachUser, checkBlocked, requireRole } = require("../middleware/auth");
const { Op } = require("sequelize");
const { Application, AppVersion, Municipality, User, Download, MailThread, MailMessage, MailRecipient, MailAttachment, sequelize, BackupServerStatus } = require("../db");
const { audit } = require("../services/audit");
const { withTxAudit } = require("../services/txAudit");
const { storageRoot, publicFileUrl } = require("../services/storage");
const { generate8DigitCode, generateUsernameFromMunicipalityCode } = require("../services/security");
const { generateCredentialsPdf, generateVersionProgressPdf } = require("../services/pdf");
const { operationsAdminRouter } = require("./operationsAdmin");
const { communeItStaffAdminRouter } = require("./communeItStaffAdmin");
const { communeAgentsAdminRouter } = require("./communeAgentsAdmin");
const { wilayaAdminsAdminRouter } = require("./wilayaAdminsAdmin");
const { accessAdminRouter } = require("./accessAdmin");
const { userAccessAdminRouter } = require("./userAccessAdmin");
const userProfileService = require("../modules/access/userProfileService");
const { etatPrincipaleAdminRouter } = require("./etatPrincipaleAdmin");
const { createThreadWithRecipients } = require("../services/mailThreadCreate");
const mailSendRequestService = require("../modules/mail/mailSendRequestService");
const { createMailValidationRouter } = require("./mailValidation");
const municipalityAnnexService = require("../modules/annexes/municipalityAnnexService");

const adminRouter = express.Router();

adminRouter.use(requireAuth, attachUser, checkBlocked, requireRole("SUPER_ADMIN"));

adminRouter.use(operationsAdminRouter);
adminRouter.use(communeItStaffAdminRouter);
adminRouter.use(communeAgentsAdminRouter);
adminRouter.use(wilayaAdminsAdminRouter);
adminRouter.use(accessAdminRouter);
adminRouter.use(userAccessAdminRouter);
adminRouter.use(etatPrincipaleAdminRouter);

const uploadLogo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(storageRoot(), "logos")),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 16) || "";
      const name = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
      cb(null, name);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadBinaryWithOptionalLogo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === "logo") {
        cb(null, path.join(storageRoot(), "logos"));
      } else {
        cb(null, path.join(storageRoot(), "binaries"));
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 16) || "";
      const name = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
      cb(null, name);
    }
  }),
  limits: { fileSize: 500 * 1024 * 1024 }
});

const uploadMailAttachments = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(storageRoot(), "mail")),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 16) || "";
      const name = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
      cb(null, name);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});

adminRouter.use("/mail", createMailValidationRouter({ uploadMailAttachments }));

adminRouter.post("/apps", async (req, res, next) => {
  try {
    const { app_name, description } = req.body || {};
    if (!app_name) return res.status(400).json({ error: "app_name is required" });
    const { app } = await withTxAudit(
      req,
      req.user.id,
      "APP_CREATE",
      { entity: { type: "Application", id: null }, after: { app_name, description: description || null } },
      async (transaction) => {
        const app = await Application.create({ app_name, description: description || null }, { transaction });
        return { app };
      }
    );
    res.json({ app });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/apps", async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(Number(req.query.pageSize || 10), 50);
    const offset = (page - 1) * pageSize;

    const { rows, count } = await Application.findAndCountAll({
      include: [{ model: AppVersion, as: "currentVersion" }],
      order: [["id", "ASC"]],
      offset,
      limit: pageSize
    });
    res.json({ apps: rows, total: count, page, pageSize });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/apps/:appId", async (req, res, next) => {
  try {
    const app = await Application.findByPk(req.params.appId);
    if (!app) return res.status(404).json({ error: "App not found" });

    const versions = await AppVersion.findAll({
      where: { app_id: app.id },
      order: [["created_at", "DESC"]]
    });

    res.json({ app, versions });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/apps/:appId", async (req, res, next) => {
  try {
    const app = await Application.findByPk(req.params.appId);
    if (!app) return res.status(404).json({ error: "App not found" });

    const { app_name, description } = req.body || {};
    const before = app.toJSON();
    await withTxAudit(
      req,
      req.user.id,
      "APP_UPDATE",
      {
        entity: { type: "Application", id: app.id },
        before,
        after: { ...before, app_name: app_name || app.app_name, description: description ?? app.description }
      },
      async (transaction) => {
        await app.update(
          {
            app_name: app_name || app.app_name,
            description: description ?? app.description
          },
          { transaction }
        );
      }
    );

    res.json({ app });
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/apps/:appId", async (req, res, next) => {
  try {
    const app = await Application.findByPk(req.params.appId);
    if (!app) return res.status(404).json({ error: "App not found" });

    const before = app.toJSON();
    await withTxAudit(
      req,
      req.user.id,
      "APP_DELETE",
      { entity: { type: "Application", id: app.id }, before },
      async (transaction) => {
        await app.destroy({ transaction });
      }
    );
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/apps/:appId/logo", uploadLogo.single("logo"), async (req, res, next) => {
  try {
    const app = await Application.findByPk(req.params.appId);
    if (!app) return res.status(404).json({ error: "App not found" });
    if (!req.file) return res.status(400).json({ error: "Missing logo file (field name: logo)" });

    const mime = String(req.file.mimetype || "");
    const allowed =
      mime === "image/svg+xml" ||
      mime === "image/png" ||
      mime === "image/jpeg" ||
      mime === "image/webp" ||
      mime === "image/gif";
    if (!allowed) return res.status(400).json({ error: "Unsupported logo type" });

    const rel = `logos/${req.file.filename}`.replace(/\\/g, "/");
    const url = publicFileUrl(rel);
    const before = app.toJSON();
    await withTxAudit(
      req,
      req.user.id,
      "APP_LOGO_UPDATE",
      { entity: { type: "Application", id: app.id }, before, after: { ...before, logo_url: url } },
      async (transaction) => {
        await app.update({ logo_url: url }, { transaction });
      }
    );
    res.json({ app });
  } catch (e) {
    next(e);
  }
});

adminRouter.post(
  "/apps/:appId/versions",
  uploadBinaryWithOptionalLogo.fields([
    { name: "file", maxCount: 1 },
    { name: "logo", maxCount: 1 }
  ]),
  async (req, res, next) => {
  try {
    const app = await Application.findByPk(req.params.appId);
    if (!app) return res.status(404).json({ error: "App not found" });
    const binaryFile = req.files?.file?.[0];
    if (!binaryFile) return res.status(400).json({ error: "Missing binary file (field name: file)" });

    const { version_number, release_notes } = req.body || {};
    if (!version_number) return res.status(400).json({ error: "version_number is required" });

    const rel = `binaries/${binaryFile.filename}`.replace(/\\/g, "/");
    const url = publicFileUrl(rel);

    const logoFile = req.files?.logo?.[0];
    const { version, app: updatedApp } = await withTxAudit(
      req,
      req.user.id,
      "APP_VERSION_UPLOAD",
      {
        entity: { type: "AppVersion", id: null },
        app: { id: app.id },
        after: { app_id: app.id, version_number, file_url: url, release_notes: release_notes || null }
      },
      async (transaction) => {
        const version = await AppVersion.create(
          {
            app_id: app.id,
            version_number,
            file_url: url,
            release_notes: release_notes || null
          },
          { transaction }
        );

        const updatePayload = { current_version_id: version.id };

        if (logoFile) {
          const mime = String(logoFile.mimetype || "");
          const allowed =
            mime === "image/svg+xml" ||
            mime === "image/png" ||
            mime === "image/jpeg" ||
            mime === "image/webp" ||
            mime === "image/gif";
          if (!allowed) {
            const err = new Error("Unsupported logo type");
            err.status = 400;
            throw err;
          }

          const logoRel = `logos/${logoFile.filename}`.replace(/\\/g, "/");
          const logoUrl = publicFileUrl(logoRel);
          updatePayload.logo_url = logoUrl;
          await audit(req.user.id, "APP_LOGO_UPDATE", { app_id: app.id, logo_url: logoUrl, source: "VERSION_UPLOAD" }, { req, transaction });
        }

        await app.update(updatePayload, { transaction });
        return { version, app };
      }
    );

    res.json({ version, app: updatedApp });
  } catch (e) {
    next(e);
  }
}
);

adminRouter.patch("/versions/:versionId", async (req, res, next) => {
  try {
    const version = await AppVersion.findByPk(req.params.versionId);
    if (!version) return res.status(404).json({ error: "Version not found" });

    const { version_number, release_notes } = req.body || {};
    const before = version.toJSON();
    await withTxAudit(
      req,
      req.user.id,
      "APP_VERSION_UPDATE",
      {
        entity: { type: "AppVersion", id: version.id },
        app: { id: version.app_id },
        before,
        after: { ...before, version_number: version_number || version.version_number, release_notes: release_notes ?? version.release_notes }
      },
      async (transaction) => {
        await version.update(
          {
            version_number: version_number || version.version_number,
            release_notes: release_notes ?? version.release_notes
          },
          { transaction }
        );
      }
    );

    res.json({ version });
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/versions/:versionId", async (req, res, next) => {
  try {
    const version = await AppVersion.findByPk(req.params.versionId);
    if (!version) return res.status(404).json({ error: "Version not found" });

    const appId = version.app_id;
    const before = version.toJSON();

    await withTxAudit(
      req,
      req.user.id,
      "APP_VERSION_DELETE",
      { entity: { type: "AppVersion", id: version.id }, app: { id: appId }, before },
      async (transaction) => {
        const wasCurrent = await Application.findOne({
          where: { id: appId, current_version_id: version.id },
          transaction
        });

        await version.destroy({ transaction });

        if (wasCurrent) {
          const latest = await AppVersion.findOne({
            where: { app_id: appId },
            order: [["created_at", "DESC"]],
            transaction
          });
          await wasCurrent.update({ current_version_id: latest ? latest.id : null }, { transaction });
        }
      }
    );
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// Version details: list municipalities that downloaded this version (at least once)
adminRouter.get("/versions/:versionId/municipalities", async (req, res, next) => {
  try {
    const version = await AppVersion.findByPk(req.params.versionId, { include: [{ model: Application }] });
    if (!version) return res.status(404).json({ error: "Version not found" });

    const page = Math.max(Number(req.query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize || 20), 1), 100);
    const search = String(req.query.search || "").trim().toLowerCase();

    const downloads = await Download.findAll({
      where: { version_id: version.id },
      include: [
        {
          model: User,
          attributes: ["id", "municipality_id"],
          include: [{ model: Municipality, attributes: ["id", "code", "name_ar", "name_fr"] }]
        }
      ],
      order: [["timestamp", "DESC"]],
      limit: 5000
    });

    const byMuni = new Map();
    for (const d of downloads) {
      const muni = d.User?.Municipality;
      if (!muni) continue;
      const muniId = String(muni.id);
      const prev = byMuni.get(muniId);
      const ts = d.timestamp;
      if (!prev) {
        byMuni.set(muniId, {
          municipality: { id: muni.id, code: muni.code, name_ar: muni.name_ar, name_fr: muni.name_fr },
          last_download_at: ts,
          downloads_count: 1
        });
      } else {
        prev.downloads_count += 1;
        if (!prev.last_download_at || (ts && ts > prev.last_download_at)) prev.last_download_at = ts;
      }
    }

    let rows = Array.from(byMuni.values()).sort((a, b) => {
      const at = a.last_download_at ? new Date(a.last_download_at).getTime() : 0;
      const bt = b.last_download_at ? new Date(b.last_download_at).getTime() : 0;
      return bt - at;
    });

    if (search) {
      rows = rows.filter((r) => {
        const m = r.municipality;
        return (
          String(m.code || "").toLowerCase().includes(search) ||
          String(m.name_ar || "").toLowerCase().includes(search) ||
          String(m.name_fr || "").toLowerCase().includes(search)
        );
      });
    }

    const total = rows.length;
    const offset = (page - 1) * pageSize;
    const pageRows = rows.slice(offset, offset + pageSize);

    res.json({
      version: {
        id: version.id,
        version_number: version.version_number,
        release_notes: version.release_notes || null,
        app: version.Application ? { id: version.Application.id, app_name: version.Application.app_name } : null
      },
      municipalities: pageRows,
      total,
      page,
      pageSize
    });
  } catch (e) {
    next(e);
  }
});

// Version progress: list ALL municipalities with download status for this version
// Query:
// - status: ALL | DOWNLOADED | NOT_DOWNLOADED (default ALL)
// - page, pageSize, search (code/name)
adminRouter.get("/versions/:versionId/progress", async (req, res, next) => {
  try {
    const version = await AppVersion.findByPk(req.params.versionId, { include: [{ model: Application }] });
    if (!version) return res.status(404).json({ error: "Version not found" });

    const status = String(req.query.status || "ALL").toUpperCase();
    const page = Math.max(Number(req.query.page || 1), 1);
    // UI can request "all" municipalities (typically <= 100)
    const pageSize = Math.min(Math.max(Number(req.query.pageSize || 50), 1), 10000);
    const search = String(req.query.search || "").trim().toLowerCase();

    const downloads = await Download.findAll({
      where: { version_id: version.id },
      include: [
        {
          model: User,
          attributes: ["id", "municipality_id"],
          include: [{ model: Municipality, attributes: ["id", "code", "name_ar", "name_fr"] }]
        }
      ],
      order: [["timestamp", "DESC"]],
      limit: 20000
    });

    const byMuni = new Map();
    for (const d of downloads) {
      const muni = d.User?.Municipality;
      if (!muni) continue;
      const muniId = String(muni.id);
      const prev = byMuni.get(muniId);
      const ts = d.timestamp;
      if (!prev) {
        byMuni.set(muniId, {
          municipality: { id: muni.id, code: muni.code, name_ar: muni.name_ar, name_fr: muni.name_fr },
          has_downloaded: true,
          last_download_at: ts,
          downloads_count: 1
        });
      } else {
        prev.downloads_count += 1;
        if (!prev.last_download_at || (ts && ts > prev.last_download_at)) prev.last_download_at = ts;
      }
    }

    const allMunicipalities = await Municipality.findAll({ order: [["code", "ASC"], ["id", "ASC"]] });
    const totalMunicipalities = allMunicipalities.length;
    const downloadedMunicipalities = byMuni.size;
    const notDownloadedMunicipalities = Math.max(0, totalMunicipalities - downloadedMunicipalities);

    let rows = allMunicipalities.map((m) => {
      const fromDownloads = byMuni.get(String(m.id));
      return (
        fromDownloads || {
          municipality: { id: m.id, code: m.code, name_ar: m.name_ar, name_fr: m.name_fr },
          has_downloaded: false,
          last_download_at: null,
          downloads_count: 0
        }
      );
    });

    if (search) {
      rows = rows.filter((r) => {
        const m = r.municipality || {};
        return (
          String(m.code || "").toLowerCase().includes(search) ||
          String(m.name_ar || "").toLowerCase().includes(search) ||
          String(m.name_fr || "").toLowerCase().includes(search)
        );
      });
    }

    if (status === "DOWNLOADED") rows = rows.filter((r) => r.has_downloaded);
    else if (status === "NOT_DOWNLOADED") rows = rows.filter((r) => !r.has_downloaded);

    // Sort: downloaded first by last_download_at desc, then not downloaded by code
    rows.sort((a, b) => {
      if (a.has_downloaded !== b.has_downloaded) return a.has_downloaded ? -1 : 1;
      if (a.has_downloaded && b.has_downloaded) {
        const at = a.last_download_at ? new Date(a.last_download_at).getTime() : 0;
        const bt = b.last_download_at ? new Date(b.last_download_at).getTime() : 0;
        return bt - at;
      }
      const ac = String(a.municipality?.code || "");
      const bc = String(b.municipality?.code || "");
      return ac.localeCompare(bc);
    });

    const totalFiltered = rows.length;
    const offset = (page - 1) * pageSize;
    const pageRows = rows.slice(offset, offset + pageSize);

    res.json({
      version: {
        id: version.id,
        version_number: version.version_number,
        release_notes: version.release_notes || null,
        app: version.Application ? { id: version.Application.id, app_name: version.Application.app_name } : null
      },
      summary: {
        total_municipalities: totalMunicipalities,
        downloaded_municipalities: downloadedMunicipalities,
        not_downloaded_municipalities: notDownloadedMunicipalities
      },
      status,
      municipalities: pageRows,
      total: totalFiltered,
      page,
      pageSize
    });
  } catch (e) {
    next(e);
  }
});

// Generate PDF report for progress of this version
adminRouter.post("/versions/:versionId/progress/pdf", async (req, res, next) => {
  try {
    const version = await AppVersion.findByPk(req.params.versionId, { include: [{ model: Application }] });
    if (!version) return res.status(404).json({ error: "Version not found" });

    // Force PDF language to French (independent from UI language)
    const lang = "fr";

    const downloads = await Download.findAll({
      where: { version_id: version.id },
      include: [
        {
          model: User,
          attributes: ["id", "municipality_id"],
          include: [{ model: Municipality, attributes: ["id", "code", "name_ar", "name_fr"] }]
        }
      ],
      order: [["timestamp", "DESC"]],
      limit: 20000
    });

    const byMuni = new Map();
    for (const d of downloads) {
      const muni = d.User?.Municipality;
      if (!muni) continue;
      const muniId = String(muni.id);
      const prev = byMuni.get(muniId);
      const ts = d.timestamp;
      if (!prev) {
        byMuni.set(muniId, {
          municipality: { id: muni.id, code: muni.code, name_ar: muni.name_ar, name_fr: muni.name_fr },
          has_downloaded: true,
          last_download_at: ts,
          downloads_count: 1
        });
      } else {
        prev.downloads_count += 1;
        if (!prev.last_download_at || (ts && ts > prev.last_download_at)) prev.last_download_at = ts;
      }
    }

    const allMunicipalities = await Municipality.findAll({ order: [["code", "ASC"], ["id", "ASC"]] });
    const totalMunicipalities = allMunicipalities.length;
    const downloadedMunicipalities = byMuni.size;
    const notDownloadedMunicipalities = Math.max(0, totalMunicipalities - downloadedMunicipalities);

    const rows = allMunicipalities.map((m) => {
      const fromDownloads = byMuni.get(String(m.id));
      return (
        fromDownloads || {
          municipality: { id: m.id, code: m.code, name_ar: m.name_ar, name_fr: m.name_fr },
          has_downloaded: false,
          last_download_at: null,
          downloads_count: 0
        }
      );
    });

    const pdf = await generateVersionProgressPdf({
      appName: version.Application?.app_name || "App",
      versionNumber: version.version_number,
      generatedBy: req.user?.username || null,
      lang,
      summary: {
        total_municipalities: totalMunicipalities,
        downloaded_municipalities: downloadedMunicipalities,
        not_downloaded_municipalities: notDownloadedMunicipalities
      },
      rows
    });

    await audit(req.user.id, "VERSION_PROGRESS_PDF", { version_id: version.id, pdf_url: pdf.file_url }, { req });

    res.json({ pdf_url: pdf.file_url });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/municipalities", async (req, res, next) => {
  try {
    const { name_ar, name_fr, code } = req.body || {};
    if (!name_ar || !name_fr || !code) return res.status(400).json({ error: "name_ar, name_fr, code are required" });
    const { muni } = await withTxAudit(
      req,
      req.user.id,
      "MUNICIPALITY_CREATE",
      { entity: { type: "Municipality", id: null }, after: { name_ar, name_fr, code } },
      async (transaction) => {
        const muni = await Municipality.create({ name_ar, name_fr, code }, { transaction });
        await BackupServerStatus.create(
          {
            municipality_id: muni.id,
            display_order: 0,
            existe: false,
            configured: false,
            os_active: false
          },
          { transaction }
        );
        return { muni };
      }
    );
    res.json({ municipality: muni });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/municipalities", async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(Number(req.query.pageSize || 10), 50);
    const offset = (page - 1) * pageSize;

    const { rows, count } = await Municipality.findAndCountAll({
      order: [["id", "ASC"]],
      offset,
      limit: pageSize
    });

    res.json({ municipalities: rows, total: count, page, pageSize });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/municipalities/:municipalityId", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });
    res.json({ municipality: muni });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/municipalities/:municipalityId", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });

    const { name_ar, name_fr, code } = req.body || {};
    const before = muni.toJSON();
    await withTxAudit(
      req,
      req.user.id,
      "MUNICIPALITY_UPDATE",
      {
        entity: { type: "Municipality", id: muni.id },
        before,
        after: { ...before, name_ar: name_ar || muni.name_ar, name_fr: name_fr || muni.name_fr, code: code || muni.code }
      },
      async (transaction) => {
        await muni.update(
          {
            name_ar: name_ar || muni.name_ar,
            name_fr: name_fr || muni.name_fr,
            code: code || muni.code
          },
          { transaction }
        );
      }
    );
    res.json({ municipality: muni });
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/municipalities/:municipalityId", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });

    const before = muni.toJSON();
    await withTxAudit(
      req,
      req.user.id,
      "MUNICIPALITY_DELETE",
      { entity: { type: "Municipality", id: muni.id }, before },
      async (transaction) => {
        await muni.destroy({ transaction });
      }
    );
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/municipalities/:municipalityId/overview", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });

    const apps = await Application.findAll({ include: [{ model: AppVersion, as: "currentVersion" }], order: [["id", "ASC"]] });
    const users = await User.findAll({ where: { municipality_id: muni.id }, attributes: ["id"] });
    const userIds = users.map((u) => u.id);

    const perApp = [];
    for (const app of apps) {
      const latestId = app.current_version_id;
      if (!latestId) {
        perApp.push({ app_id: app.id, app_name: app.app_name, status: "NO_VERSIONS", last: null, latest_version_id: null });
        continue;
      }
      if (userIds.length === 0) {
        perApp.push({ app_id: app.id, app_name: app.app_name, status: "NEVER_DOWNLOADED", last: null, latest_version_id: latestId });
        continue;
      }

      const lastDownload = await Download.findOne({
        include: [{ model: AppVersion, where: { app_id: app.id }, attributes: ["id", "version_number"] }],
        where: { user_id: { [Op.in]: userIds } },
        order: [["timestamp", "DESC"]]
      });

      if (!lastDownload) {
        perApp.push({ app_id: app.id, app_name: app.app_name, status: "NEVER_DOWNLOADED", last: null, latest_version_id: latestId });
      } else if (String(lastDownload.version_id) === String(latestId)) {
        perApp.push({
          app_id: app.id,
          app_name: app.app_name,
          status: "UP_TO_DATE",
          latest_version_id: latestId,
          last: { version_id: lastDownload.version_id, version_number: lastDownload.AppVersion?.version_number, timestamp: lastDownload.timestamp }
        });
      } else {
        perApp.push({
          app_id: app.id,
          app_name: app.app_name,
          status: "OUTDATED",
          latest_version_id: latestId,
          last: { version_id: lastDownload.version_id, version_number: lastDownload.AppVersion?.version_number, timestamp: lastDownload.timestamp }
        });
      }
    }

    res.json({
      municipality: { id: muni.id, code: muni.code, name_ar: muni.name_ar, name_fr: muni.name_fr },
      apps: perApp
    });
  } catch (e) {
    next(e);
  }
});

// Municipality details: per-app status + downgrade detection from download history
adminRouter.get("/municipalities/:municipalityId/apps", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });

    const apps = await Application.findAll({
      include: [{ model: AppVersion, as: "currentVersion" }],
      order: [["id", "ASC"]]
    });

    const users = await User.findAll({ where: { municipality_id: muni.id }, attributes: ["id"] });
    const userIds = users.map((u) => u.id);

    // Pull recent download history for downgrade detection (per app)
    const downloads = userIds.length
      ? await Download.findAll({
          where: { user_id: { [Op.in]: userIds } },
          include: [{ model: AppVersion, attributes: ["id", "app_id", "version_number", "created_at"] }],
          order: [["timestamp", "ASC"]],
          limit: 5000
        })
      : [];

    const downloadsByApp = new Map();
    for (const d of downloads) {
      const v = d.AppVersion;
      if (!v) continue;
      const k = String(v.app_id);
      if (!downloadsByApp.has(k)) downloadsByApp.set(k, []);
      downloadsByApp.get(k).push(d);
    }

    const perApp = [];
    for (const app of apps) {
      const latestId = app.current_version_id;
      if (!latestId) {
        perApp.push({ app_id: app.id, app_name: app.app_name, status: "NO_VERSIONS", latest_version_id: null, last: null, downgrade: false });
        continue;
      }

      const appDownloads = downloadsByApp.get(String(app.id)) || [];
      const lastDownload = appDownloads.length ? appDownloads[appDownloads.length - 1] : null;

      let downgrade = false;
      let maxCreatedAt = null;
      for (const d of appDownloads) {
        const createdAt = d.AppVersion?.created_at ? new Date(d.AppVersion.created_at).getTime() : null;
        if (createdAt == null) continue;
        if (maxCreatedAt == null) maxCreatedAt = createdAt;
        else if (createdAt > maxCreatedAt) maxCreatedAt = createdAt;
        else if (createdAt < maxCreatedAt) downgrade = true;
      }

      if (!lastDownload) {
        perApp.push({ app_id: app.id, app_name: app.app_name, status: "NEVER_DOWNLOADED", latest_version_id: latestId, last: null, downgrade: false });
      } else if (String(lastDownload.version_id) === String(latestId)) {
        perApp.push({
          app_id: app.id,
          app_name: app.app_name,
          status: "UP_TO_DATE",
          latest_version_id: latestId,
          downgrade,
          last: { version_id: lastDownload.version_id, version_number: lastDownload.AppVersion?.version_number, timestamp: lastDownload.timestamp }
        });
      } else {
        perApp.push({
          app_id: app.id,
          app_name: app.app_name,
          status: "OUTDATED",
          latest_version_id: latestId,
          downgrade,
          last: { version_id: lastDownload.version_id, version_number: lastDownload.AppVersion?.version_number, timestamp: lastDownload.timestamp }
        });
      }
    }

    res.json({
      municipality: { id: muni.id, code: muni.code, name_ar: muni.name_ar, name_fr: muni.name_fr },
      apps: perApp
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/municipalities/:municipalityId/annexes", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });
    const annexes = await municipalityAnnexService.listByMunicipalityId(muni.id);
    res.json({
      annexes,
      statuses: municipalityAnnexService.ANNEX_STATUSES,
      ville_positions: municipalityAnnexService.ANNEX_VILLE_POSITIONS
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/municipalities/:municipalityId/annexes", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });
    const out = await municipalityAnnexService.createForMunicipality(muni.id, req.body || {});
    if (out.error) return res.status(out.status).json({ error: out.error });
    await audit(req.user.id, "MUNICIPALITY_ANNEX_CREATE", { municipality_id: muni.id, annex_id: out.annex.id }, { req });
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/municipalities/:municipalityId/annexes/:annexId", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });
    const out = await municipalityAnnexService.updateAdmin(muni.id, req.params.annexId, req.body || {});
    if (out.error) return res.status(out.status).json({ error: out.error });
    await audit(req.user.id, "MUNICIPALITY_ANNEX_UPDATE", { municipality_id: muni.id, annex_id: out.annex.id }, { req });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/municipalities/:municipalityId/annexes/:annexId", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });
    const out = await municipalityAnnexService.deleteAdmin(muni.id, req.params.annexId);
    if (out.error) return res.status(out.status).json({ error: out.error });
    await audit(req.user.id, "MUNICIPALITY_ANNEX_DELETE", { municipality_id: muni.id, annex_id: Number(req.params.annexId) }, { req });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/municipalities/:municipalityId/users", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });

    const username = (req.body?.username || "").trim();
    const requestedName = (req.body?.name || "").trim() || null;

    if (!username) return res.status(400).json({ error: "username is required" });

    const USERNAME_RE = /^[A-Za-z0-9_]+$/;
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({
        error: "Invalid username format. Use letters, numbers, and underscore (_) only (no spaces).",
      });
    }

    const code8 = generate8DigitCode();
    const password_hash = await bcrypt.hash(code8, 12);

    const existing = await User.findOne({ where: { username } });
    if (existing) return res.status(409).json({ error: "Username already exists" });

    const pdf = await generateCredentialsPdf({
      username,
      code8,
      municipalityNameAr: muni.name_ar,
      municipalityNameFr: muni.name_fr,
      municipalityCode: muni.code
    });

    const { user } = await withTxAudit(
      req,
      req.user.id,
      "MUNI_USER_CREATE",
      {
        entity: { type: "User", id: null },
        municipality: { id: muni.id, code: muni.code },
        after: { username, name: requestedName, role: "MUNI_ADMIN", municipality_id: muni.id, is_blocked: false },
        pdf_url: pdf.file_url
      },
      async (transaction) => {
        const profileOut = await userProfileService.parseUserProfileCreateFields(req.body, "MUNI_ADMIN");
        if (profileOut.error) {
          const err = new Error(profileOut.error);
          err.status = profileOut.status;
          throw err;
        }
        const user = await User.create(
          {
            username,
            name: requestedName,
            password_hash,
            role: "MUNI_ADMIN",
            municipality_id: muni.id,
            is_blocked: false,
            ...profileOut.fields
          },
          { transaction }
        );
        return { user };
      }
    );

    res.json({
      user: { id: user.id, username: user.username, name: user.name, role: user.role, municipality_id: user.municipality_id },
      credentials: { code8, pdf_url: pdf.file_url }
    });
  } catch (e) {
    next(e);
  }
});

// Wilaya admins (SUPER_ADMIN) management — GET list: wilayaAdminsAdminRouter
adminRouter.post("/wilaya-admins", async (req, res, next) => {
  try {
    if (!req.user?.can_create_wilaya_admins) return res.status(403).json({ error: "Forbidden" });

    const username = (req.body?.username || "").trim();
    const requestedName = (req.body?.name || "").trim() || null;
    if (!username) return res.status(400).json({ error: "username is required" });

    const USERNAME_RE = /^[A-Za-z0-9_]+$/;
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({
        error: "Invalid username format. Use letters, numbers, and underscore (_) only (no spaces)."
      });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) return res.status(409).json({ error: "Username already exists" });

    const code8 = generate8DigitCode();
    const password_hash = await bcrypt.hash(code8, 12);

    const pdf = await generateCredentialsPdf({
      username,
      code8,
      municipalityNameAr: null,
      municipalityNameFr: null,
      municipalityCode: null
    });

    const { user } = await withTxAudit(
      req,
      req.user.id,
      "WILAYA_ADMIN_CREATE",
      {
        entity: { type: "User", id: null },
        after: { username, name: requestedName, role: "SUPER_ADMIN", municipality_id: null, is_blocked: false },
        pdf_url: pdf.file_url
      },
      async (transaction) => {
        const profileOut = await userProfileService.parseUserProfileCreateFields(req.body, "SUPER_ADMIN");
        if (profileOut.error) {
          const err = new Error(profileOut.error);
          err.status = profileOut.status;
          throw err;
        }
        const user = await User.create(
          {
            username,
            name: requestedName,
            password_hash,
            role: "SUPER_ADMIN",
            municipality_id: null,
            is_blocked: false,
            can_manage_access_roles: false,
            can_create_wilaya_admins: false,
            ...profileOut.fields
          },
          { transaction }
        );
        return { user };
      }
    );

    res.json({
      user: { id: user.id, name: user.name, role: user.role },
      credentials: { code8, pdf_url: pdf.file_url }
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/users/:userId/reset", async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.userId, { include: [{ model: Municipality }] });
    if (!user) return res.status(404).json({ error: "User not found" });

    const code8 = generate8DigitCode();
    const password_hash = await bcrypt.hash(code8, 12);

    const muni = user.Municipality;
    const pdf = await generateCredentialsPdf({
      username: user.username,
      code8,
      municipalityNameAr: muni?.name_ar,
      municipalityNameFr: muni?.name_fr,
      municipalityCode: muni?.code
    });

    const before = {
      id: user.id,
      username: user.username,
      name: user.name,
      municipality_id: user.municipality_id,
      is_blocked: user.is_blocked,
      role: user.role
    };
    await withTxAudit(
      req,
      req.user.id,
      "PASSWORD_RESET",
      { entity: { type: "User", id: user.id }, before, after: { ...before }, pdf_url: pdf.file_url },
      async (transaction) => {
        await user.update({ password_hash }, { transaction });
      }
    );

    res.json({ user: { id: user.id, username: user.username, name: user.name }, credentials: { code8, pdf_url: pdf.file_url } });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/users/:userId/block", async (req, res, next) => {
  try {
    if (Number(req.params.userId) === Number(req.user.id)) {
      return res.status(400).json({ error: "Cannot block your own account" });
    }
    const user = await User.findByPk(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const before = user.toJSON();
    await withTxAudit(
      req,
      req.user.id,
      "USER_BLOCK",
      { entity: { type: "User", id: user.id }, before, after: { ...before, is_blocked: true } },
      async (transaction) => {
        await user.update({ is_blocked: true }, { transaction });
      }
    );
    res.json({ user: { id: user.id, is_blocked: user.is_blocked } });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/users/:userId/unblock", async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const before = user.toJSON();
    await withTxAudit(
      req,
      req.user.id,
      "USER_UNBLOCK",
      { entity: { type: "User", id: user.id }, before, after: { ...before, is_blocked: false } },
      async (transaction) => {
        await user.update({ is_blocked: false }, { transaction });
      }
    );
    res.json({ user: { id: user.id, is_blocked: user.is_blocked } });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/dashboard/progress", async (req, res, next) => {
  try {
    const apps = await Application.findAll({ include: [{ model: AppVersion, as: "currentVersion" }] });
    const municipalities = await Municipality.findAll();

    // For each municipality, compute status based on any download by any user in that municipality vs app.current_version_id
    const muniUsers = await User.findAll({
      where: { municipality_id: { [Op.ne]: null } },
      attributes: ["id", "municipality_id"]
    });
    const usersByMuni = new Map();
    for (const u of muniUsers) {
      const k = String(u.municipality_id);
      if (!usersByMuni.has(k)) usersByMuni.set(k, []);
      usersByMuni.get(k).push(u.id);
    }

    const result = [];
    for (const muni of municipalities) {
      const userIds = usersByMuni.get(String(muni.id)) || [];

      const perApp = [];
      for (const app of apps) {
        const latestId = app.current_version_id;
        if (!latestId) {
          perApp.push({ app_id: app.id, status: "NO_VERSIONS" });
          continue;
        }
        if (userIds.length === 0) {
          perApp.push({ app_id: app.id, status: "NEVER_DOWNLOADED" });
          continue;
        }

        const latestDownload = await Download.findOne({
          include: [{ model: AppVersion, where: { app_id: app.id }, attributes: ["id", "app_id"] }],
          where: { user_id: { [Op.in]: userIds } },
          order: [["timestamp", "DESC"]]
        });

        if (!latestDownload) {
          perApp.push({ app_id: app.id, status: "NEVER_DOWNLOADED" });
        } else if (String(latestDownload.version_id) === String(latestId)) {
          perApp.push({ app_id: app.id, status: "UP_TO_DATE" });
        } else {
          perApp.push({ app_id: app.id, status: "OUTDATED" });
        }
      }

      result.push({
        municipality: { id: muni.id, code: muni.code, name_ar: muni.name_ar, name_fr: muni.name_fr },
        apps: perApp
      });
    }

    res.json({ municipalities: result });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/municipalities/:municipalityId/history", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });

    const users = await User.findAll({ where: { municipality_id: muni.id }, attributes: ["id", "username", "name", "is_blocked", "role", "municipality_id"] });
    const userIds = users.map((u) => u.id);

    const downloads = userIds.length
      ? await Download.findAll({
          where: { user_id: { [Op.in]: userIds } },
          include: [{ model: AppVersion, include: [{ model: Application }] }, { model: User, attributes: ["id", "username", "name"] }],
          order: [["timestamp", "DESC"]],
          limit: 200
        })
      : [];

    res.json({
      municipality: { id: muni.id, code: muni.code, name_ar: muni.name_ar, name_fr: muni.name_fr },
      users,
      downloads: downloads.map((d) => ({
        id: d.id,
        timestamp: d.timestamp,
        ip_address: d.ip_address,
        user: d.User ? { id: d.User.id, username: d.User.username } : null,
        app: d.AppVersion?.Application ? { id: d.AppVersion.Application.id, app_name: d.AppVersion.Application.app_name } : null,
        version: d.AppVersion ? { id: d.AppVersion.id, version_number: d.AppVersion.version_number } : null
      }))
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/municipalities/:municipalityId/users", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });

    const page = Number(req.query.page || 1);
    const pageSize = Math.min(Number(req.query.pageSize || 10), 50);
    const offset = (page - 1) * pageSize;

    const { rows, count } = await User.findAndCountAll({
      where: { municipality_id: muni.id },
      order: [["id", "ASC"]],
      offset,
      limit: pageSize
    });

    res.json({ municipality: muni, users: rows, total: count, page, pageSize });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/users/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ users: [] });
    const users = await User.findAll({
      where: {
        [Op.or]: [{ username: { [Op.iLike]: `%${q}%` } }, { name: { [Op.iLike]: `%${q}%` } }]
      },
      include: [{ model: Municipality, attributes: ["id", "code", "name_ar", "name_fr"] }],
      order: [["username", "ASC"]],
      limit: 20
    });
    res.json({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        municipality_id: u.municipality_id,
        municipality: u.Municipality
          ? { id: u.Municipality.id, code: u.Municipality.code, name_ar: u.Municipality.name_ar, name_fr: u.Municipality.name_fr }
          : null
      }))
    });
  } catch (e) {
    next(e);
  }
});

async function touchSeenAndRead(req, threadId, transaction) {
  const rec = await MailRecipient.findOne({ where: { thread_id: threadId, user_id: req.user.id }, transaction });
  if (!rec) return null;

  const now = new Date();
  const updates = { last_seen_at: now, last_read_at: now };
  if (!rec.first_seen_at) updates.first_seen_at = now;

  await rec.update(updates, { transaction });

  if (!rec.first_seen_at) {
    await audit(req.user.id, "MAIL_THREAD_SEEN", { thread_id: Number(threadId), first_seen_at: now, last_seen_at: now }, { req, transaction });
  } else {
    await audit(req.user.id, "MAIL_THREAD_SEEN", { thread_id: Number(threadId), last_seen_at: now }, { req, transaction });
  }
  await audit(req.user.id, "MAIL_THREAD_READ", { thread_id: Number(threadId), last_read_at: now }, { req, transaction });
  return rec;
}

adminRouter.get("/mail/threads", async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(Number(req.query.pageSize || 20), 50);
    const offset = (page - 1) * pageSize;
    const q = String(req.query.q || "").trim();
    const unreadOnly = String(req.query.unread || "0") === "1";

    const whereThread = q ? { subject: { [Op.iLike]: `%${q}%` } } : {};

    const whereRecipient = { user_id: req.user.id };
    if (unreadOnly) {
      whereRecipient[Op.and] = [
        sequelize.literal(
          `("mail_recipients"."last_read_at" IS NULL OR "mail_recipients"."last_read_at" < "thread"."last_message_at")`
        )
      ];
    }

    const { rows, count } = await MailRecipient.findAndCountAll({
      where: whereRecipient,
      include: [
        {
          model: MailThread,
          as: "thread",
          where: whereThread,
          required: true,
          include: [
            { model: Municipality, as: "createdByMunicipality", attributes: ["id", "code", "name_ar", "name_fr"] },
            { model: User, as: "createdByUser", attributes: ["id", "username", "name", "role", "municipality_id"] }
          ]
        },
        { model: Municipality, as: "recipientMunicipality", attributes: ["id", "code", "name_ar", "name_fr"] }
      ],
      order: [[{ model: MailThread, as: "thread" }, "last_message_at", "DESC"]],
      offset,
      limit: pageSize
    });

    const threads = rows.map((r) => {
      const t = r.thread;
      const unread = !r.last_read_at || new Date(r.last_read_at).getTime() < new Date(t.last_message_at).getTime();
      return {
        id: t.id,
        subject: t.subject,
        last_message_at: t.last_message_at,
        created_at: t.created_at,
        recipient_kind: r.recipient_kind,
        recipient_municipality: r.recipientMunicipality
          ? {
              id: r.recipientMunicipality.id,
              code: r.recipientMunicipality.code,
              name_ar: r.recipientMunicipality.name_ar,
              name_fr: r.recipientMunicipality.name_fr
            }
          : null,
        created_by: t.createdByUser
          ? { id: t.createdByUser.id, username: t.createdByUser.username, name: t.createdByUser.name, role: t.createdByUser.role }
          : null,
        created_by_municipality: t.createdByMunicipality
          ? { id: t.createdByMunicipality.id, code: t.createdByMunicipality.code, name_ar: t.createdByMunicipality.name_ar, name_fr: t.createdByMunicipality.name_fr }
          : null,
        validation_outcome: t.validation_outcome || null,
        unread
      };
    });

    res.json({ threads, total: count, page, pageSize });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/mail/unread-count", async (req, res, next) => {
  try {
    const out = await sequelize.query(
      `
      SELECT COUNT(*)::bigint AS c
      FROM mail_recipients r
      JOIN mail_threads t ON t.id = r.thread_id
      WHERE r.user_id = :uid
        AND (r.last_read_at IS NULL OR r.last_read_at < t.last_message_at)
      `,
      { replacements: { uid: req.user.id }, type: require("sequelize").QueryTypes.SELECT }
    );
    const c = out?.[0]?.c ?? 0;
    res.json({ unread: Number(c) });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/mail/threads/:threadId", async (req, res, next) => {
  try {
    const threadId = Number(req.params.threadId);
    if (!threadId) return res.status(400).json({ error: "Invalid threadId" });

    const rec = await MailRecipient.findOne({ where: { thread_id: threadId, user_id: req.user.id } });
    if (!rec) return res.status(403).json({ error: "Forbidden" });

    const thread = await MailThread.findByPk(threadId, {
      include: [
        { model: Municipality, as: "createdByMunicipality", attributes: ["id", "code", "name_ar", "name_fr"] },
        { model: User, as: "createdByUser", attributes: ["id", "username", "name", "role", "municipality_id"] },
        { model: MailThread, as: "parentThread", attributes: ["id", "subject"] },
        {
          model: MailMessage,
          as: "parentMessage",
          attributes: ["id", "created_at", "body_html"],
          include: [
            { model: User, as: "authorUser", attributes: ["id", "username", "name", "role", "municipality_id"] },
            { model: Municipality, as: "authorMunicipality", attributes: ["id", "code", "name_ar", "name_fr"] }
          ]
        }
      ]
    });
    if (!thread) return res.status(404).json({ error: "Thread not found" });

    const messages = await MailMessage.findAll({
      where: { thread_id: threadId },
      include: [
        { model: User, as: "authorUser", attributes: ["id", "username", "name", "role", "municipality_id"] },
        { model: Municipality, as: "authorMunicipality", attributes: ["id", "code", "name_ar", "name_fr"] },
        {
          model: MailMessage,
          as: "replyToMessage",
          attributes: ["id", "created_at", "body_html"],
          include: [
            { model: User, as: "authorUser", attributes: ["id", "username", "name", "role", "municipality_id"] },
            { model: Municipality, as: "authorMunicipality", attributes: ["id", "code", "name_ar", "name_fr"] }
          ]
        },
        { model: MailAttachment, as: "attachments" }
      ],
      order: [["created_at", "ASC"], ["id", "ASC"]]
    });

    await sequelize.transaction(async (transaction) => {
      await touchSeenAndRead(req, threadId, transaction);
    });

    res.json({
      thread,
      messages,
      my_recipient: {
        recipient_kind: rec.recipient_kind,
        recipient_municipality_id: rec.recipient_municipality_id
      }
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/mail/threads/:threadId/recipients", async (req, res, next) => {
  try {
    const threadId = Number(req.params.threadId);
    if (!threadId) return res.status(400).json({ error: "Invalid threadId" });

    const rec = await MailRecipient.findOne({ where: { thread_id: threadId, user_id: req.user.id } });
    if (!rec) return res.status(403).json({ error: "Forbidden" });

    const recipients = await MailRecipient.findAll({
      where: { thread_id: threadId },
      include: [
        { model: User, as: "user", attributes: ["id", "username", "name", "role", "municipality_id"] },
        { model: Municipality, as: "recipientMunicipality", attributes: ["id", "code", "name_ar", "name_fr"] }
      ],
      order: [["id", "ASC"]]
    });

    res.json({
      recipients: recipients.map((r) => ({
        id: r.id,
        recipient_kind: r.recipient_kind,
        last_read_at: r.last_read_at,
        first_seen_at: r.first_seen_at,
        last_seen_at: r.last_seen_at,
        user: r.user
          ? { id: r.user.id, username: r.user.username, name: r.user.name, role: r.user.role, municipality_id: r.user.municipality_id }
          : null,
        recipient_municipality: r.recipientMunicipality
          ? {
              id: r.recipientMunicipality.id,
              code: r.recipientMunicipality.code,
              name_ar: r.recipientMunicipality.name_ar,
              name_fr: r.recipientMunicipality.name_fr
            }
          : null
      }))
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/mail/threads", uploadMailAttachments.array("attachments", 10), async (req, res, next) => {
  try {
    const subject = String(req.body?.subject || "").trim();
    const body_html = String(req.body?.body_html || "").trim();
    const targetRaw = req.body?.target;
    if (!subject) return res.status(400).json({ error: "subject is required" });
    if (!body_html) return res.status(400).json({ error: "body_html is required" });

    let target;
    try {
      target = typeof targetRaw === "string" ? JSON.parse(targetRaw) : targetRaw;
    } catch {
      return res.status(400).json({ error: "target must be valid JSON" });
    }
    if (!target?.type) return res.status(400).json({ error: "target.type is required" });

    const sendMode = String(req.body?.send_mode || "DIRECT").toUpperCase();
    if (sendMode === "VALIDATION") {
      let validatorIds = req.body?.validator_user_ids;
      if (typeof validatorIds === "string") {
        try {
          validatorIds = JSON.parse(validatorIds);
        } catch {
          return res.status(400).json({ error: "validator_user_ids must be valid JSON" });
        }
      }
      const row = await mailSendRequestService.createSendRequest(req, {
        subject,
        body_html,
        target,
        validatorUserIds: Array.isArray(validatorIds) ? validatorIds : [],
        attachments: req.files || [],
      });
      return res.status(201).json({ send_request_id: row.id });
    }

    const createdThreadIds = [];

    // Always include all SUPER_ADMINs in threads that involve communes (so any wilaya admin can follow)
    const superAdmins = await User.findAll({ where: { role: "SUPER_ADMIN" }, attributes: ["id"] });
    const superAdminIds = superAdmins.map((u) => Number(u.id));

    const attachments = req.files || [];

    if (target.type === "ALL_COMMUNES") {
      const muniUsers = await User.findAll({ where: { role: "MUNI_ADMIN" }, attributes: ["id", "municipality_id"] });
      const recipients = [
        ...superAdminIds.map((id) => ({ user_id: id, recipient_kind: "DIRECT_USER", recipient_municipality_id: null })),
        ...muniUsers.map((u) => ({
          user_id: Number(u.id),
          recipient_kind: "ALL_MUNICIPALITIES",
          recipient_municipality_id: u.municipality_id || null
        }))
      ];
      const { thread } = await createThreadWithRecipients({
        req,
        subject,
        body_html,
        recipients,
        attachments
      });
      createdThreadIds.push(thread.id);
    } else if (target.type === "COMMUNES") {
      const ids = Array.isArray(target.municipality_ids) ? target.municipality_ids.map((x) => Number(x)).filter(Boolean) : [];
      if (!ids.length) return res.status(400).json({ error: "target.municipality_ids is required" });

      const muniUsers = await User.findAll({ where: { municipality_id: { [Op.in]: ids } }, attributes: ["id", "municipality_id"] });
      const recipients = [
        ...superAdminIds.map((id) => ({ user_id: id, recipient_kind: "DIRECT_USER", recipient_municipality_id: null })),
        ...muniUsers.map((u) => ({
          user_id: Number(u.id),
          recipient_kind: "MUNICIPALITY_TARGET",
          recipient_municipality_id: u.municipality_id || null
        }))
      ];
      const { thread } = await createThreadWithRecipients({
        req,
        subject,
        body_html,
        recipients,
        attachments
      });
      createdThreadIds.push(thread.id);
    } else if (target.type === "USERS") {
      const ids = Array.isArray(target.user_ids) ? target.user_ids.map((x) => Number(x)).filter(Boolean) : [];
      if (!ids.length) return res.status(400).json({ error: "target.user_ids is required" });

      const users = await User.findAll({ where: { id: { [Op.in]: ids } }, attributes: ["id", "municipality_id", "role"] });
      const recipients = [
        ...superAdminIds.map((id) => ({ user_id: id, recipient_kind: "DIRECT_USER", recipient_municipality_id: null })),
        ...users.map((u) => ({
          user_id: Number(u.id),
          recipient_kind: "DIRECT_USER",
          recipient_municipality_id: u.municipality_id || null
        }))
      ];
      const { thread } = await createThreadWithRecipients({
        req,
        subject,
        body_html,
        recipients,
        attachments
      });
      createdThreadIds.push(thread.id);
    } else {
      return res.status(400).json({ error: "Unsupported target.type" });
    }

    res.json({ thread_ids: createdThreadIds });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/mail/threads/:threadId/messages", uploadMailAttachments.array("attachments", 10), async (req, res, next) => {
  try {
    const threadId = Number(req.params.threadId);
    if (!threadId) return res.status(400).json({ error: "Invalid threadId" });
    const body_html = String(req.body?.body_html || "").trim();
    if (!body_html) return res.status(400).json({ error: "body_html is required" });
    const reply_to_message_id = req.body?.reply_to_message_id ? Number(req.body.reply_to_message_id) : null;

    const rec = await MailRecipient.findOne({ where: { thread_id: threadId, user_id: req.user.id } });
    if (!rec) return res.status(403).json({ error: "Forbidden" });

    const attachments = req.files || [];

    const result = await sequelize.transaction(async (transaction) => {
      if (reply_to_message_id) {
        const parent = await MailMessage.findOne({ where: { id: reply_to_message_id, thread_id: threadId }, transaction });
        if (!parent) throw Object.assign(new Error("Invalid reply_to_message_id"), { status: 400 });
      }

      const msg = await MailMessage.create(
        {
          thread_id: threadId,
          author_user_id: req.user.id,
          author_municipality_id: null,
          reply_to_message_id: reply_to_message_id || null,
          body_html,
          created_at: new Date()
        },
        { transaction }
      );

      if (attachments.length) {
        for (const f of attachments) {
          const rel = `mail/${f.filename}`.replace(/\\/g, "/");
          const url = publicFileUrl(rel);
          await MailAttachment.create(
            {
              message_id: msg.id,
              filename: String(f.originalname || "file").slice(0, 1024),
              mime_type: String(f.mimetype || "application/octet-stream").slice(0, 255),
              size_bytes: Number(f.size || 0),
              file_url: url,
              created_at: new Date()
            },
            { transaction }
          );
          await audit(
            req.user.id,
            "MAIL_ATTACHMENT_UPLOAD",
            { thread_id: threadId, message_id: msg.id, filename: String(f.originalname || ""), size_bytes: Number(f.size || 0) },
            { req, transaction }
          );
        }
      }

      await MailThread.update({ last_message_at: new Date() }, { where: { id: threadId }, transaction });

      await touchSeenAndRead(req, threadId, transaction);
      await audit(req.user.id, "MAIL_MESSAGE_CREATE", { thread_id: threadId, message_id: msg.id }, { req, transaction });
      return msg;
    });

    res.json({ message: result });
  } catch (e) {
    next(e);
  }
});

module.exports = { adminRouter };

