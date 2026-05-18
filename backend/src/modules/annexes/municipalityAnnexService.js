const { MunicipalityAnnex, Municipality } = require("../../db");

const ANNEX_STATUSES = [
  "NEW_NOT_YET_ACTIVE",
  "SETUP_IN_PROGRESS",
  "READY_NOT_STARTED",
  "ACTIVE",
  "PAUSED",
  "INACTIVE"
];

/** Stored as TEXT; only these values are accepted by the API for now. */
const ANNEX_VILLE_POSITIONS = ["INSIDE_VILLE", "OUTSIDE_VILLE"];

function isValidStatus(s) {
  return ANNEX_STATUSES.includes(String(s || ""));
}

function isValidVillePosition(s) {
  return ANNEX_VILLE_POSITIONS.includes(String(s || ""));
}

function normalizeVillePosition(raw) {
  if (raw == null || String(raw).trim() === "") return "INSIDE_VILLE";
  const v = String(raw).trim();
  if (v.length > 128) return { error: "ville_position too long" };
  if (!isValidVillePosition(v)) return { error: "Invalid ville_position" };
  return v;
}

function normalizePhones(raw) {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (t.length > 8000) return { error: "phone_numbers too long" };
  return t;
}

function normalizeName(raw) {
  const t = String(raw || "").trim();
  if (!t) return { error: "name is required" };
  if (t.length > 255) return { error: "name too long" };
  return t;
}

function toPublic(row) {
  const j = row.toJSON ? row.toJSON() : row;
  return {
    id: j.id,
    municipality_id: j.municipality_id,
    name: j.name,
    phone_numbers: j.phone_numbers,
    ville_position: j.ville_position,
    status: j.status,
    created_at: j.created_at,
    updated_at: j.updated_at
  };
}

async function listByMunicipalityId(municipalityId) {
  const rows = await MunicipalityAnnex.findAll({
    where: { municipality_id: municipalityId },
    order: [["id", "ASC"]]
  });
  return rows.map(toPublic);
}

async function createForMunicipality(municipalityId, body) {
  const muni = await Municipality.findByPk(municipalityId);
  if (!muni) return { error: "Municipality not found", status: 404 };

  const name = normalizeName(body.name);
  if (typeof name === "object" && name.error) return { error: name.error, status: 400 };

  const phone_numbers = normalizePhones(body.phone_numbers);
  if (typeof phone_numbers === "object" && phone_numbers.error) return { error: phone_numbers.error, status: 400 };

  let status = body.status != null ? String(body.status) : "NEW_NOT_YET_ACTIVE";
  if (!isValidStatus(status)) return { error: "Invalid status", status: 400 };

  const ville_position = normalizeVillePosition(body.ville_position);
  if (typeof ville_position === "object" && ville_position.error) {
    return { error: ville_position.error, status: 400 };
  }

  const row = await MunicipalityAnnex.create({
    municipality_id: municipalityId,
    name,
    phone_numbers,
    ville_position,
    status,
    created_at: new Date(),
    updated_at: new Date()
  });

  return { annex: toPublic(row) };
}

async function updateAdmin(municipalityId, annexId, body) {
  const row = await MunicipalityAnnex.findOne({
    where: { id: annexId, municipality_id: municipalityId }
  });
  if (!row) return { error: "Annex not found", status: 404 };

  const patch = {};
  if (body.name !== undefined) {
    const name = normalizeName(body.name);
    if (typeof name === "object" && name.error) return { error: name.error, status: 400 };
    patch.name = name;
  }
  if (body.phone_numbers !== undefined) {
    const phone_numbers = normalizePhones(body.phone_numbers);
    if (typeof phone_numbers === "object" && phone_numbers.error) return { error: phone_numbers.error, status: 400 };
    patch.phone_numbers = phone_numbers;
  }
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!isValidStatus(status)) return { error: "Invalid status", status: 400 };
    patch.status = status;
  }
  if (body.ville_position !== undefined) {
    const ville_position = normalizeVillePosition(body.ville_position);
    if (typeof ville_position === "object" && ville_position.error) {
      return { error: ville_position.error, status: 400 };
    }
    patch.ville_position = ville_position;
  }

  if (Object.keys(patch).length === 0) return { error: "No fields to update", status: 400 };

  patch.updated_at = new Date();
  await row.update(patch);
  return { annex: toPublic(row) };
}

async function deleteAdmin(municipalityId, annexId) {
  const row = await MunicipalityAnnex.findOne({
    where: { id: annexId, municipality_id: municipalityId }
  });
  if (!row) return { error: "Annex not found", status: 404 };
  await row.destroy();
  return { success: true };
}

async function listForMuniUser(user) {
  if (user.role !== "MUNI_ADMIN" || !user.municipality_id) {
    return { error: "Only commune administrators can list annexes", status: 403 };
  }
  const annexes = await listByMunicipalityId(user.municipality_id);
  return {
    annexes,
    statuses: [...ANNEX_STATUSES],
    ville_positions: [...ANNEX_VILLE_POSITIONS]
  };
}

async function patchStatusForMuniUser(user, annexId, body) {
  if (user.role !== "MUNI_ADMIN" || !user.municipality_id) {
    return { error: "Only commune administrators can update annex status", status: 403 };
  }

  const row = await MunicipalityAnnex.findOne({
    where: { id: annexId, municipality_id: user.municipality_id }
  });
  if (!row) return { error: "Annex not found", status: 404 };

  const status = body.status;
  if (status === undefined) return { error: "status is required", status: 400 };
  if (!isValidStatus(status)) return { error: "Invalid status", status: 400 };

  await row.update({ status: String(status), updated_at: new Date() });
  return { annex: toPublic(row) };
}

module.exports = {
  ANNEX_STATUSES,
  ANNEX_VILLE_POSITIONS,
  isValidStatus,
  listByMunicipalityId,
  listForMuniUser,
  createForMunicipality,
  updateAdmin,
  deleteAdmin,
  patchStatusForMuniUser,
  toPublic
};
