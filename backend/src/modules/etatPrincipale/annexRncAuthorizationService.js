const { Municipality, MunicipalityAnnex, AnnexRncAuthorization, User } = require("../../db");
const {
  filterWilayaByMunicipality,
  parseMunicipalityIdFilter,
  bodyWithoutWilayaTransmission
} = require("./wilayaPayloadFilter");
const { sortMunicipalitiesByCode, getMunicipalityIdForUser, httpError } = require("../operations/operationService");

const MAX_LINES_PER_MUNICIPALITY = 50;
const RNC_STATUSES = new Set(["none", "pending", "approved", "rejected"]);

function trimText(v, max) {
  if (v == null || String(v).trim() === "") return null;
  return String(v).trim().slice(0, max);
}

function linePayload(plain, annex) {
  return {
    id: Number(plain.id),
    municipality_annex_id: Number(plain.municipality_annex_id),
    annex_name: annex?.name ?? null,
    ip_authorized: plain.ip_authorized,
    authorization_year: plain.authorization_year,
    authorized_ip_count: plain.authorized_ip_count,
    pc_used: plain.pc_used,
    ip_requested: plain.ip_requested,
    rnc_auth_status: String(plain.rnc_auth_status || "none"),
    rnc_auth_requested_at: plain.rnc_auth_requested_at,
    submitted_at: plain.submitted_at,
    updated_at: plain.updated_at,
    display_order: Number(plain.display_order ?? 0)
  };
}

function normalizeMuniInput(entry) {
  const annexId = entry.municipality_annex_id != null && entry.municipality_annex_id !== ""
    ? Number(entry.municipality_annex_id)
    : NaN;
  return {
    municipality_annex_id: Number.isFinite(annexId) && annexId > 0 ? annexId : null,
    pc_used: trimText(entry.pc_used, 500),
    ip_requested: trimText(entry.ip_requested, 500)
  };
}

function normalizeWilayaInput(entry, existingRow) {
  const base = normalizeMuniInput(entry);
  const out = { ...base };
  if (Object.prototype.hasOwnProperty.call(entry, "ip_authorized")) {
    out.ip_authorized = trimText(entry.ip_authorized, 500);
  } else if (existingRow) {
    out.ip_authorized = existingRow.ip_authorized;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "authorization_year")) {
    out.authorization_year = trimText(entry.authorization_year, 20);
  } else if (existingRow) {
    out.authorization_year = existingRow.authorization_year;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "authorized_ip_count")) {
    out.authorized_ip_count = trimText(entry.authorized_ip_count, 50);
  } else if (existingRow) {
    out.authorized_ip_count = existingRow.authorized_ip_count;
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
    for (const row of b.lines || []) {
      if (row.rnc_auth_status === "pending") pendingRnc += 1;
      if (row.rnc_auth_status === "approved") approvedRnc += 1;
    }
  }
  return { rnc_pending: pendingRnc, rnc_approved: approvedRnc };
}

async function annexMapForMunicipality(municipalityId) {
  const annexes = await MunicipalityAnnex.findAll({
    where: { municipality_id: municipalityId },
    order: [["name", "ASC"], ["id", "ASC"]],
    attributes: ["id", "name"]
  });
  return new Map(annexes.map((a) => [Number(a.id), a.get({ plain: true })]));
}

async function assertAnnexBelongsToMunicipality(annexId, municipalityId) {
  const annex = await MunicipalityAnnex.findByPk(annexId);
  if (!annex) throw httpError(400, "Unknown annex");
  if (Number(annex.municipality_id) !== Number(municipalityId)) {
    throw httpError(403, "Annex does not belong to this municipality");
  }
  return annex;
}

async function loadRowsWithAnnex(municipalityId) {
  const rows = await AnnexRncAuthorization.findAll({
    where: { municipality_id: municipalityId },
    include: [{ model: MunicipalityAnnex, as: "annex", attributes: ["id", "name"] }],
    order: [
      ["display_order", "ASC"],
      ["id", "ASC"]
    ]
  });
  return rows.map((r) => {
    const plain = r.get({ plain: true });
    const annex = plain.annex;
    return linePayload(plain, annex);
  });
}

async function listWilaya() {
  const all = await Municipality.findAll();
  const sorted = sortMunicipalitiesByCode(all);
  const municipalities = [];
  for (const m of sorted) {
    const lines = await loadRowsWithAnnex(m.id);
    const plainRows = await AnnexRncAuthorization.findAll({
      where: { municipality_id: m.id },
      attributes: ["submitted_at"]
    });
    const hasSubmitted = plainRows.some((p) => p.submitted_at != null);
    municipalities.push({
      municipality: { id: m.id, code: m.code, name_ar: m.name_ar, name_fr: m.name_fr },
      lines,
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
  const annexes = await MunicipalityAnnex.findAll({
    where: { municipality_id: municipalityId },
    order: [["name", "ASC"], ["id", "ASC"]],
    attributes: ["id", "name"]
  });
  const lines = await loadRowsWithAnnex(municipalityId);
  const plainRows = await AnnexRncAuthorization.findAll({
    where: { municipality_id: municipalityId },
    attributes: ["submitted_at"]
  });
  const submittedAt = plainRows.find((p) => p.submitted_at != null)?.submitted_at ?? null;
  return {
    municipality_id: municipalityId,
    municipality: muni ? muni.get({ plain: true }) : null,
    annexes: annexes.map((a) => a.get({ plain: true })),
    lines,
    submitted_at: submittedAt
  };
}

async function syncLinesForMunicipality(municipalityId, lines, editorUserId, submit, { wilayaMode }) {
  if (!Array.isArray(lines)) throw httpError(400, "lines must be an array");
  if (lines.length > MAX_LINES_PER_MUNICIPALITY) {
    throw httpError(400, `At most ${MAX_LINES_PER_MUNICIPALITY} lines per municipality`);
  }

  const t = await AnnexRncAuthorization.sequelize.transaction();
  try {
    const existing = await AnnexRncAuthorization.findAll({
      where: { municipality_id: municipalityId },
      transaction: t
    });
    const byId = new Map(existing.map((r) => [Number(r.id), r]));
    const keepIds = new Set();
    const now = new Date();

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] || {};
      const id = raw.id != null && raw.id !== "" ? Number(raw.id) : NaN;
      const existingRow = Number.isFinite(id) && id > 0 ? byId.get(id) : null;

      let fields;
      if (wilayaMode) {
        fields = normalizeWilayaInput(raw, existingRow);
      } else {
        fields = normalizeMuniInput(raw);
        if (existingRow) {
          fields.ip_authorized = existingRow.ip_authorized;
          fields.authorization_year = existingRow.authorization_year;
          fields.authorized_ip_count = existingRow.authorized_ip_count;
          fields.rnc_auth_status = existingRow.rnc_auth_status;
          fields.rnc_auth_requested_at = existingRow.rnc_auth_requested_at;
        } else {
          fields.ip_authorized = null;
          fields.authorization_year = null;
          fields.authorized_ip_count = null;
          fields.rnc_auth_status = "none";
          fields.rnc_auth_requested_at = null;
        }
      }

      if (!fields.municipality_annex_id) {
        throw httpError(400, "Annex is required for each line");
      }
      await assertAnnexBelongsToMunicipality(fields.municipality_annex_id, municipalityId);

      if (wilayaMode && fields.rnc_auth_status === "approved" && !fields.ip_authorized) {
        fields.ip_authorized = trimText(raw.ip_requested, 500) || (existingRow ? existingRow.ip_requested : null);
      }

      if (Number.isFinite(id) && id > 0) {
        const row = byId.get(id);
        if (!row) throw httpError(400, `Unknown line id ${id}`);
        if (Number(row.municipality_id) !== Number(municipalityId)) {
          throw httpError(403, "Line does not belong to this municipality");
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
        const created = await AnnexRncAuthorization.create(
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
      await AnnexRncAuthorization.update(
        { submitted_at: now, updated_by_user_id: editorUserId, updated_at: now },
        { where: { municipality_id: municipalityId }, transaction: t }
      );
    } else if (submit === false) {
      await AnnexRncAuthorization.update(
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
  if (!Array.isArray(body.lines)) throw httpError(400, "lines array required");
  await syncLinesForMunicipality(municipalityId, body.lines, userId, body.submit, { wilayaMode: false });
  return getForMuniUser(userId);
}

async function patchWilayaMunicipality(municipalityId, body, actorUserId) {
  const mid = Number(municipalityId);
  if (!Number.isFinite(mid) || mid <= 0) throw httpError(400, "Invalid municipality id");
  const m = await Municipality.findByPk(mid);
  if (!m) throw httpError(404, "Municipality not found");
  const safeBody = bodyWithoutWilayaTransmission(body);
  if (!Array.isArray(safeBody.lines)) throw httpError(400, "lines array required");
  await syncLinesForMunicipality(mid, safeBody.lines, actorUserId, undefined, { wilayaMode: true });
  return listWilaya();
}

async function requestRncAuthorization(userId, lineId) {
  const municipalityId = await getMunicipalityIdForUser(userId);
  const id = Number(lineId);
  if (!Number.isFinite(id) || id <= 0) throw httpError(400, "Invalid line id");

  const row = await AnnexRncAuthorization.findByPk(id, {
    include: [
      { model: Municipality, as: "municipality", attributes: ["id", "code", "name_ar", "name_fr"] },
      { model: MunicipalityAnnex, as: "annex", attributes: ["id", "name"] }
    ]
  });
  if (!row) throw httpError(404, "Line not found");
  if (Number(row.municipality_id) !== Number(municipalityId)) {
    throw httpError(403, "Line does not belong to your municipality");
  }

  const ipReq = trimText(row.ip_requested, 500);
  if (!ipReq) throw httpError(400, "Requested IP is required before requesting authorization");

  const st = String(row.rnc_auth_status || "none");
  if (st === "pending") throw httpError(400, "Authorization request already pending");
  if (st === "approved") throw httpError(400, "IP already authorized");

  const now = new Date();
  await row.update({
    rnc_auth_status: "pending",
    rnc_auth_requested_at: now,
    updated_by_user_id: userId,
    updated_at: now
  });

  const plain = row.get({ plain: true });
  const muni = row.municipality ? row.municipality.get({ plain: true }) : await Municipality.findByPk(municipalityId);
  const requester = await User.findByPk(userId, { attributes: ["id", "username", "name"] });

  return {
    line: linePayload(plain, plain.annex),
    municipality: muni,
    requester: requester ? requester.get({ plain: true }) : null
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
