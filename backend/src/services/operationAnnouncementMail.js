const { User } = require("../db");
const { resolveRecipientsFromTarget } = require("../modules/operations/recipients");
const { createThreadWithRecipients } = require("./mailThreadCreate");

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateSubject(s, max = 480) {
  const t = String(s || "").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

async function buildMailRecipientsForOperationTarget(target) {
  const resolved = await resolveRecipientsFromTarget(User, target);
  const superAdmins = await User.findAll({ where: { role: "SUPER_ADMIN" }, attributes: ["id"] });
  const superAdminIds = superAdmins.map((u) => Number(u.id));
  const recipients = [
    ...superAdminIds.map((id) => ({ user_id: id, recipient_kind: "DIRECT_USER", recipient_municipality_id: null })),
    ...resolved,
  ];
  return recipients;
}

/** @param {any} operation from loadOperationDetail with includeTarget */
function templatesOperationCreatedAr(operation) {
  const titleEsc = escapeHtml(operation.title);
  const desc = operation.description
    ? `<p dir="rtl" style="margin-top:10px">${escapeHtml(operation.description)}</p>`
    : "";
  const subject = truncateSubject(`[عملية جديدة] ${operation.title}`);
  const body_html = `
<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; line-height:1.6;">
<p>السلام عليكم،</p>
<p>تم إنشاء <strong>عملية جديدة</strong> على مستوى الولاية بعنوان: <strong>${titleEsc}</strong></p>
${desc}
<p>يرجى الاطلاع على قسم <strong>«العمليات»</strong> في المنصة وإكمال الجدول المخصص لبلديتكم في الوقت المناسب.</p>
<p style="color:#64748b;font-size:13px;">هذه الرسالة أُرسلت تلقائياً عند إنشاء العملية.</p>
</div>
`.trim();
  return { subject, body_html };
}

/** @param {any} operation */
function templatesOperationSchemaUpdatedAr(operation, notePlain) {
  const titleEsc = escapeHtml(operation.title);
  const note = notePlain
    ? `<p dir="rtl" style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:8px"><strong>تنبيه من الإدارة:</strong><br/>${escapeHtml(
        notePlain,
      )}</p>`
    : "";
  const subject = truncateSubject(`[تعديل عملية] ${operation.title}`);
  const body_html = `
<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; line-height:1.6;">
<p>السلام عليكم،</p>
<p>تم <strong>تعديل هيكلة أو محتوى</strong> العملية: <strong>${titleEsc}</strong> (مثلاً: أعمدة جديدة، تغيير ترتيب، خيارات، إلخ).</p>
<p>يرجى مراجعة جدولكم في قسم <strong>«العمليات»</strong> وتحديث البيانات وفق التعديلات قبل المتابعة.</p>
${note}
<p style="color:#64748b;font-size:13px;">إن لم تكن بحاجة لتغيير بياناتكم بعد، يمكنكم تجاهل التنبيه المتعلق بالتحديث فقط.</p>
</div>
`.trim();
  return { subject, body_html };
}

/**
 * @param {import("express").Request} req
 * @param {any} operation loadOperationDetail(..., { includeTarget: true })
 */
async function sendOperationCreatedAnnouncement(req, operation) {
  const target = operation.target;
  if (!target?.type) throw new Error("operation.target missing");
  const recipients = await buildMailRecipientsForOperationTarget(target);
  const { subject, body_html } = templatesOperationCreatedAr(operation);
  const { thread } = await createThreadWithRecipients({ req, subject, body_html, recipients, attachments: [] });
  return thread.id;
}

/**
 * @param {import("express").Request} req
 * @param {any} operation
 * @param {{ note?: string }} [opts]
 */
async function sendOperationSchemaUpdatedAnnouncement(req, operation, opts = {}) {
  const target = operation.target;
  if (!target?.type) throw new Error("operation.target missing");
  const recipients = await buildMailRecipientsForOperationTarget(target);
  const note = opts.note != null ? String(opts.note).trim() : "";
  const { subject, body_html } = templatesOperationSchemaUpdatedAr(operation, note);
  const { thread } = await createThreadWithRecipients({ req, subject, body_html, recipients, attachments: [] });
  return thread.id;
}

module.exports = {
  sendOperationCreatedAnnouncement,
  sendOperationSchemaUpdatedAnnouncement,
};
