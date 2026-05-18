const { sequelize, MailThread, MailMessage, MailRecipient, MailAttachment } = require("../db");
const { audit } = require("./audit");
const { publicFileUrl } = require("./storage");

/**
 * Create a mail thread with first message and recipients (same rules as admin POST /mail/threads).
 * @param {{ req: import("express").Request, subject: string, body_html: string, recipients: Array<{ user_id: number, recipient_kind: string, recipient_municipality_id: number | null }>, attachments?: any[], author_user_id?: number, author_municipality_id?: number | null }} opts
 */
async function createThreadWithRecipients(opts) {
  const { req, subject, body_html, recipients, attachments, author_user_id, author_municipality_id } = opts;
  const authorUserId = author_user_id != null ? Number(author_user_id) : Number(req.user.id);
  const authorMunicipalityId =
    author_municipality_id !== undefined
      ? author_municipality_id
      : req.user.role === "MUNI_ADMIN"
        ? req.user.municipality_id
        : null;

  return sequelize.transaction(async (transaction) => {
    const now = new Date();
    const thread = await MailThread.create(
      {
        subject,
        created_by_user_id: authorUserId,
        created_by_municipality_id: authorMunicipalityId,
        last_message_at: now,
        created_at: now,
      },
      { transaction },
    );

    const msg = await MailMessage.create(
      {
        thread_id: thread.id,
        author_user_id: authorUserId,
        author_municipality_id: authorMunicipalityId,
        body_html,
        created_at: now,
      },
      { transaction },
    );

    const seenKey = (r) =>
      `${Number(r.user_id)}:${r.recipient_kind}:${r.recipient_municipality_id ? Number(r.recipient_municipality_id) : ""}`;
    const uniqueRecipients = [];
    const seen = new Set();
    for (const r of recipients || []) {
      const u = Number(r.user_id);
      if (!u) continue;
      const item = {
        user_id: u,
        recipient_kind: r.recipient_kind,
        recipient_municipality_id: r.recipient_municipality_id ?? null,
      };
      const k = seenKey(item);
      if (seen.has(k)) continue;
      seen.add(k);
      uniqueRecipients.push(item);
    }

    for (const r of uniqueRecipients) {
      await MailRecipient.create(
        {
          thread_id: thread.id,
          user_id: r.user_id,
          recipient_kind: r.recipient_kind,
          recipient_municipality_id: r.recipient_municipality_id,
          created_at: now,
        },
        { transaction },
      );
    }

    const senderAlready = uniqueRecipients.some((r) => Number(r.user_id) === authorUserId);
    if (!senderAlready) {
      await MailRecipient.create(
        {
          thread_id: thread.id,
          user_id: authorUserId,
          recipient_kind: "DIRECT_USER",
          recipient_municipality_id: authorMunicipalityId,
          last_read_at: now,
          first_seen_at: now,
          last_seen_at: now,
          created_at: now,
        },
        { transaction },
      );
    } else {
      await MailRecipient.update(
        { last_read_at: now, first_seen_at: now, last_seen_at: now },
        { where: { thread_id: thread.id, user_id: authorUserId }, transaction },
      );
    }

    if (Array.isArray(attachments) && attachments.length) {
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
            created_at: now,
          },
          { transaction },
        );
        await audit(
          req.user.id,
          "MAIL_ATTACHMENT_UPLOAD",
          { thread_id: thread.id, message_id: msg.id, filename: String(f.originalname || ""), size_bytes: Number(f.size || 0) },
          { req, transaction },
        );
      }
    }

    await audit(
      req.user.id,
      "MAIL_THREAD_CREATE",
      { thread_id: thread.id, subject, recipients_count: uniqueRecipients.length },
      { req, transaction },
    );
    await audit(req.user.id, "MAIL_MESSAGE_CREATE", { thread_id: thread.id, message_id: msg.id }, { req, transaction });

    return { thread, msg };
  });
}

module.exports = { createThreadWithRecipients };
