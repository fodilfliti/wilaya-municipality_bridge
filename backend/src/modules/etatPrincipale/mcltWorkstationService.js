const { Municipality, McltWorkstation, User } = require("../../db");
const { sortMunicipalitiesByCode, getMunicipalityIdForUser, httpError } = require("../operations/operationService");
const {
  filterWilayaByMunicipality,
  parseMunicipalityIdFilter,
  bodyWithoutWilayaTransmission
} = require("./wilayaPayloadFilter");

const MAX_LINES_PER_MUNICIPALITY = 50;
const RNC_STATUSES = new Set(["none", "pending", "approved", "rejected"]);

function trimText(v, max) {
  if (v == null || String(v).trim() === "") return null;
  return String(v).trim().slice(0, max);
}

function workstationPayload(plain) {
  return {
    id: Number(plain.id),
    ip_mclt: plain.ip_mclt,
    pc_usage: plain.pc_usage,
    installed_application: plain.installed_application,
    windows_version: plain.windows_version,
    pc_name: plain.pc_name,
    antivirus_name: plain.antivirus_name,
    ip_rnc_authorized: plain.ip_rnc_authorized,
    ip_rnc_requested: plain.ip_rnc_requested,
    rnc_auth_status: String(plain.rnc_auth_status || "none"),
    rnc_auth_requested_at: plain.rnc_auth_requested_at,
    submitted_at: plain.submitted_at,
    updated_at: plain.updated_at,
    display_order: Number(plain.display_order ?? 0)
  };
}

function normalizeMuniInput(entry) {
  const out = {
    ip_mclt: trimText(entry.ip_mclt, 500),
    pc_usage: trimText(entry.pc_usage, 500),
    installed_application: trimText(entry.installed_application, 500),
    windows_version: trimText(entry.windows_version, 100),
    pc_name: trimText(entry.pc_name, 255),
    antivirus_name: trimText(entry.antivirus_name, 500)
  };
  if (Object.prototype.hasOwnProperty.call(entry, "ip_rnc_requested")) {
    out.ip_rnc_requested = trimText(entry.ip_rnc_requested, 500);
  }
  return out;
}

function normalizeWilayaInput(entry, existingRow) {
  const base = normalizeMuniInput(entry);
  const out = { ...base };
  if (Object.prototype.hasOwnProperty.call(entry, "ip_rnc_authorized")) {
    out.ip_rnc_authorized = trimText(entry.ip_rnc_authorized, 500);
  } else if (existingRow) {
    out.ip_rnc_authorized = existingRow.ip_rnc_authorized;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "ip_rnc_requested")) {
    out.ip_rnc_requested = trimText(entry.ip_rnc_requested, 500);
  } else if (existingRow) {
    out.ip_rnc_requested = existingRow.ip_rnc_requested;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "rnc_auth_status")) {
    const st = String(entry.rnc_auth_status || "none").toLowerCase();
    if (!RNC_STATUSES.has(st)) throw httpError(400, "Invalid rnc_auth_status");
    out.rnc_auth_status = st;
  } else if (existingRow) {
    out.rnc_auth_status = existingRow.rnc_auth_status;
  } else {
    out.rnc_auth_status = "none";
  }
  return out;
}

function computeAnalytics(blocks) {
  let pendingRnc = 0;
  let approvedRnc = 0;
  for (const b of blocks) {
    for (const w of b.workstations || []) {
      if (w.rnc_auth_status === "pending") pendingRnc += 1;
      if (w.rnc_auth_status === "approved") approvedRnc += 1;
    }
  }
  return { rnc_pending: pendingRnc, rnc_approved: approvedRnc };
}

async function listWilaya() {
  const all = await Municipality.findAll();
  const sorted = sortMunicipalitiesByCode(all);
  const municipalities = [];
  for (const m of sorted) {
    const rows = await McltWorkstation.findAll({
      where: { municipality_id: m.id },
      order: [
        ["display_order", "ASC"],
        ["id", "ASC"]
      ]
    });
    const plainRows = rows.map((r) => r.get({ plain: true }));
    const workstations = plainRows.map(workstationPayload);
    const hasSubmitted = plainRows.some((p) => p.submitted_at != null);
    municipalities.push({
      municipality: { id: m.id, code: m.code, name_ar: m.name_ar, name_fr: m.name_fr },
      workstations,
      has_submitted: hasSubmitted
    });
  }
  const total = municipalities.length;
  const submitted = municipalities.filter((x) => x.has_submitted).length;
  return {
    municipalities,
    submission: { total, submitted, pending: total - submitted },
    analytics: computeAnalytics(municipalities)
  };
}

async function getForMuniUser(userId) {
  const municipalityId = await getMunicipalityIdForUser(userId);
  const muni = await Municipality.findByPk(municipalityId, {
    attributes: ["id", "code", "name_ar", "name_fr"]
  });
  const rows = await McltWorkstation.findAll({
    where: { municipality_id: municipalityId },
    order: [
      ["display_order", "ASC"],
      ["id", "ASC"]
    ]
  });
  const plainRows = rows.map((r) => r.get({ plain: true }));
  const workstations = plainRows.map(workstationPayload);
  const submittedAt = plainRows.find((p) => p.submitted_at != null)?.submitted_at ?? null;
  return {
    municipality_id: municipalityId,
    municipality: muni ? muni.get({ plain: true }) : null,
    workstations,
    submitted_at: submittedAt
  };
}

async function syncWorkstationsForMunicipality(municipalityId, workstations, editorUserId, submit, { wilayaMode }) {
  if (!Array.isArray(workstations)) throw httpError(400, "workstations must be an array");
  if (workstations.length > MAX_LINES_PER_MUNICIPALITY) {
    throw httpError(400, `At most ${MAX_LINES_PER_MUNICIPALITY} lines per municipality`);
  }

  const t = await McltWorkstation.sequelize.transaction();
  try {
    const existing = await McltWorkstation.findAll({
      where: { municipality_id: municipalityId },
      transaction: t
    });
    const byId = new Map(existing.map((r) => [Number(r.id), r]));
    const keepIds = new Set();
    const now = new Date();

    for (let i = 0; i < workstations.length; i++) {
      const raw = workstations[i] || {};
      const id = raw.id != null && raw.id !== "" ? Number(raw.id) : NaN;
      const existingRow = Number.isFinite(id) && id > 0 ? byId.get(id) : null;

      let fields;
      if (wilayaMode) {
        fields = normalizeWilayaInput(raw, existingRow);
      } else {
        fields = normalizeMuniInput(raw);
        if (existingRow) {
          fields.rnc_auth_status = existingRow.rnc_auth_status;
          fields.ip_rnc_authorized = existingRow.ip_rnc_authorized;
          fields.rnc_auth_requested_at = existingRow.rnc_auth_requested_at;
          if (!Object.prototype.hasOwnProperty.call(raw, "ip_rnc_requested")) {
            fields.ip_rnc_requested = existingRow.ip_rnc_requested;
          }
        } else {
          fields.rnc_auth_status = "none";
          fields.ip_rnc_authorized = null;
          fields.ip_rnc_requested = fields.ip_rnc_requested ?? null;
          fields.rnc_auth_requested_at = null;
        }
      }

      if (Number.isFinite(id) && id > 0) {
        const row = byId.get(id);
        if (!row) throw httpError(400, `Unknown workstation id ${id}`);
        if (Number(row.municipality_id) !== Number(municipalityId)) {
          throw httpError(403, "Workstation does not belong to this municipality");
        }
        if (wilayaMode && fields.rnc_auth_status === "approved" && !fields.ip_rnc_authorized) {
          fields.ip_rnc_authorized =
            trimText(raw.ip_rnc_requested, 500) ||
            row.ip_rnc_requested ||
            trimText(raw.ip_mclt, 500) ||
            row.ip_mclt;
        }
        await row.update(
          {
            ...fields,
            display_order: i,
            updated_by_user_id: editorUserId,
            updated_at: now
          },
          { transaction: t }
        );
        keepIds.add(id);
      } else {
        const created = await McltWorkstation.create(
          {
            municipality_id: municipalityId,
            display_order: i,
            ...fields,
            rnc_auth_status: fields.rnc_auth_status || "none",
            updated_by_user_id: editorUserId,
            updated_at: now
          },
          { transaction: t }
        );
        keepIds.add(Number(created.id));
      }
    }

    for (const r of existing) {
      if (!keepIds.has(Number(r.id))) await r.destroy({ transaction: t });
    }

    if (submit === true) {
      await McltWorkstation.update(
        { submitted_at: now, updated_by_user_id: editorUserId, updated_at: now },
        { where: { municipality_id: municipalityId }, transaction: t }
      );
    } else if (submit === false) {
      await McltWorkstation.update(
        { submitted_at: null, updated_by_user_id: editorUserId, updated_at: now },
        { where: { municipality_id: municipalityId }, transaction: t }
      );
    }

    await t.commit();
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function patchForMuniUser(userId, body) {
  const municipalityId = await getMunicipalityIdForUser(userId);
  if (!Array.isArray(body.workstations)) throw httpError(400, "workstations array required");
  await syncWorkstationsForMunicipality(municipalityId, body.workstations, userId, body.submit, {
    wilayaMode: false
  });
  return getForMuniUser(userId);
}

async function patchWilayaMunicipality(municipalityId, body, actorUserId) {
  const mid = Number(municipalityId);
  if (!Number.isFinite(mid) || mid <= 0) throw httpError(400, "Invalid municipality id");
  const m = await Municipality.findByPk(mid);
  if (!m) throw httpError(404, "Municipality not found");
  const safeBody = bodyWithoutWilayaTransmission(body);
  if (!Array.isArray(safeBody.workstations)) throw httpError(400, "workstations array required");
  await syncWorkstationsForMunicipality(mid, safeBody.workstations, actorUserId, undefined, {
    wilayaMode: true
  });
  return listWilaya();
}

async function requestRncAuthorization(userId, workstationId, body = {}) {
  const municipalityId = await getMunicipalityIdForUser(userId);
  const id = Number(workstationId);
  if (!Number.isFinite(id) || id <= 0) throw httpError(400, "Invalid workstation id");

  const row = await McltWorkstation.findByPk(id, {
    include: [{ model: Municipality, as: "municipality", attributes: ["id", "code", "name_ar", "name_fr"] }]
  });
  if (!row) throw httpError(404, "Workstation not found");
  if (Number(row.municipality_id) !== Number(municipalityId)) {
    throw httpError(403, "Workstation does not belong to your municipality");
  }

  const st = String(row.rnc_auth_status || "none");
  if (st === "pending") throw httpError(400, "Authorization request already pending");
  if (st === "approved") throw httpError(400, "IP already authorized");

  const modeRaw = String(body.request_mode || body.mode || "").toLowerCase();
  const isGeneric =
    body.generic === true || modeRaw === "generic" || modeRaw === "any" || modeRaw === "one";
  const isSpecific = modeRaw === "specific" || modeRaw === "precise" || body.generic === false;

  let ipRncRequested = null;
  if (isSpecific || (!isGeneric && trimText(body.ip_rnc_requested, 500))) {
    ipRncRequested =
      trimText(body.ip_rnc_requested, 500) ||
      trimText(row.ip_rnc_requested, 500) ||
      trimText(body.ip_mclt, 500);
    if (!ipRncRequested) {
      throw httpError(400, "Specific IP is required for this authorization request");
    }
  } else if (isGeneric) {
    ipRncRequested = null;
  } else if (trimText(row.ip_rnc_requested, 500)) {
    ipRncRequested = trimText(row.ip_rnc_requested, 500);
  } else {
    ipRncRequested = null;
  }

  const now = new Date();
  await row.update({
    ip_rnc_requested: ipRncRequested,
    rnc_auth_status: "pending",
    rnc_auth_requested_at: now,
    updated_by_user_id: userId,
    updated_at: now
  });

  const muni = row.municipality ? row.municipality.get({ plain: true }) : await Municipality.findByPk(municipalityId);
  const requester = await User.findByPk(userId, { attributes: ["id", "username", "name"] });
  const plain = row.get({ plain: true });

  return {
    workstation: workstationPayload(plain),
    municipality: muni,
    requester: requester ? requester.get({ plain: true }) : null,
    request_mode: ipRncRequested ? "specific" : "generic"
  };
}

function applyMunicipalityFilter(payload, municipalityId) {
  return filterWilayaByMunicipality(payload, municipalityId, computeAnalytics);
}

module.exports = {
  listWilaya,
  getForMuniUser,
  patchForMuniUser,
  patchWilayaMunicipality,
  requestRncAuthorization,
  applyMunicipalityFilter,
  parseMunicipalityIdFilter
};
