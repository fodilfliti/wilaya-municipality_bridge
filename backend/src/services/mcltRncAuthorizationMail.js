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

function templatesRncRequestAr({ municipality, workstation, requester, request_mode }) {
  const code = escapeHtml(municipality?.code);
  const name = escapeHtml(municipality?.name_ar || municipality?.name_fr);
  const ipMclt = escapeHtml(workstation?.ip_mclt);
  const ipReq = escapeHtml(workstation?.ip_rnc_requested);
  const pc = escapeHtml(workstation?.pc_name);
  const who = escapeHtml(requester?.name || requester?.username || "—");
  const isGeneric = request_mode === "generic" || !workstation?.ip_rnc_requested;
  const demandLine = isGeneric
    ? "<li><strong>نوع الطلب:</strong> تفويض عنوان IP واحد (بدون تحديد مسبق — تخصيص من الولاية)</li>"
    : `<li><strong>عنوان IP المطلوب على RNC:</strong> ${ipReq}</li>`;
  const subjectHint = isGeneric ? "طلب عام" : workstation?.ip_rnc_requested || workstation?.ip_mclt || "";
  const subject = truncateSubject(`[طلب تفويض RNC] بلدية ${municipality?.code || ""} — ${subjectHint}`);
  const body_html = `
<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; line-height:1.6;">
<p>السلام عليكم،</p>
<p>تقدّمت بلدية <strong>${name}</strong> (رمز <strong>${code}</strong>) بطلب <strong>تفويض عنوان IP على شبكة RNC</strong>.</p>
<ul style="margin:12px 0;padding-right:20px;">
${demandLine}
<li><strong>عنوان IP MCLT (المنصب):</strong> ${ipMclt || "—"}</li>
<li><strong>اسم الحاسوب:</strong> ${pc || "—"}</li>
<li><strong>مقدّم الطلب:</strong> ${who}</li>
</ul>
<p>يرجى مراجعة قسم <strong>«الحالة الرئيسية → postes MCLT»</strong> في المنصة للموافقة أو الرفض وتعيين <strong>IP المصرّح RNC</strong>.</p>
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
 * @param {{ municipality: any, workstation: any, requester: any }} payload
 */
async function sendMcltRncAuthorizationRequestMail(req, payload) {
  const recipients = await buildWilayaAdminRecipients();
  if (!recipients.length) return null;
  const { subject, body_html } = templatesRncRequestAr(payload);
  const { thread } = await createThreadWithRecipients({ req, subject, body_html, recipients, attachments: [] });
  return thread.id;
}

module.exports = { sendMcltRncAuthorizationRequestMail };
