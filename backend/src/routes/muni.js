const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const {
  requireAuth,
  attachUser,
  checkBlocked,
  requireRole,
} = require("../middleware/auth");
// eslint-disable-next-line no-unused-vars
const { Op } = require("sequelize");
const {
  Application,
  AppVersion,
  Download,
  MailThread,
  MailMessage,
  MailRecipient,
  MailAttachment,
  User,
  Municipality,
  sequelize,
} = require("../db");
const { audit } = require("../services/audit");
const { withTxAudit } = require("../services/txAudit");
const { storageRoot, publicFileUrl } = require("../services/storage");
const { operationsMuniRouter } = require("./operationsMuni");
const { etatPrincipaleMuniRouter } = require("./etatPrincipaleMuni");
const { communeItStaffMuniRouter } = require("./communeItStaffMuni");
const municipalityAnnexService = require("../modules/annexes/municipalityAnnexService");
const mailSendRequestService = require("../modules/mail/mailSendRequestService");
const { createMailValidationRouter } = require("./mailValidation");

const muniRouter = express.Router();

muniRouter.use(
  requireAuth,
  attachUser,
  checkBlocked,
  requireRole(["MUNI_ADMIN", "SUPER_ADMIN"]),
);

muniRouter.use(operationsMuniRouter);
muniRouter.use(etatPrincipaleMuniRouter);
muniRouter.use(communeItStaffMuniRouter);

muniRouter.get("/annexes", async (req, res, next) => {
  try {
    const out = await municipalityAnnexService.listForMuniUser(req.user);
    if (out.error) return res.status(out.status).json({ error: out.error });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

muniRouter.patch("/annexes/:annexId", async (req, res, next) => {
  try {
    const out = await municipalityAnnexService.patchStatusForMuniUser(
      req.user,
      Number(req.params.annexId),
      req.body || {}
    );
    if (out.error) return res.status(out.status).json({ error: out.error });
    await audit(
      req.user.id,
      "MUNICIPALITY_ANNEX_STATUS_UPDATE",
      { annex_id: out.annex.id, municipality_id: out.annex.municipality_id, status: out.annex.status },
      { req }
    );
    res.json(out);
  } catch (e) {
    next(e);
  }
});

function safeUserForMuni(u) {
  if (!u) return null;
  const base = {
    id: u.id,
    name: u.name,
    role: u.role,
    municipality_id: u.municipality_id,
  };
  // Do not expose wilaya admin usernames to commune users
  if (u.role === "SUPER_ADMIN") return { ...base, username: null };
  return { ...base, username: u.username };
}

const uploadMailAttachments = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(storageRoot(), "mail")),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 16) || "";
      const name = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

muniRouter.use("/mail", createMailValidationRouter({ uploadMailAttachments }));

// List wilaya admins for commune selection (no search needed)
muniRouter.get("/wilaya-admins", async (req, res, next) => {
  try {
    const admins = await User.findAll({
      where: { role: "SUPER_ADMIN" },
      attributes: ["id", "name", "role"],
      order: [["id", "ASC"]],
    });
    res.json({
      admins: admins.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    });
  } catch (e) {
    next(e);
  }
});

muniRouter.get("/me", (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      name: req.user.name,
      role: req.user.role,
      municipality_id: req.user.municipality_id,
      is_blocked: req.user.is_blocked,
    },
  });
});

// Allow municipality user to change their own password/code
muniRouter.post("/me/change-code", async (req, res, next) => {
  try {
    const { current_code, new_code } = req.body || {};
    if (!current_code || !new_code)
      return res
        .status(400)
        .json({ error: "current_code and new_code are required" });

    const currentOk = await bcrypt.compare(
      String(current_code),
      req.user.password_hash,
    );
    if (!currentOk) {
      await audit(
        req.user.id,
        "SELF_CODE_CHANGE_FAILED",
        { reason: "INVALID_CURRENT_CODE" },
        { req },
      );
      return res.status(400).json({ error: "Current code is incorrect" });
    }

    const nextCode = String(new_code).trim();
    if (nextCode.length < 8)
      return res
        .status(400)
        .json({ error: "New code must be at least 8 characters" });

    const password_hash = await bcrypt.hash(nextCode, 12);
    const before = { id: req.user.id, username: req.user.username };
    await withTxAudit(
      req,
      req.user.id,
      "SELF_CODE_CHANGE",
      {
        entity: { type: "User", id: req.user.id },
        before,
        after: { ...before },
      },
      async (transaction) => {
        await req.user.update({ password_hash }, { transaction });
      },
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
      order: [["id", "ASC"]],
    });

    const downloads = await Download.findAll({
      where: { user_id: req.user.id },
      include: [
        { model: AppVersion, attributes: ["id", "app_id", "version_number"] },
      ],
      order: [["timestamp", "DESC"]],
      limit: 5000,
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
          timestamp: d.timestamp,
        });
      }
    }

    const rows = apps.map((a) => {
      const current = a.currentVersion || null;
      const last = lastByAppId.get(String(a.id)) || null;
      let status = "NEVER_DOWNLOADED";
      if (!current) status = "NO_VERSIONS";
      else if (!last) status = "NEVER_DOWNLOADED";
      else if (String(last.version_id) === String(current.id))
        status = "UP_TO_DATE";
      else status = "OUTDATED";

      return {
        ...a.toJSON(),
        status,
        last,
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
      include: [{ model: AppVersion, as: "currentVersion" }],
    });
    if (!app) return res.status(404).json({ error: "App not found" });

    const versions = await AppVersion.findAll({
      where: { app_id: app.id },
      order: [
        ["created_at", "DESC"],
        ["id", "DESC"],
      ],
    });

    const lastDownload = await Download.findOne({
      where: { user_id: req.user.id },
      include: [
        {
          model: AppVersion,
          where: { app_id: app.id },
          attributes: ["id", "version_number"],
        },
      ],
      order: [["timestamp", "DESC"]],
    });

    const current = app.currentVersion || null;
    const last = lastDownload
      ? {
          version_id: lastDownload.version_id,
          version_number: lastDownload.AppVersion?.version_number || null,
          timestamp: lastDownload.timestamp,
        }
      : null;

    let status = "NEVER_DOWNLOADED";
    if (!current) status = "NO_VERSIONS";
    else if (!last) status = "NEVER_DOWNLOADED";
    else if (String(last.version_id) === String(current.id))
      status = "UP_TO_DATE";
    else status = "OUTDATED";

    res.json({
      app: app.toJSON(),
      versions,
      status,
      last,
    });
  } catch (e) {
    next(e);
  }
});

// Logs download + returns file_url (frontend should redirect/open it)
muniRouter.post("/downloads", async (req, res, next) => {
  try {
    const { version_id } = req.body || {};
    if (!version_id)
      return res.status(400).json({ error: "version_id is required" });

    const version = await AppVersion.findByPk(version_id, {
      include: [{ model: Application }],
    });
    if (!version) return res.status(404).json({ error: "Version not found" });

    const ip =
      (req.headers["x-forwarded-for"]
        ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
        : null) ||
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
        version: { id: version.id, version_number: version.version_number },
      },
      async (transaction) => {
        const download = await Download.create(
          {
            user_id: req.user.id,
            version_id: version.id,
            ip_address: ip,
          },
          { transaction },
        );
        return { download };
      },
    );

    res.json({
      download: { id: download.id, timestamp: download.timestamp },
      file_url: version.file_url,
    });
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
      limit: 50,
    });

    res.json({
      downloads: downloads.map((d) => ({
        id: d.id,
        timestamp: d.timestamp,
        ip_address: d.ip_address,
        app: d.AppVersion?.Application
          ? {
              id: d.AppVersion.Application.id,
              app_name: d.AppVersion.Application.app_name,
            }
          : null,
        version: d.AppVersion
          ? { id: d.AppVersion.id, version_number: d.AppVersion.version_number }
          : null,
      })),
    });
  } catch (e) {
    next(e);
  }
});

async function touchSeenAndRead(req, threadId, transaction) {
  const rec = await MailRecipient.findOne({
    where: { thread_id: threadId, user_id: req.user.id },
    transaction,
  });
  if (!rec) return null;

  const now = new Date();
  const updates = { last_seen_at: now, last_read_at: now };
  if (!rec.first_seen_at) updates.first_seen_at = now;

  await rec.update(updates, { transaction });

  if (!rec.first_seen_at) {
    await audit(
      req.user.id,
      "MAIL_THREAD_SEEN",
      { thread_id: Number(threadId), first_seen_at: now, last_seen_at: now },
      { req, transaction },
    );
  } else {
    await audit(
      req.user.id,
      "MAIL_THREAD_SEEN",
      { thread_id: Number(threadId), last_seen_at: now },
      { req, transaction },
    );
  }
  await audit(
    req.user.id,
    "MAIL_THREAD_READ",
    { thread_id: Number(threadId), last_read_at: now },
    { req, transaction },
  );
  return rec;
}

muniRouter.get("/mail/threads", async (req, res, next) => {
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
          `("mail_recipients"."last_read_at" IS NULL OR "mail_recipients"."last_read_at" < "thread"."last_message_at")`,
        ),
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
            {
              model: Municipality,
              as: "createdByMunicipality",
              attributes: ["id", "code", "name_ar", "name_fr"],
            },
            {
              model: User,
              as: "createdByUser",
              attributes: ["id", "username", "name", "role", "municipality_id"],
            },
          ],
        },
        {
          model: Municipality,
          as: "recipientMunicipality",
          attributes: ["id", "code", "name_ar", "name_fr"],
        },
      ],
      order: [[{ model: MailThread, as: "thread" }, "last_message_at", "DESC"]],
      offset,
      limit: pageSize,
    });

    const threads = rows.map((r) => {
      const t = r.thread;
      const unread =
        !r.last_read_at ||
        new Date(r.last_read_at).getTime() <
          new Date(t.last_message_at).getTime();
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
              name_fr: r.recipientMunicipality.name_fr,
            }
          : null,
        created_by: t.createdByUser ? safeUserForMuni(t.createdByUser) : null,
        created_by_municipality: t.createdByMunicipality
          ? {
              id: t.createdByMunicipality.id,
              code: t.createdByMunicipality.code,
              name_ar: t.createdByMunicipality.name_ar,
              name_fr: t.createdByMunicipality.name_fr,
            }
          : null,
        validation_outcome: t.validation_outcome || null,
        unread,
      };
    });

    res.json({ threads, total: count, page, pageSize });
  } catch (e) {
    next(e);
  }
});

muniRouter.get("/mail/unread-count", async (req, res, next) => {
  try {
    const out = await sequelize.query(
      `
      SELECT COUNT(*)::bigint AS c
      FROM mail_recipients r
      JOIN mail_threads t ON t.id = r.thread_id
      WHERE r.user_id = :uid
        AND (r.last_read_at IS NULL OR r.last_read_at < t.last_message_at)
      `,
      {
        replacements: { uid: req.user.id },
        type: require("sequelize").QueryTypes.SELECT,
      },
    );
    const c = out?.[0]?.c ?? 0;
    res.json({ unread: Number(c) });
  } catch (e) {
    next(e);
  }
});

muniRouter.get("/mail/threads/:threadId", async (req, res, next) => {
  try {
    const threadId = Number(req.params.threadId);
    if (!threadId) return res.status(400).json({ error: "Invalid threadId" });

    const rec = await MailRecipient.findOne({
      where: { thread_id: threadId, user_id: req.user.id },
    });
    if (!rec) return res.status(403).json({ error: "Forbidden" });

    const thread = await MailThread.findByPk(threadId, {
      include: [
        {
          model: Municipality,
          as: "createdByMunicipality",
          attributes: ["id", "code", "name_ar", "name_fr"],
        },
        {
          model: User,
          as: "createdByUser",
          attributes: ["id", "username", "name", "role", "municipality_id"],
        },
        {
          model: MailThread,
          as: "parentThread",
          attributes: ["id", "subject"],
        },
        {
          model: MailMessage,
          as: "parentMessage",
          attributes: ["id", "created_at", "body_html"],
          include: [
            {
              model: User,
              as: "authorUser",
              attributes: ["id", "username", "name", "role", "municipality_id"],
            },
            {
              model: Municipality,
              as: "authorMunicipality",
              attributes: ["id", "code", "name_ar", "name_fr"],
            },
          ],
        },
      ],
    });
    if (!thread) return res.status(404).json({ error: "Thread not found" });

    const messages = await MailMessage.findAll({
      where: { thread_id: threadId },
      include: [
        {
          model: User,
          as: "authorUser",
          attributes: ["id", "username", "name", "role", "municipality_id"],
        },
        {
          model: Municipality,
          as: "authorMunicipality",
          attributes: ["id", "code", "name_ar", "name_fr"],
        },
        {
          model: MailMessage,
          as: "replyToMessage",
          attributes: ["id", "created_at", "body_html"],
          include: [
            {
              model: User,
              as: "authorUser",
              attributes: ["id", "username", "name", "role", "municipality_id"],
            },
            {
              model: Municipality,
              as: "authorMunicipality",
              attributes: ["id", "code", "name_ar", "name_fr"],
            },
          ],
        },
        { model: MailAttachment, as: "attachments" },
      ],
      order: [
        ["created_at", "ASC"],
        ["id", "ASC"],
      ],
    });

    await sequelize.transaction(async (transaction) => {
      await touchSeenAndRead(req, threadId, transaction);
    });

    res.json({
      thread: (() => {
        const t = thread.toJSON();
        if (t.createdByUser) t.createdByUser = safeUserForMuni(t.createdByUser);
        if (t.parentMessage?.authorUser)
          t.parentMessage.authorUser = safeUserForMuni(
            t.parentMessage.authorUser,
          );
        if (t.parentMessage?.replyToMessage?.authorUser)
          t.parentMessage.replyToMessage.authorUser = safeUserForMuni(
            t.parentMessage.replyToMessage.authorUser,
          );
        return t;
      })(),
      messages: messages.map((m) => {
        const mm = m.toJSON();
        if (mm.authorUser) mm.authorUser = safeUserForMuni(mm.authorUser);
        if (mm.replyToMessage?.authorUser)
          mm.replyToMessage.authorUser = safeUserForMuni(
            mm.replyToMessage.authorUser,
          );
        return mm;
      }),
      my_recipient: {
        recipient_kind: rec.recipient_kind,
        recipient_municipality_id: rec.recipient_municipality_id,
      },
    });
  } catch (e) {
    next(e);
  }
});

// For commune users: see whether Wilaya admins have seen/read this thread
muniRouter.get(
  "/mail/threads/:threadId/wilaya-seen",
  async (req, res, next) => {
    try {
      const threadId = Number(req.params.threadId);
      if (!threadId) return res.status(400).json({ error: "Invalid threadId" });

      const rec = await MailRecipient.findOne({
        where: { thread_id: threadId, user_id: req.user.id },
      });
      if (!rec) return res.status(403).json({ error: "Forbidden" });

      const rows = await MailRecipient.findAll({
        where: { thread_id: threadId },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "name", "role", "municipality_id"],
          },
        ],
        order: [["id", "ASC"]],
      });

      const wilaya = rows
        .filter((r) => r.user?.role === "SUPER_ADMIN")
        .map((r) => ({
          user: safeUserForMuni(r.user),
          first_seen_at: r.first_seen_at,
          last_seen_at: r.last_seen_at,
          last_read_at: r.last_read_at,
        }));

      res.json({ wilaya_admins: wilaya });
    } catch (e) {
      next(e);
    }
  },
);

// Create a NEW thread from commune to wilaya admins (all or selected)
muniRouter.post(
  "/mail/threads",
  uploadMailAttachments.array("attachments", 10),
  async (req, res, next) => {
    try {
      const subject = String(req.body?.subject || "")
        .trim()
        .slice(0, 500);
      const body_html = String(req.body?.body_html || "").trim();
      if (!subject)
        return res.status(400).json({ error: "subject is required" });
      if (!body_html)
        return res.status(400).json({ error: "body_html is required" });

      let target = req.body?.target;
      if (typeof target === "string") {
        try {
          target = JSON.parse(target);
        } catch {
          return res.status(400).json({ error: "Invalid target" });
        }
      }

      const type = String(target?.type || "");
      let adminIds = [];
      if (type === "ALL_WILAYA_ADMINS") {
        const admins = await User.findAll({
          where: { role: "SUPER_ADMIN" },
          attributes: ["id"],
        });
        adminIds = admins.map((u) => Number(u.id));
      } else if (type === "WILAYA_ADMINS") {
        adminIds = Array.isArray(target?.user_ids)
          ? target.user_ids.map((x) => Number(x)).filter(Boolean)
          : [];
        if (!adminIds.length)
          return res.status(400).json({ error: "user_ids is required" });
        const count = await User.count({
          where: { id: adminIds, role: "SUPER_ADMIN" },
        });
        if (count !== adminIds.length)
          return res.status(400).json({ error: "Invalid user_ids" });
      } else {
        return res.status(400).json({ error: "Invalid target" });
      }

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

      const recipients = [
        ...adminIds.map((id) => ({
          user_id: id,
          recipient_kind: "DIRECT_USER",
          recipient_municipality_id: null,
        })),
        {
          user_id: Number(req.user.id),
          recipient_kind: "DIRECT_USER",
          recipient_municipality_id: req.user.municipality_id || null,
        },
      ];
      const attachments = req.files || [];

      const out = await sequelize.transaction(async (transaction) => {
        const now = new Date();
        const thread = await MailThread.create(
          {
            subject,
            created_by_user_id: req.user.id,
            created_by_municipality_id: req.user.municipality_id || null,
            last_message_at: now,
            created_at: now,
          },
          { transaction },
        );

        const msg = await MailMessage.create(
          {
            thread_id: thread.id,
            author_user_id: req.user.id,
            author_municipality_id: req.user.municipality_id || null,
            body_html,
            created_at: now,
          },
          { transaction },
        );

        const seen = new Set();
        for (const r of recipients) {
          const key = `${Number(r.user_id)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          await MailRecipient.create(
            {
              thread_id: thread.id,
              user_id: Number(r.user_id),
              recipient_kind: r.recipient_kind,
              recipient_municipality_id: r.recipient_municipality_id ?? null,
              last_read_at:
                Number(r.user_id) === Number(req.user.id) ? now : null,
              first_seen_at:
                Number(r.user_id) === Number(req.user.id) ? now : null,
              last_seen_at:
                Number(r.user_id) === Number(req.user.id) ? now : null,
              created_at: now,
            },
            { transaction },
          );
        }

        if (attachments.length) {
          for (const f of attachments) {
            const rel = `mail/${f.filename}`.replace(/\\/g, "/");
            const url = publicFileUrl(rel);
            await MailAttachment.create(
              {
                message_id: msg.id,
                filename: String(f.originalname || "file").slice(0, 1024),
                mime_type: String(
                  f.mimetype || "application/octet-stream",
                ).slice(0, 255),
                size_bytes: Number(f.size || 0),
                file_url: url,
                created_at: now,
              },
              { transaction },
            );
            await audit(
              req.user.id,
              "MAIL_ATTACHMENT_UPLOAD",
              {
                thread_id: thread.id,
                message_id: msg.id,
                filename: String(f.originalname || ""),
                size_bytes: Number(f.size || 0),
              },
              { req, transaction },
            );
          }
        }

        await audit(
          req.user.id,
          "MAIL_THREAD_CREATE",
          {
            thread_id: thread.id,
            subject,
            target: type,
            admins_count: adminIds.length,
          },
          { req, transaction },
        );
        await audit(
          req.user.id,
          "MAIL_MESSAGE_CREATE",
          { thread_id: thread.id, message_id: msg.id },
          { req, transaction },
        );
        return thread;
      });

      res.json({ thread: out });
    } catch (e) {
      next(e);
    }
  },
);

muniRouter.post(
  "/mail/threads/:threadId/messages",
  uploadMailAttachments.array("attachments", 10),
  async (req, res, next) => {
    try {
      const threadId = Number(req.params.threadId);
      if (!threadId) return res.status(400).json({ error: "Invalid threadId" });
      const body_html = String(req.body?.body_html || "").trim();
      if (!body_html)
        return res.status(400).json({ error: "body_html is required" });
      const reply_to_message_id = req.body?.reply_to_message_id
        ? Number(req.body.reply_to_message_id)
        : null;

      const rec = await MailRecipient.findOne({
        where: { thread_id: threadId, user_id: req.user.id },
      });
      if (!rec) return res.status(403).json({ error: "Forbidden" });

      // Enforce: replies must include wilaya admins; group threads are allowed.
      if (req.user.role === "MUNI_ADMIN") {
        const allRecipients = await MailRecipient.findAll({
          where: { thread_id: threadId },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "role", "municipality_id"],
            },
          ],
        });

        const hasSuperAdmin = allRecipients.some(
          (r) => r.user?.role === "SUPER_ADMIN",
        );
        if (!hasSuperAdmin) return res.status(403).json({ error: "Forbidden" });
      }

      const attachments = req.files || [];

      const result = await sequelize.transaction(async (transaction) => {
        if (reply_to_message_id) {
          const parent = await MailMessage.findOne({
            where: { id: reply_to_message_id, thread_id: threadId },
            transaction,
          });
          if (!parent)
            throw Object.assign(new Error("Invalid reply_to_message_id"), {
              status: 400,
            });
        }

        const msg = await MailMessage.create(
          {
            thread_id: threadId,
            author_user_id: req.user.id,
            author_municipality_id:
              req.user.role === "MUNI_ADMIN" ? req.user.municipality_id : null,
            reply_to_message_id: reply_to_message_id || null,
            body_html,
            created_at: new Date(),
          },
          { transaction },
        );

        if (attachments.length) {
          for (const f of attachments) {
            const rel = `mail/${f.filename}`.replace(/\\/g, "/");
            const url = publicFileUrl(rel);
            await MailAttachment.create(
              {
                message_id: msg.id,
                filename: String(f.originalname || "file").slice(0, 1024),
                mime_type: String(
                  f.mimetype || "application/octet-stream",
                ).slice(0, 255),
                size_bytes: Number(f.size || 0),
                file_url: url,
                created_at: new Date(),
              },
              { transaction },
            );
            await audit(
              req.user.id,
              "MAIL_ATTACHMENT_UPLOAD",
              {
                thread_id: threadId,
                message_id: msg.id,
                filename: String(f.originalname || ""),
                size_bytes: Number(f.size || 0),
              },
              { req, transaction },
            );
          }
        }

        await MailThread.update(
          { last_message_at: new Date() },
          { where: { id: threadId }, transaction },
        );
        await touchSeenAndRead(req, threadId, transaction);
        await audit(
          req.user.id,
          "MAIL_MESSAGE_CREATE",
          { thread_id: threadId, message_id: msg.id },
          { req, transaction },
        );

        return msg;
      });

      res.json({ message: result });
    } catch (e) {
      next(e);
    }
  },
);

// Private reply: create a NEW thread to wilaya admins only (like "reply privately")
muniRouter.post(
  "/mail/threads/:threadId/private-reply",
  uploadMailAttachments.array("attachments", 10),
  async (req, res, next) => {
    try {
      const threadId = Number(req.params.threadId);
      if (!threadId) return res.status(400).json({ error: "Invalid threadId" });
      const body_html = String(req.body?.body_html || "").trim();
      if (!body_html)
        return res.status(400).json({ error: "body_html is required" });
      const parent_message_id = req.body?.parent_message_id
        ? Number(req.body.parent_message_id)
        : null;

      const rec = await MailRecipient.findOne({
        where: { thread_id: threadId, user_id: req.user.id },
      });
      if (!rec) return res.status(403).json({ error: "Forbidden" });

      const thread = await MailThread.findByPk(threadId);
      if (!thread) return res.status(404).json({ error: "Thread not found" });

      const superAdmins = await User.findAll({
        where: { role: "SUPER_ADMIN" },
        attributes: ["id"],
      });
      const recipients = [
        ...superAdmins.map((u) => ({
          user_id: Number(u.id),
          recipient_kind: "DIRECT_USER",
          recipient_municipality_id: null,
        })),
        {
          user_id: Number(req.user.id),
          recipient_kind: "DIRECT_USER",
          recipient_municipality_id: req.user.municipality_id || null,
        },
      ];

      const attachments = req.files || [];

      const out = await sequelize.transaction(async (transaction) => {
        const now = new Date();
        const newThread = await MailThread.create(
          {
            subject: String(
              req.body?.subject || `Re (private): ${thread.subject}`,
            ).slice(0, 500),
            created_by_user_id: req.user.id,
            created_by_municipality_id: req.user.municipality_id || null,
            parent_thread_id: threadId,
            parent_message_id: parent_message_id || null,
            last_message_at: now,
            created_at: now,
          },
          { transaction },
        );

        if (parent_message_id) {
          const parentMsg = await MailMessage.findOne({
            where: { id: parent_message_id, thread_id: threadId },
            transaction,
          });
          if (!parentMsg)
            throw Object.assign(new Error("Invalid parent_message_id"), {
              status: 400,
            });
        }

        const msg = await MailMessage.create(
          {
            thread_id: newThread.id,
            author_user_id: req.user.id,
            author_municipality_id: req.user.municipality_id || null,
            reply_to_message_id: parent_message_id || null,
            body_html,
            created_at: now,
          },
          { transaction },
        );

        const seen = new Set();
        for (const r of recipients) {
          const key = `${Number(r.user_id)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          await MailRecipient.create(
            {
              thread_id: newThread.id,
              user_id: Number(r.user_id),
              recipient_kind: r.recipient_kind,
              recipient_municipality_id: r.recipient_municipality_id ?? null,
              last_read_at:
                Number(r.user_id) === Number(req.user.id) ? now : null,
              first_seen_at:
                Number(r.user_id) === Number(req.user.id) ? now : null,
              last_seen_at:
                Number(r.user_id) === Number(req.user.id) ? now : null,
              created_at: now,
            },
            { transaction },
          );
        }

        if (attachments.length) {
          for (const f of attachments) {
            const rel = `mail/${f.filename}`.replace(/\\/g, "/");
            const url = publicFileUrl(rel);
            await MailAttachment.create(
              {
                message_id: msg.id,
                filename: String(f.originalname || "file").slice(0, 1024),
                mime_type: String(
                  f.mimetype || "application/octet-stream",
                ).slice(0, 255),
                size_bytes: Number(f.size || 0),
                file_url: url,
                created_at: now,
              },
              { transaction },
            );
            await audit(
              req.user.id,
              "MAIL_ATTACHMENT_UPLOAD",
              {
                thread_id: newThread.id,
                message_id: msg.id,
                filename: String(f.originalname || ""),
                size_bytes: Number(f.size || 0),
              },
              { req, transaction },
            );
          }
        }

        await audit(
          req.user.id,
          "MAIL_THREAD_CREATE",
          {
            thread_id: newThread.id,
            parent_thread_id: threadId,
            private: true,
          },
          { req, transaction },
        );
        await audit(
          req.user.id,
          "MAIL_MESSAGE_CREATE",
          { thread_id: newThread.id, message_id: msg.id },
          { req, transaction },
        );

        return { thread: newThread, message: msg };
      });

      res.json({ thread: out.thread });
    } catch (e) {
      next(e);
    }
  },
);

module.exports = { muniRouter };
