const express = require("express");
const bcrypt = require("bcryptjs");

const { requireAuth, attachUser, checkBlocked, requireRole } = require("../middleware/auth");
// eslint-disable-next-line no-unused-vars
const { Op } = require("sequelize");
const { Application, AppVersion, Download } = require("../db");
const { audit } = require("../services/audit");
const { withTxAudit } = require("../services/txAudit");

const muniRouter = express.Router();

muniRouter.use(requireAuth, attachUser, checkBlocked, requireRole(["MUNI_ADMIN", "SUPER_ADMIN"]));

muniRouter.get("/me", (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      municipality_id: req.user.municipality_id,
      is_blocked: req.user.is_blocked
    }
  });
});

// Allow municipality user to change their own password/code
muniRouter.post("/me/change-code", async (req, res, next) => {
  try {
    const { current_code, new_code } = req.body || {};
    if (!current_code || !new_code) return res.status(400).json({ error: "current_code and new_code are required" });

    const currentOk = await bcrypt.compare(String(current_code), req.user.password_hash);
    if (!currentOk) {
      await audit(req.user.id, "SELF_CODE_CHANGE_FAILED", { reason: "INVALID_CURRENT_CODE" }, { req });
      return res.status(400).json({ error: "Current code is incorrect" });
    }

    const nextCode = String(new_code).trim();
    if (nextCode.length < 8) return res.status(400).json({ error: "New code must be at least 8 characters" });

    const password_hash = await bcrypt.hash(nextCode, 12);
    const before = { id: req.user.id, username: req.user.username };
    await withTxAudit(
      req,
      req.user.id,
      "SELF_CODE_CHANGE",
      { entity: { type: "User", id: req.user.id }, before, after: { ...before } },
      async (transaction) => {
        await req.user.update({ password_hash }, { transaction });
      }
    );

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

muniRouter.get("/apps", async (req, res, next) => {
  try {
    const apps = await Application.findAll({
      include: [{ model: AppVersion, as: "currentVersion" }],
      order: [["id", "ASC"]]
    });

    const downloads = await Download.findAll({
      where: { user_id: req.user.id },
      include: [{ model: AppVersion, attributes: ["id", "app_id", "version_number"] }],
      order: [["timestamp", "DESC"]],
      limit: 5000
    });

    const lastByAppId = new Map();
    for (const d of downloads) {
      const v = d.AppVersion;
      if (!v) continue;
      const k = String(v.app_id);
      if (!lastByAppId.has(k)) {
        lastByAppId.set(k, {
          version_id: d.version_id,
          version_number: v.version_number,
          timestamp: d.timestamp
        });
      }
    }

    const rows = apps.map((a) => {
      const current = a.currentVersion || null;
      const last = lastByAppId.get(String(a.id)) || null;
      let status = "NEVER_DOWNLOADED";
      if (!current) status = "NO_VERSIONS";
      else if (!last) status = "NEVER_DOWNLOADED";
      else if (String(last.version_id) === String(current.id)) status = "UP_TO_DATE";
      else status = "OUTDATED";

      return {
        ...a.toJSON(),
        status,
        last
      };
    });

    res.json({ apps: rows });
  } catch (e) {
    next(e);
  }
});

// App details for municipality user: versions + last download info
muniRouter.get("/apps/:appId", async (req, res, next) => {
  try {
    const app = await Application.findByPk(req.params.appId, {
      include: [{ model: AppVersion, as: "currentVersion" }]
    });
    if (!app) return res.status(404).json({ error: "App not found" });

    const versions = await AppVersion.findAll({
      where: { app_id: app.id },
      order: [["created_at", "DESC"], ["id", "DESC"]]
    });

    const lastDownload = await Download.findOne({
      where: { user_id: req.user.id },
      include: [{ model: AppVersion, where: { app_id: app.id }, attributes: ["id", "version_number"] }],
      order: [["timestamp", "DESC"]]
    });

    const current = app.currentVersion || null;
    const last = lastDownload
      ? {
          version_id: lastDownload.version_id,
          version_number: lastDownload.AppVersion?.version_number || null,
          timestamp: lastDownload.timestamp
        }
      : null;

    let status = "NEVER_DOWNLOADED";
    if (!current) status = "NO_VERSIONS";
    else if (!last) status = "NEVER_DOWNLOADED";
    else if (String(last.version_id) === String(current.id)) status = "UP_TO_DATE";
    else status = "OUTDATED";

    res.json({
      app: app.toJSON(),
      versions,
      status,
      last
    });
  } catch (e) {
    next(e);
  }
});

// Logs download + returns file_url (frontend should redirect/open it)
muniRouter.post("/downloads", async (req, res, next) => {
  try {
    const { version_id } = req.body || {};
    if (!version_id) return res.status(400).json({ error: "version_id is required" });

    const version = await AppVersion.findByPk(version_id, { include: [{ model: Application }] });
    if (!version) return res.status(404).json({ error: "Version not found" });

    const ip =
      (req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : null) ||
      req.socket?.remoteAddress ||
      null;

    const { download } = await withTxAudit(
      req,
      req.user.id,
      "DOWNLOAD",
      {
        entity: { type: "Download", id: null },
        after: { user_id: req.user.id, version_id: version.id, ip_address: ip },
        app: { id: version.app_id },
        version: { id: version.id, version_number: version.version_number }
      },
      async (transaction) => {
        const download = await Download.create(
          {
            user_id: req.user.id,
            version_id: version.id,
            ip_address: ip
          },
          { transaction }
        );
        return { download };
      }
    );

    res.json({ download: { id: download.id, timestamp: download.timestamp }, file_url: version.file_url });
  } catch (e) {
    next(e);
  }
});

// Optional helper: show last downloads for this municipality user
muniRouter.get("/downloads", async (req, res, next) => {
  try {
    const downloads = await Download.findAll({
      where: { user_id: req.user.id },
      include: [{ model: AppVersion, include: [{ model: Application }] }],
      order: [["timestamp", "DESC"]],
      limit: 50
    });

    res.json({
      downloads: downloads.map((d) => ({
        id: d.id,
        timestamp: d.timestamp,
        ip_address: d.ip_address,
        app: d.AppVersion?.Application ? { id: d.AppVersion.Application.id, app_name: d.AppVersion.Application.app_name } : null,
        version: d.AppVersion ? { id: d.AppVersion.id, version_number: d.AppVersion.version_number } : null
      }))
    });
  } catch (e) {
    next(e);
  }
});

module.exports = { muniRouter };

