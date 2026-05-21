const { Op } = require("sequelize");
const {
  sequelize,
  User,
  MailSendRequest,
  MailSendRequestValidator,
  MailSendRequestDiscussion,
  MailSendRequestAttachment,
  MailAttachment,
} = require("../../db");
const { audit } = require("../../services/audit");
const { publicFileUrl } = require("../../services/storage");
const { createThreadWithRecipients } = require("../../services/mailThreadCreate");
const { mapUsersForMailPicker } = require("./mailPickerUserDto");

async function listValidatorCandidates(req) {
  const where = { is_blocked: false };
  if (req.user.role === "SUPER_ADMIN") {
    where.role = "SUPER_ADMIN";
    where.id = { [Op.ne]: req.user.id };
  } else if (req.user.role === "MUNI_ADMIN") {
    where.role = "MUNI_ADMIN";
    where.municipality_id = req.user.municipality_id;
    where.id = { [Op.ne]: req.user.id };
  } else {
    return [];
  }
  const users = await User.findAll({
    where,
    attributes: ["id", "username", "name", "role", "job_title"],
    order: [["name", "ASC"], ["username", "ASC"]],
  });
  return mapUsersForMailPicker(users);
}

async function assertValidatorIds(req, validatorUserIds) {
  const ids = [...new Set(validatorUserIds.map((x) => Number(x)).filter(Boolean))];
  if (!ids.length) {
    const err = new Error("validator_user_ids is required");
    err.status = 400;
    throw err;
  }
  const candidates = await listValidatorCandidates(req);
  const allowed = new Set(candidates.map((c) => Number(c.id)));
  for (const id of ids) {
    if (!allowed.has(id)) {
      const err = new Error("Invalid validator_user_ids");
      err.status = 400;
      throw err;
    }
  }
  return ids;
}

async function resolveAdminRecipients(target) {
  const superAdmins = await User.findAll({ where: { role: "SUPER_ADMIN" }, attributes: ["id"] });
  const superAdminIds = superAdmins.map((u) => Number(u.id));

  if (target.type === "ALL_COMMUNES") {
    const muniUsers = await User.findAll({ where: { role: "MUNI_ADMIN" }, attributes: ["id", "municipality_id"] });
    return [
      ...superAdminIds.map((id) => ({ user_id: id, recipient_kind: "DIRECT_USER", recipient_municipality_id: null })),
      ...muniUsers.map((u) => ({
        user_id: Number(u.id),
        recipient_kind: "ALL_MUNICIPALITIES",
        recipient_municipality_id: u.municipality_id || null,
      })),
    ];
  }
  if (target.type === "COMMUNES") {
    const ids = Array.isArray(target.municipality_ids) ? target.municipality_ids.map((x) => Number(x)).filter(Boolean) : [];
    const muniUsers = await User.findAll({
      where: { municipality_id: { [Op.in]: ids } },
      attributes: ["id", "municipality_id"],
    });
    return [
      ...superAdminIds.map((id) => ({ user_id: id, recipient_kind: "DIRECT_USER", recipient_municipality_id: null })),
      ...muniUsers.map((u) => ({
        user_id: Number(u.id),
        recipient_kind: "MUNICIPALITY_TARGET",
        recipient_municipality_id: u.municipality_id || null,
      })),
    ];
  }
  if (target.type === "USERS") {
    const ids = Array.isArray(target.user_ids) ? target.user_ids.map((x) => Number(x)).filter(Boolean) : [];
    const users = await User.findAll({ where: { id: { [Op.in]: ids } }, attributes: ["id", "municipality_id", "role"] });
    return [
      ...superAdminIds.map((id) => ({ user_id: id, recipient_kind: "DIRECT_USER", recipient_municipality_id: null })),
      ...users.map((u) => ({
        user_id: Number(u.id),
        recipient_kind: "DIRECT_USER",
        recipient_municipality_id: u.municipality_id || null,
      })),
    ];
  }
  const err = new Error("Unsupported target.type");
  err.status = 400;
  throw err;
}

async function resolveMuniRecipients(target) {
  let adminIds = [];
  if (target.type === "ALL_WILAYA_ADMINS") {
    const admins = await User.findAll({ where: { role: "SUPER_ADMIN" }, attributes: ["id"] });
    adminIds = admins.map((u) => Number(u.id));
  } else if (target.type === "WILAYA_ADMINS") {
    adminIds = Array.isArray(target.user_ids) ? target.user_ids.map((x) => Number(x)).filter(Boolean) : [];
    const count = await User.count({ where: { id: adminIds, role: "SUPER_ADMIN" } });
    if (count !== adminIds.length) {
      const err = new Error("Invalid user_ids");
      err.status = 400;
      throw err;
    }
  } else {
    const err = new Error("Invalid target");
    err.status = 400;
    throw err;
  }
  return adminIds.map((id) => ({
    user_id: id,
    recipient_kind: "DIRECT_USER",
    recipient_municipality_id: null,
  }));
}

async function saveDraftAttachments(sendRequestId, files, req, transaction) {
  const now = new Date();
  for (const f of files || []) {
    const rel = `mail/${f.filename}`.replace(/\\/g, "/");
    await MailSendRequestAttachment.create(
      {
        send_request_id: sendRequestId,
        filename: String(f.originalname || "file").slice(0, 1024),
        mime_type: String(f.mimetype || "application/octet-stream").slice(0, 255),
        size_bytes: Number(f.size || 0),
        file_url: publicFileUrl(rel),
        created_at: now,
      },
      { transaction },
    );
  }
}

async function createSendRequest(req, { subject, body_html, target, validatorUserIds, attachments }) {
  const ids = await assertValidatorIds(req, validatorUserIds);
  const now = new Date();

  return sequelize.transaction(async (transaction) => {
    const row = await MailSendRequest.create(
      {
        created_by_user_id: req.user.id,
        created_by_municipality_id: req.user.role === "MUNI_ADMIN" ? req.user.municipality_id : null,
        subject,
        body_html,
        target_json: target,
        status: "PENDING_VALIDATION",
        revision: 1,
        created_at: now,
        updated_at: now,
      },
      { transaction },
    );

    for (const vid of ids) {
      await MailSendRequestValidator.create(
        {
          send_request_id: row.id,
          validator_user_id: vid,
          decision: "PENDING",
          created_at: now,
        },
        { transaction },
      );
    }

    await saveDraftAttachments(row.id, attachments, req, transaction);

    await audit(
      req.user.id,
      "MAIL_SEND_REQUEST_CREATE",
      { send_request_id: row.id, validator_ids: ids, subject },
      { req, transaction },
    );

    return row;
  });
}

async function loadSendRequestForUser(req, sendRequestId) {
  const row = await MailSendRequest.findByPk(sendRequestId, {
    include: [
      { model: User, as: "createdByUser", attributes: ["id", "username", "name", "role"] },
      {
        model: MailSendRequestValidator,
        as: "validators",
        include: [{ model: User, as: "validatorUser", attributes: ["id", "username", "name", "role"] }],
      },
      {
        model: MailSendRequestDiscussion,
        as: "discussion",
        include: [{ model: User, as: "authorUser", attributes: ["id", "username", "name", "role"] }],
        separate: true,
        order: [["created_at", "ASC"]],
      },
      { model: MailSendRequestAttachment, as: "attachments" },
    ],
  });
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const isAuthor = Number(row.created_by_user_id) === Number(req.user.id);
  const isValidator = (row.validators || []).some((v) => Number(v.validator_user_id) === Number(req.user.id));
  if (!isAuthor && !isValidator) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  return { row, isAuthor, isValidator };
}

function summarizeValidators(validators) {
  const list = validators || [];
  const approved = list.filter((v) => v.decision === "APPROVED").length;
  const rejected = list.filter((v) => v.decision === "REJECTED").length;
  const pending = list.filter((v) => v.decision === "PENDING").length;
  return { total: list.length, approved, rejected, pending };
}

function serializeSendRequest(row, { isAuthor, isValidator }) {
  const summary = summarizeValidators(row.validators);
  return {
    id: row.id,
    subject: row.subject,
    body_html: row.body_html,
    target: row.target_json,
    status: row.status,
    revision: row.revision,
    thread_id: row.thread_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sent_at: row.sent_at,
    created_by: row.createdByUser
      ? { id: row.createdByUser.id, username: row.createdByUser.username, name: row.createdByUser.name, role: row.createdByUser.role }
      : null,
    validators: (row.validators || []).map((v) => ({
      id: v.id,
      validator_user_id: v.validator_user_id,
      decision: v.decision,
      feedback_html: v.feedback_html,
      decided_at: v.decided_at,
      user: v.validatorUser
        ? { id: v.validatorUser.id, username: v.validatorUser.username, name: v.validatorUser.name, role: v.validatorUser.role }
        : null,
    })),
    validator_summary: summary,
    discussion: (row.discussion || []).map((d) => ({
      id: d.id,
      body_html: d.body_html,
      created_at: d.created_at,
      author: d.authorUser
        ? { id: d.authorUser.id, username: d.authorUser.username, name: d.authorUser.name, role: d.authorUser.role }
        : null,
    })),
    attachments: (row.attachments || []).map((a) => ({
      id: a.id,
      filename: a.filename,
      mime_type: a.mime_type,
      size_bytes: a.size_bytes,
      file_url: a.file_url,
    })),
    my_role: isAuthor ? (isValidator ? "author_and_validator" : "author") : "validator",
  };
}

async function listSendRequests(req, { view, status, page, pageSize, q }) {
  const offset = (page - 1) * pageSize;
  const search = String(q || "").trim();

  let sendRequestIds = null;
  if (view === "author") {
    const rows = await MailSendRequest.findAll({
      where: {
        created_by_user_id: req.user.id,
        ...(status ? { status } : {}),
        ...(search ? { subject: { [Op.iLike]: `%${search}%` } } : {}),
      },
      attributes: ["id"],
      order: [["updated_at", "DESC"]],
    });
    sendRequestIds = rows.map((r) => r.id);
  } else {
    const vals = await MailSendRequestValidator.findAll({
      where: { validator_user_id: req.user.id },
      attributes: ["send_request_id"],
    });
    const ids = [...new Set(vals.map((v) => Number(v.send_request_id)))];
    if (!ids.length) return { rows: [], total: 0, page, pageSize };
    const rows = await MailSendRequest.findAll({
      where: {
        id: { [Op.in]: ids },
        ...(status ? { status } : {}),
        ...(search ? { subject: { [Op.iLike]: `%${search}%` } } : {}),
      },
      attributes: ["id"],
      order: [["updated_at", "DESC"]],
    });
    sendRequestIds = rows.map((r) => r.id);
  }

  const total = sendRequestIds.length;
  const pageIds = sendRequestIds.slice(offset, offset + pageSize);
  if (!pageIds.length) return { rows: [], total, page, pageSize };

  const items = await MailSendRequest.findAll({
    where: { id: { [Op.in]: pageIds } },
    include: [
      { model: User, as: "createdByUser", attributes: ["id", "username", "name", "role"] },
      {
        model: MailSendRequestValidator,
        as: "validators",
        include: [{ model: User, as: "validatorUser", attributes: ["id", "username", "name"] }],
      },
    ],
    order: [["updated_at", "DESC"]],
  });

  const orderMap = new Map(pageIds.map((id, i) => [id, i]));
  items.sort((a, b) => orderMap.get(Number(a.id)) - orderMap.get(Number(b.id)));

  const rows = items.map((row) => {
    const summary = summarizeValidators(row.validators);
    const myValidator = (row.validators || []).find((v) => Number(v.validator_user_id) === Number(req.user.id));
    return {
      id: row.id,
      subject: row.subject,
      status: row.status,
      revision: row.revision,
      thread_id: row.thread_id,
      updated_at: row.updated_at,
      created_by: row.createdByUser
        ? { id: row.createdByUser.id, username: row.createdByUser.username, name: row.createdByUser.name }
        : null,
      validator_summary: summary,
      my_validator_decision: myValidator ? myValidator.decision : null,
      is_author: Number(row.created_by_user_id) === Number(req.user.id),
    };
  });

  return { rows, total, page, pageSize };
}

async function finalizeSendRequest(req, sendRequestId, { withoutValidation }) {
  const { row, isAuthor, isValidator } = await loadSendRequestForUser(req, sendRequestId);
  if (withoutValidation) {
    if (!isAuthor) {
      const err = new Error("Forbidden");
      err.status = 403;
      throw err;
    }
  } else if (!isAuthor && !isValidator) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  if (row.thread_id) {
    const err = new Error("Already sent");
    err.status = 400;
    throw err;
  }
  if (!withoutValidation) {
    const allApproved = (row.validators || []).every((v) => v.decision === "APPROVED");
    if (!allApproved) {
      const err = new Error("Not all validators approved");
      err.status = 400;
      throw err;
    }
  } else if (!["PENDING_VALIDATION", "CHANGES_REQUESTED"].includes(row.status)) {
    const err = new Error("Cannot force send in current status");
    err.status = 400;
    throw err;
  }

  const target = row.target_json;
  const authorRole = row.createdByUser?.role;
  let recipients;
  if (authorRole === "SUPER_ADMIN") {
    recipients = await resolveAdminRecipients(target);
  } else {
    const adminRecips = await resolveMuniRecipients(target);
    recipients = [
      ...adminRecips,
      {
        user_id: Number(row.created_by_user_id),
        recipient_kind: "DIRECT_USER",
        recipient_municipality_id: row.created_by_municipality_id || null,
      },
    ];
  }

  const draftAttachments = await MailSendRequestAttachment.findAll({ where: { send_request_id: row.id } });
  const pseudoFiles = draftAttachments.map((a) => {
    const rel = String(a.file_url || "").replace(/^\/files\//, "");
    const stored = rel.split("/").pop() || "file";
    return {
      originalname: a.filename,
      mimetype: a.mime_type,
      size: a.size_bytes,
      filename: stored,
    };
  });

  const outcome = withoutValidation ? "SENT_WITHOUT_VALIDATION" : "VALIDATED";
  const status = withoutValidation ? "SENT_WITHOUT_VALIDATION" : "SENT";

  const { thread, msg } = await createThreadWithRecipients({
    req,
    subject: row.subject,
    body_html: row.body_html,
    recipients,
    attachments: pseudoFiles.length ? pseudoFiles : undefined,
    author_user_id: row.created_by_user_id,
    author_municipality_id: row.created_by_municipality_id,
  });

  const now = new Date();
  await thread.update({ send_request_id: row.id, validation_outcome: outcome });
  await row.update({ status, thread_id: thread.id, sent_at: now, updated_at: now });

  const auditType = withoutValidation ? "MAIL_SEND_REQUEST_FORCE_SEND" : "MAIL_THREAD_CREATE";
  await audit(req.user.id, auditType, {
    send_request_id: row.id,
    thread_id: thread.id,
    validation_outcome: outcome,
  }, { req });

  return { thread, sendRequest: row, finalized: true };
}

async function approveSendRequest(req, sendRequestId) {
  const { row, isValidator } = await loadSendRequestForUser(req, sendRequestId);
  if (!isValidator) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  if (row.thread_id || ["SENT", "SENT_WITHOUT_VALIDATION"].includes(row.status)) {
    const err = new Error("Already sent");
    err.status = 400;
    throw err;
  }

  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    const v = await MailSendRequestValidator.findOne({
      where: { send_request_id: sendRequestId, validator_user_id: req.user.id },
      transaction,
    });
    if (!v) throw Object.assign(new Error("Forbidden"), { status: 403 });
    await v.update({ decision: "APPROVED", feedback_html: null, decided_at: now }, { transaction });
    await row.update({ updated_at: now, status: "PENDING_VALIDATION" }, { transaction });
    await audit(req.user.id, "MAIL_SEND_REQUEST_APPROVE", { send_request_id: sendRequestId }, { req, transaction });
  });

  const refreshed = await MailSendRequest.findByPk(sendRequestId, {
    include: [{ model: MailSendRequestValidator, as: "validators" }],
  });
  const allApproved = (refreshed.validators || []).every((v) => v.decision === "APPROVED");
  if (allApproved) {
    return finalizeSendRequest(req, sendRequestId, { withoutValidation: false });
  }
  return { finalized: false };
}

async function rejectSendRequest(req, sendRequestId, feedback_html) {
  const { row, isValidator } = await loadSendRequestForUser(req, sendRequestId);
  if (!isValidator) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  if (row.thread_id) {
    const err = new Error("Already sent");
    err.status = 400;
    throw err;
  }
  const feedback = String(feedback_html || "").trim();
  if (!feedback) {
    const err = new Error("feedback_html is required");
    err.status = 400;
    throw err;
  }

  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    const v = await MailSendRequestValidator.findOne({
      where: { send_request_id: sendRequestId, validator_user_id: req.user.id },
      transaction,
    });
    await v.update({ decision: "REJECTED", feedback_html: feedback, decided_at: now }, { transaction });
    await row.update({ status: "CHANGES_REQUESTED", updated_at: now }, { transaction });
    await audit(
      req.user.id,
      "MAIL_SEND_REQUEST_REJECT",
      { send_request_id: sendRequestId },
      { req, transaction },
    );
  });
  return { ok: true };
}

function htmlHasText(html) {
  const s = String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return s.length > 0;
}

async function resubmitSendRequest(req, sendRequestId, { subject, body_html, attachments }) {
  const { row, isAuthor } = await loadSendRequestForUser(req, sendRequestId);
  if (!isAuthor) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  if (row.thread_id) {
    const err = new Error("Already sent");
    err.status = 400;
    throw err;
  }
  if (!["PENDING_VALIDATION", "CHANGES_REQUESTED"].includes(row.status)) {
    const err = new Error("Cannot edit in current status");
    err.status = 400;
    throw err;
  }

  const nextSubject = subject != null ? String(subject).trim().slice(0, 500) : row.subject;
  const nextBody = body_html != null ? String(body_html).trim() : row.body_html;
  if (!nextSubject) {
    const err = new Error("subject is required");
    err.status = 400;
    throw err;
  }
  if (!htmlHasText(nextBody)) {
    const err = new Error("body_html is required");
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const nextRevision = Number(row.revision || 1) + 1;
  return sequelize.transaction(async (transaction) => {
    await row.update(
      {
        subject: nextSubject,
        body_html: nextBody,
        status: "PENDING_VALIDATION",
        revision: nextRevision,
        updated_at: now,
      },
      { transaction },
    );

    await MailSendRequestValidator.update(
      { decision: "PENDING", feedback_html: null, decided_at: null },
      { where: { send_request_id: sendRequestId }, transaction },
    );

    if (attachments?.length) {
      await saveDraftAttachments(sendRequestId, attachments, req, transaction);
    }

    await audit(
      req.user.id,
      "MAIL_SEND_REQUEST_RESUBMIT",
      { send_request_id: sendRequestId, revision: nextRevision, validators_reset: true },
      { req, transaction },
    );

    await row.reload({ transaction });
    return row;
  });
}

async function addDiscussion(req, sendRequestId, body_html) {
  const body = String(body_html || "").trim();
  if (!body) {
    const err = new Error("body_html is required");
    err.status = 400;
    throw err;
  }
  await loadSendRequestForUser(req, sendRequestId);
  const now = new Date();
  const msg = await MailSendRequestDiscussion.create({
    send_request_id: sendRequestId,
    author_user_id: req.user.id,
    body_html: body,
    created_at: now,
  });
  await audit(req.user.id, "MAIL_SEND_REQUEST_DISCUSSION", { send_request_id: sendRequestId }, { req });
  return msg;
}

async function pendingValidationCount(req) {
  const asAuthor = await MailSendRequest.count({
    where: {
      created_by_user_id: req.user.id,
      status: { [Op.in]: ["PENDING_VALIDATION", "CHANGES_REQUESTED"] },
    },
  });
  const validatorRows = await MailSendRequestValidator.findAll({
    where: { validator_user_id: req.user.id, decision: "PENDING" },
    attributes: ["send_request_id"],
  });
  const ids = [...new Set(validatorRows.map((v) => Number(v.send_request_id)))];
  let asValidator = 0;
  if (ids.length) {
    asValidator = await MailSendRequest.count({
      where: {
        id: { [Op.in]: ids },
        status: { [Op.in]: ["PENDING_VALIDATION", "CHANGES_REQUESTED"] },
      },
    });
  }
  return { as_author: asAuthor, as_validator: asValidator, total: asAuthor + asValidator };
}

module.exports = {
  listValidatorCandidates,
  assertValidatorIds,
  createSendRequest,
  loadSendRequestForUser,
  serializeSendRequest,
  listSendRequests,
  finalizeSendRequest,
  approveSendRequest,
  rejectSendRequest,
  resubmitSendRequest,
  addDiscussion,
  pendingValidationCount,
};
