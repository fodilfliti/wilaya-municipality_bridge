const { User } = require("../db");
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

function templatesRncRequestAr({ municipality, line, requester }) {
  const code = escapeHtml(municipality?.code);
  const name = escapeHtml(municipality?.name_ar || municipality?.name_fr);
  const annex = escapeHtml(line?.annex_name);
  const ipReq = escapeHtml(line?.ip_requested);
  const pc = escapeHtml(line?.pc_used);
  const who = escapeHtml(requester?.name || requester?.username || "—");
  const subject = truncateSubject(
    `[طلب تفويض RNC ملحق] بلدية ${municipality?.code || ""} — ${line?.annex_name || ""} — ${line?.ip_requested || ""}`
  );
  const body_html = `
<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; line-height:1.6;">
<p>السلام عليكم،</p>
<p>تقدّمت بلدية <strong>${name}</strong> (رمز <strong>${code}</strong>) بطلب <strong>تفويض عنوان IP على شبكة RNC لملحق</strong>.</p>
<ul style="margin:12px 0;padding-right:20px;">
<li><strong>الملحق:</strong> ${annex || "—"}</li>
<li><strong>عنوان IP المطلوب:</strong> ${ipReq}</li>
<li><strong>الحاسوب المستخدم:</strong> ${pc || "—"}</li>
<li><strong>مقدّم الطلب:</strong> ${who}</li>
</ul>
<p>يرجى مراجعة قسم <strong>«الحالة الرئيسية → IP مصرّح RNC للملحقات»</strong> في المنصة للموافقة أو الرفض وتعيين <strong>IP المصرّح</strong> و<strong>سنة التفويض</strong>.</p>
<p style="color:#64748b;font-size:13px;">رسالة تلقائية عند طلب التفويض من طرف البلدية.</p>
</div>
`.trim();
  return { subject, body_html };
}

async function buildWilayaAdminRecipients() {
  const superAdmins = await User.findAll({ where: { role: "SUPER_ADMIN" }, attributes: ["id"] });
  return superAdmins.map((u) => ({
    user_id: Number(u.id),
    recipient_kind: "DIRECT_USER",
    recipient_municipality_id: null
  }));
}

/**
 * @param {import("express").Request} req
 * @param {{ municipality: any, line: any, requester: any }} payload
 */
async function sendAnnexRncAuthorizationRequestMail(req, payload) {
  const recipients = await buildWilayaAdminRecipients();
  if (!recipients.length) return null;
  const { subject, body_html } = templatesRncRequestAr(payload);
  const { thread } = await createThreadWithRecipients({ req, subject, body_html, recipients, attachments: [] });
  return thread.id;
}

module.exports = { sendAnnexRncAuthorizationRequestMail };
