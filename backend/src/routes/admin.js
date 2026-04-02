const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const { requireAuth, attachUser, checkBlocked, requireRole } = require("../middleware/auth");
const { Op } = require("sequelize");
const { Application, AppVersion, Municipality, User, Download } = require("../db");
const { audit } = require("../services/audit");
const { withTxAudit } = require("../services/txAudit");
const { storageRoot, publicFileUrl } = require("../services/storage");
const { generate8DigitCode, generateUsernameFromMunicipalityCode } = require("../services/security");
const { generateCredentialsPdf, generateVersionProgressPdf } = require("../services/pdf");

const adminRouter = express.Router();

adminRouter.use(requireAuth, attachUser, checkBlocked, requireRole("SUPER_ADMIN"));

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

adminRouter.post("/municipalities/:municipalityId/users", async (req, res, next) => {
  try {
    const muni = await Municipality.findByPk(req.params.municipalityId);
    if (!muni) return res.status(404).json({ error: "Municipality not found" });

    const requestedUsername = (req.body?.username || "").trim();
    const username = requestedUsername || generateUsernameFromMunicipalityCode(muni.code);

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
        after: { username, role: "MUNI_ADMIN", municipality_id: muni.id, is_blocked: false },
        pdf_url: pdf.file_url
      },
      async (transaction) => {
        const user = await User.create(
          {
            username,
            password_hash,
            role: "MUNI_ADMIN",
            municipality_id: muni.id,
            is_blocked: false
          },
          { transaction }
        );
        return { user };
      }
    );

    res.json({
      user: { id: user.id, username: user.username, role: user.role, municipality_id: user.municipality_id },
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

    const before = { id: user.id, username: user.username, municipality_id: user.municipality_id, is_blocked: user.is_blocked, role: user.role };
    await withTxAudit(
      req,
      req.user.id,
      "PASSWORD_RESET",
      { entity: { type: "User", id: user.id }, before, after: { ...before }, pdf_url: pdf.file_url },
      async (transaction) => {
        await user.update({ password_hash }, { transaction });
      }
    );

    res.json({ user: { id: user.id, username: user.username }, credentials: { code8, pdf_url: pdf.file_url } });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/users/:userId/block", async (req, res, next) => {
  try {
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

    const users = await User.findAll({ where: { municipality_id: muni.id }, attributes: ["id", "username"] });
    const userIds = users.map((u) => u.id);

    const downloads = userIds.length
      ? await Download.findAll({
          where: { user_id: { [Op.in]: userIds } },
          include: [{ model: AppVersion, include: [{ model: Application }] }, { model: User, attributes: ["id", "username"] }],
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

module.exports = { adminRouter };

