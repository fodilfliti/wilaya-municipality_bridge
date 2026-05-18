const { Municipality, BackupServerStatus } = require("../../db");
const { sortMunicipalitiesByCode, getMunicipalityIdForUser, httpError } = require("../operations/operationService");
const {
  filterWilayaByMunicipality,
  parseMunicipalityIdFilter,
  bodyWithoutWilayaTransmission
} = require("./wilayaPayloadFilter");

const MAX_SERVERS_PER_MUNICIPALITY = 30;

async function ensureAtLeastOneRow(municipalityId, transaction) {
  const count = await BackupServerStatus.count({
    where: { municipality_id: municipalityId },
    transaction
  });
  if (count > 0) return;
  await BackupServerStatus.create(
    {
      municipality_id: municipalityId,
      display_order: 0,
      existe: false,
      configured: false,
      os_active: false
    },
    { transaction }
  );
}

function statusPayload(plain) {
  return {
    id: Number(plain.id),
    existe: Boolean(plain.existe),
    server_type: plain.server_type,
    configured: Boolean(plain.configured),
    os_type: plain.os_type,
    os_active: Boolean(plain.os_active),
    anomalie: plain.anomalie,
    submitted_at: plain.submitted_at,
    updated_at: plain.updated_at,
    display_order: Number(plain.display_order ?? 0)
  };
}

/** Commune-level booleans for analytics (any server line). */
function aggregateFlagsFromServers(servers) {
  const list = servers || [];
  return {
    existe: list.some((s) => s.existe),
    configured: list.some((s) => s.configured),
    os_active: list.some((s) => s.os_active),
    anomalie_nonempty: list.some((s) => String(s.anomalie || "").trim())
  };
}

function computeAnalytics(blocks) {
  let existeYes = 0;
  let existeNo = 0;
  let confYes = 0;
  let confNo = 0;
  let osYes = 0;
  let osNo = 0;
  let anomaliesNonempty = 0;
  for (const b of blocks) {
    const agg = aggregateFlagsFromServers(b.servers);
    if (agg.existe) existeYes += 1;
    else existeNo += 1;
    if (agg.configured) confYes += 1;
    else confNo += 1;
    if (agg.os_active) osYes += 1;
    else osNo += 1;
    if (agg.anomalie_nonempty) anomaliesNonempty += 1;
  }
  return {
    existe: { yes: existeYes, no: existeNo },
    configured: { yes: confYes, no: confNo },
    os_active: { yes: osYes, no: osNo },
    anomalies_nonempty: anomaliesNonempty
  };
}

async function listWilaya() {
  const all = await Municipality.findAll();
  const sorted = sortMunicipalitiesByCode(all);
  const municipalities = [];
  for (const m of sorted) {
    await ensureAtLeastOneRow(m.id);
    const rows = await BackupServerStatus.findAll({
      where: { municipality_id: m.id },
      order: [
        ["display_order", "ASC"],
        ["id", "ASC"]
      ]
    });
    const plainRows = rows.map((r) => r.get({ plain: true }));
    const servers = plainRows.map(statusPayload);
    const hasSubmitted = plainRows.some((p) => p.submitted_at != null);
    municipalities.push({
      municipality: { id: m.id, code: m.code, name_ar: m.name_ar, name_fr: m.name_fr },
      servers,
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
  await ensureAtLeastOneRow(municipalityId);
  const muni = await Municipality.findByPk(municipalityId, {
    attributes: ["id", "code", "name_ar", "name_fr"]
  });
  const rows = await BackupServerStatus.findAll({
    where: { municipality_id: municipalityId },
    order: [
      ["display_order", "ASC"],
      ["id", "ASC"]
    ]
  });
  const plainRows = rows.map((r) => r.get({ plain: true }));
  const servers = plainRows.map(statusPayload);
  const submittedAt = plainRows.find((p) => p.submitted_at != null)?.submitted_at ?? null;
  return {
    municipality_id: municipalityId,
    municipality: muni ? muni.get({ plain: true }) : null,
    servers,
    submitted_at: submittedAt
  };
}

function buildStatusFieldUpdates(body) {
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(body, "existe")) updates.existe = Boolean(body.existe);
  if (Object.prototype.hasOwnProperty.call(body, "server_type")) {
    updates.server_type =
      body.server_type == null || String(body.server_type).trim() === ""
        ? null
        : String(body.server_type).trim().slice(0, 500);
  }
  if (Object.prototype.hasOwnProperty.call(body, "configured")) updates.configured = Boolean(body.configured);
  if (Object.prototype.hasOwnProperty.call(body, "os_type")) {
    updates.os_type =
      body.os_type == null || String(body.os_type).trim() === "" ? null : String(body.os_type).trim().slice(0, 500);
  }
  if (Object.prototype.hasOwnProperty.call(body, "os_active")) updates.os_active = Boolean(body.os_active);
  if (Object.prototype.hasOwnProperty.call(body, "anomalie")) {
    updates.anomalie =
      body.anomalie == null || String(body.anomalie).trim() === "" ? null : String(body.anomalie).trim().slice(0, 20000);
  }
  if (body.submit === true) updates.submitted_at = new Date();
  if (body.submit === false) updates.submitted_at = null;
  return updates;
}

async function applyBackupStatusUpdatesFirstRow(municipalityId, body, editorUserId) {
  await ensureAtLeastOneRow(municipalityId);
  const row = await BackupServerStatus.findOne({
    where: { municipality_id: municipalityId },
    order: [
      ["display_order", "ASC"],
      ["id", "ASC"]
    ]
  });
  if (!row) return;
  const fieldUpdates = buildStatusFieldUpdates(body);
  if (Object.keys(fieldUpdates).length === 0) return;
  const now = new Date();
  const { submitted_at: _subIgnored, ...rest } = fieldUpdates;
  if (Object.keys(rest).length > 0) {
    await row.update({
      ...rest,
      updated_by_user_id: editorUserId,
      updated_at: now
    });
  }
  if (Object.prototype.hasOwnProperty.call(fieldUpdates, "submitted_at")) {
    await BackupServerStatus.update(
      {
        submitted_at: fieldUpdates.submitted_at,
        updated_by_user_id: editorUserId,
        updated_at: now
      },
      { where: { municipality_id: municipalityId } }
    );
  }
}

function normalizeServerInput(entry) {
  const existe = Boolean(entry.existe);
  const configured = Boolean(entry.configured);
  const os_active = Boolean(entry.os_active);
  const server_type =
    entry.server_type == null || String(entry.server_type).trim() === ""
      ? null
      : String(entry.server_type).trim().slice(0, 500);
  const os_type =
    entry.os_type == null || String(entry.os_type).trim() === "" ? null : String(entry.os_type).trim().slice(0, 500);
  const anomalie =
    entry.anomalie == null || String(entry.anomalie).trim() === "" ? null : String(entry.anomalie).trim().slice(0, 20000);
  return { existe, configured, os_active, server_type, os_type, anomalie };
}

/**
 * Replace all server lines for a municipality with `servers` (ordered).
 * @param {boolean|null} submit - if true, stamp submitted_at on all rows; if false, clear; if undefined, leave unchanged
 */
async function syncServersForMunicipality(municipalityId, servers, editorUserId, submit) {
  if (!Array.isArray(servers)) throw httpError(400, "servers must be an array");
  if (servers.length > MAX_SERVERS_PER_MUNICIPALITY) {
    throw httpError(400, `At most ${MAX_SERVERS_PER_MUNICIPALITY} servers per municipality`);
  }
  if (servers.length === 0) throw httpError(400, "At least one server line is required");

  const t = await BackupServerStatus.sequelize.transaction();
  try {
    const existing = await BackupServerStatus.findAll({
      where: { municipality_id: municipalityId },
      transaction: t
    });
    const byId = new Map(existing.map((r) => [Number(r.id), r]));

    const keepIds = new Set();
    const now = new Date();

    for (let i = 0; i < servers.length; i++) {
      const raw = servers[i] || {};
      const fields = normalizeServerInput(raw);
      const id = raw.id != null && raw.id !== "" ? Number(raw.id) : NaN;
      if (Number.isFinite(id) && id > 0) {
        const row = byId.get(id);
        if (!row) throw httpError(400, `Unknown server id ${id}`);
        if (Number(row.municipality_id) !== Number(municipalityId)) throw httpError(403, "Server does not belong to this municipality");
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
        const created = await BackupServerStatus.create(
          {
            municipality_id: municipalityId,
            display_order: i,
            ...fields,
            updated_by_user_id: editorUserId,
            updated_at: now
          },
          { transaction: t }
        );
        keepIds.add(Number(created.id));
      }
    }

    const toDestroy = existing.filter((r) => !keepIds.has(Number(r.id)));
    for (const r of toDestroy) {
      await r.destroy({ transaction: t });
    }

    await ensureAtLeastOneRow(municipalityId, t);

    if (submit === true) {
      await BackupServerStatus.update(
        { submitted_at: now, updated_by_user_id: editorUserId, updated_at: now },
        { where: { municipality_id: municipalityId }, transaction: t }
      );
    } else if (submit === false) {
      await BackupServerStatus.update(
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
  if (Array.isArray(body.servers)) {
    await syncServersForMunicipality(municipalityId, body.servers, userId, body.submit);
  } else {
    await applyBackupStatusUpdatesFirstRow(municipalityId, body, userId);
  }
  return getForMuniUser(userId);
}

async function patchWilayaMunicipality(municipalityId, body, actorUserId) {
  const mid = Number(municipalityId);
  if (!Number.isFinite(mid) || mid <= 0) throw httpError(400, "Invalid municipality id");
  const m = await Municipality.findByPk(mid);
  if (!m) throw httpError(404, "Municipality not found");
  const safeBody = bodyWithoutWilayaTransmission(body);
  if (Array.isArray(safeBody.servers)) {
    await syncServersForMunicipality(mid, safeBody.servers, actorUserId, undefined);
  } else {
    await applyBackupStatusUpdatesFirstRow(mid, safeBody, actorUserId);
  }
  return listWilaya();
}

function applyMunicipalityFilter(payload, municipalityId) {
  return filterWilayaByMunicipality(payload, municipalityId, computeAnalytics);
}

module.exports = {
  listWilaya,
  getForMuniUser,
  patchForMuniUser,
  patchWilayaMunicipality,
  ensureAtLeastOneRow,
  applyMunicipalityFilter,
  parseMunicipalityIdFilter
};
