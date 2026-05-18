const { Op } = require("sequelize");
const { CommuneItProfessional, Municipality } = require("../../db");

const MUNI_INCLUDE = {
  model: Municipality,
  as: "municipality",
  attributes: ["id", "code", "name_ar", "name_fr"]
};

function clampPageSize(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(100, Math.floor(n));
}

function clampPage(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function serializeRow(row) {
  const j = row.toJSON ? row.toJSON() : row;
  const m = j.municipality;
  return {
    id: j.id,
    municipality_id: j.municipality_id,
    municipality: m
      ? { id: m.id, code: m.code, name_ar: m.name_ar, name_fr: m.name_fr }
      : null,
    first_name: j.first_name,
    last_name: j.last_name,
    nin: j.nin,
    phone: j.phone,
    email: j.email,
    programming_languages: j.programming_languages,
    created_at: j.created_at,
    updated_at: j.updated_at
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePayload(body, { requireMunicipalityId }) {
  const first_name = String(body?.first_name || "").trim();
  const last_name = String(body?.last_name || "").trim();
  const nin = body?.nin != null && String(body.nin).trim() ? String(body.nin).trim().slice(0, 50) : null;
  const phone = String(body?.phone || "").trim().slice(0, 40);
  const emailRaw = String(body?.email || "").trim();
  const email = emailRaw ? emailRaw.slice(0, 255) : null;
  const programming_languages = String(body?.programming_languages || "").trim();

  if (!first_name) return { error: "first_name is required" };
  if (!last_name) return { error: "last_name is required" };
  if (first_name.length > 120) return { error: "first_name too long" };
  if (last_name.length > 120) return { error: "last_name too long" };
  if (!phone) return { error: "phone is required" };
  if (!programming_languages) return { error: "programming_languages is required" };
  if (programming_languages.length > 16000) return { error: "programming_languages too long" };
  if (email && !EMAIL_RE.test(email)) return { error: "Invalid email format" };

  let municipality_id = null;
  if (requireMunicipalityId) {
    municipality_id = Number(body?.municipality_id);
    if (!Number.isFinite(municipality_id) || municipality_id < 1) {
      return { error: "municipality_id is required" };
    }
  }

  return {
    data: { municipality_id, first_name, last_name, nin, phone, email, programming_languages }
  };
}

async function assertMunicipalityExists(id) {
  const m = await Municipality.findByPk(id);
  if (!m) return { error: "Municipality not found", status: 404 };
  return { municipality: m };
}

async function listWilaya({ page, pageSize, q, municipality_id }) {
  const p = clampPage(page);
  const ps = clampPageSize(pageSize);
  const offset = (p - 1) * ps;

  const where = {};
  if (municipality_id != null && String(municipality_id).trim() !== "") {
    const mid = Number(municipality_id);
    if (Number.isFinite(mid) && mid > 0) where.municipality_id = mid;
  }

  const qstr = q != null ? String(q).trim() : "";
  if (qstr) {
    const like = { [Op.iLike]: `%${qstr.replace(/%/g, "\\%").replace(/_/g, "\\_")}%` };
    where[Op.or] = [
      { first_name: like },
      { last_name: like },
      { nin: like },
      { phone: like },
      { email: like },
      { programming_languages: like },
      { "$municipality.code$": like },
      { "$municipality.name_ar$": like },
      { "$municipality.name_fr$": like }
    ];
  }

  const { rows, count } = await CommuneItProfessional.findAndCountAll({
    where,
    include: [MUNI_INCLUDE],
    order: [[{ model: Municipality, as: "municipality" }, "code", "ASC"], ["id", "ASC"]],
    limit: ps,
    offset,
    distinct: true,
    subQuery: false
  });

  return {
    rows: rows.map(serializeRow),
    total: count,
    page: p,
    pageSize: ps
  };
}

async function listMuni(municipalityId) {
  if (!municipalityId) {
    const err = new Error("No municipality scope");
    err.status = 403;
    throw err;
  }
  const rows = await CommuneItProfessional.findAll({
    where: { municipality_id: municipalityId },
    include: [MUNI_INCLUDE],
    order: [["id", "ASC"]]
  });
  return { rows: rows.map(serializeRow) };
}

async function getByIdForWilaya(id) {
  const row = await CommuneItProfessional.findByPk(id, { include: [MUNI_INCLUDE] });
  if (!row) return { error: "Not found", status: 404 };
  return { row: serializeRow(row) };
}

async function createWilaya(body) {
  const norm = normalizePayload(body, { requireMunicipalityId: true });
  if (norm.error) return { error: norm.error, status: 400 };
  const chk = await assertMunicipalityExists(norm.data.municipality_id);
  if (chk.error) return { error: chk.error, status: chk.status };

  const now = new Date();
  const created = await CommuneItProfessional.create({
    ...norm.data,
    created_at: now,
    updated_at: now
  });
  const full = await CommuneItProfessional.findByPk(created.id, { include: [MUNI_INCLUDE] });
  return { row: serializeRow(full) };
}

async function updateWilaya(id, body) {
  const row = await CommuneItProfessional.findByPk(id, { include: [MUNI_INCLUDE] });
  if (!row) return { error: "Not found", status: 404 };

  const patch = {};
  if (body.first_name !== undefined) patch.first_name = String(body.first_name || "").trim();
  if (body.last_name !== undefined) patch.last_name = String(body.last_name || "").trim();
  if (body.nin !== undefined) patch.nin = body.nin != null && String(body.nin).trim() ? String(body.nin).trim().slice(0, 50) : null;
  if (body.phone !== undefined) patch.phone = String(body.phone || "").trim().slice(0, 40);
  if (body.email !== undefined) {
    const emailRaw = String(body.email || "").trim();
    patch.email = emailRaw ? emailRaw.slice(0, 255) : null;
    if (patch.email && !EMAIL_RE.test(patch.email)) return { error: "Invalid email format", status: 400 };
  }
  if (body.programming_languages !== undefined) {
    patch.programming_languages = String(body.programming_languages || "").trim();
    if (!patch.programming_languages) return { error: "programming_languages is required", status: 400 };
  }
  if (body.municipality_id !== undefined) {
    const mid = Number(body.municipality_id);
    if (!Number.isFinite(mid) || mid < 1) return { error: "Invalid municipality_id", status: 400 };
    const chk = await assertMunicipalityExists(mid);
    if (chk.error) return { error: chk.error, status: chk.status };
    patch.municipality_id = mid;
  }

  if (Object.keys(patch).length === 0) return { error: "No fields to update", status: 400 };

  if (patch.first_name !== undefined && !patch.first_name) return { error: "first_name cannot be empty", status: 400 };
  if (patch.last_name !== undefined && !patch.last_name) return { error: "last_name cannot be empty", status: 400 };
  if (patch.phone !== undefined && !patch.phone) return { error: "phone cannot be empty", status: 400 };

  patch.updated_at = new Date();
  await row.update(patch);
  const full = await CommuneItProfessional.findByPk(id, { include: [MUNI_INCLUDE] });
  return { row: serializeRow(full) };
}

async function deleteWilaya(id) {
  const row = await CommuneItProfessional.findByPk(id);
  if (!row) return { error: "Not found", status: 404 };
  await row.destroy();
  return { success: true };
}

async function createMuni(municipalityId, body) {
  if (!municipalityId) return { error: "Only commune users can create rows", status: 403 };
  const norm = normalizePayload(body, { requireMunicipalityId: false });
  if (norm.error) return { error: norm.error, status: 400 };
  const data = { ...norm.data, municipality_id: municipalityId };
  const now = new Date();
  const created = await CommuneItProfessional.create({
    ...data,
    created_at: now,
    updated_at: now
  });
  const full = await CommuneItProfessional.findByPk(created.id, { include: [MUNI_INCLUDE] });
  return { row: serializeRow(full) };
}

async function updateMuni(municipalityId, id, body) {
  if (!municipalityId) return { error: "Only commune users can update rows", status: 403 };
  const row = await CommuneItProfessional.findOne({ where: { id, municipality_id: municipalityId } });
  if (!row) return { error: "Not found", status: 404 };

  const patch = {};
  if (body.first_name !== undefined) patch.first_name = String(body.first_name || "").trim();
  if (body.last_name !== undefined) patch.last_name = String(body.last_name || "").trim();
  if (body.nin !== undefined) patch.nin = body.nin != null && String(body.nin).trim() ? String(body.nin).trim().slice(0, 50) : null;
  if (body.phone !== undefined) patch.phone = String(body.phone || "").trim().slice(0, 40);
  if (body.email !== undefined) {
    const emailRaw = String(body.email || "").trim();
    patch.email = emailRaw ? emailRaw.slice(0, 255) : null;
    if (patch.email && !EMAIL_RE.test(patch.email)) return { error: "Invalid email format", status: 400 };
  }
  if (body.programming_languages !== undefined) {
    patch.programming_languages = String(body.programming_languages || "").trim();
    if (!patch.programming_languages) return { error: "programming_languages is required", status: 400 };
  }

  if (Object.keys(patch).length === 0) return { error: "No fields to update", status: 400 };
  if (patch.first_name !== undefined && !patch.first_name) return { error: "first_name cannot be empty", status: 400 };
  if (patch.last_name !== undefined && !patch.last_name) return { error: "last_name cannot be empty", status: 400 };
  if (patch.phone !== undefined && !patch.phone) return { error: "phone cannot be empty", status: 400 };

  patch.updated_at = new Date();
  await row.update(patch);
  const full = await CommuneItProfessional.findByPk(id, { include: [MUNI_INCLUDE] });
  return { row: serializeRow(full) };
}

async function deleteMuni(municipalityId, id) {
  if (!municipalityId) return { error: "Only commune users can delete rows", status: 403 };
  const row = await CommuneItProfessional.findOne({ where: { id, municipality_id: municipalityId } });
  if (!row) return { error: "Not found", status: 404 };
  await row.destroy();
  return { success: true };
}

async function listAllForExportWilaya({ municipality_id }) {
  const where = {};
  if (municipality_id != null && String(municipality_id).trim() !== "") {
    const mid = Number(municipality_id);
    if (Number.isFinite(mid) && mid > 0) where.municipality_id = mid;
  }
  return CommuneItProfessional.findAll({
    where,
    include: [MUNI_INCLUDE],
    order: [[{ model: Municipality, as: "municipality" }, "code", "ASC"], ["id", "ASC"]]
  });
}

async function listAllForExportMuni(municipalityId) {
  if (!municipalityId) return [];
  return CommuneItProfessional.findAll({
    where: { municipality_id: municipalityId },
    include: [MUNI_INCLUDE],
    order: [["id", "ASC"]]
  });
}

module.exports = {
  listWilaya,
  listMuni,
  getByIdForWilaya,
  createWilaya,
  updateWilaya,
  deleteWilaya,
  createMuni,
  updateMuni,
  deleteMuni,
  listAllForExportWilaya,
  listAllForExportMuni,
  serializeRow
};
