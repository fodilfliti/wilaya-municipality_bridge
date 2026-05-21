const { Op } = require("sequelize");
const {
  MunicipalityAnnouncement,
  Municipality,
  User,
  sequelize
} = require("../../db");

const MAX_BODY = 2000;

function normalizeBody(text) {
  return String(text || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_BODY);
}

function parsePage(query) {
  const page = Math.max(1, parseInt(String(query.page || "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize || "20"), 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function toDto(row) {
  const j = row.toJSON ? row.toJSON() : row;
  const muni = j.Municipality || j.municipality;
  return {
    id: j.id,
    municipality_id: j.municipality_id,
    municipality: muni
      ? { id: muni.id, code: muni.code, name_ar: muni.name_ar, name_fr: muni.name_fr }
      : null,
    priority: j.priority,
    status: j.status,
    body_text: j.body_text,
    display_date: j.display_date,
    created_by_user_id: j.created_by_user_id,
    created_at: j.created_at,
    updated_at: j.updated_at
  };
}

function activeScopeWhere(municipalityId) {
  return {
    status: "active",
    [Op.or]: [{ municipality_id: null }, { municipality_id: municipalityId }]
  };
}

async function listWilaya(query) {
  const { page, pageSize, offset } = parsePage(query);
  const where = {};
  if (query.status === "active" || query.status === "finished") {
    where.status = query.status;
  }
  if (query.municipality_id != null && query.municipality_id !== "") {
    const mid = Number(query.municipality_id);
    if (Number.isFinite(mid) && mid > 0) where.municipality_id = mid;
  }
  const q = String(query.q || "").trim();
  if (q) {
    where.body_text = { [Op.iLike]: `%${q}%` };
  }

  const { rows, count } = await MunicipalityAnnouncement.findAndCountAll({
    where,
    include: [{ model: Municipality, as: "municipality", attributes: ["id", "code", "name_ar", "name_fr"], required: false }],
    order: [
      ["display_date", "DESC"],
      ["id", "DESC"]
    ],
    limit: pageSize,
    offset
  });

  return {
    rows: rows.map(toDto),
    total: count,
    page,
    pageSize
  };
}

async function createWilaya(body, createdByUserId) {
  const text = normalizeBody(body.body_text);
  if (!text) {
    return { status: 400, fieldErrors: { body_text: "announcementBodyRequired" } };
  }
  let municipality_id = null;
  if (body.municipality_id != null && body.municipality_id !== "") {
    municipality_id = Number(body.municipality_id);
    if (!Number.isFinite(municipality_id) || municipality_id <= 0) {
      return { status: 400, fieldErrors: { municipality_id: "validationMunicipalityNotFound" } };
    }
    const m = await Municipality.findByPk(municipality_id);
    if (!m) return { status: 400, fieldErrors: { municipality_id: "validationMunicipalityNotFound" } };
  }

  const row = await MunicipalityAnnouncement.create({
    municipality_id,
    priority: body.priority === "urgent" ? "urgent" : "important",
    status: "active",
    body_text: text,
    display_date: body.display_date,
    created_by_user_id: createdByUserId
  });
  const full = await MunicipalityAnnouncement.findByPk(row.id, {
    include: [{ model: Municipality, as: "municipality", attributes: ["id", "code", "name_ar", "name_fr"], required: false }]
  });
  return { announcement: toDto(full) };
}

async function updateWilaya(id, body) {
  const row = await MunicipalityAnnouncement.findByPk(id);
  if (!row) return { status: 404, error: "notFound" };

  const patch = {};
  if (body.body_text !== undefined) {
    const text = normalizeBody(body.body_text);
    if (!text) return { status: 400, fieldErrors: { body_text: "announcementBodyRequired" } };
    patch.body_text = text;
  }
  if (body.priority !== undefined) {
    patch.priority = body.priority === "urgent" ? "urgent" : "important";
  }
  if (body.status === "active" || body.status === "finished") {
    patch.status = body.status;
  }
  if (body.display_date !== undefined) {
    patch.display_date = body.display_date;
  }
  if (body.municipality_id !== undefined) {
    if (body.municipality_id == null || body.municipality_id === "") {
      patch.municipality_id = null;
    } else {
      const mid = Number(body.municipality_id);
      if (!Number.isFinite(mid) || mid <= 0) {
        return { status: 400, fieldErrors: { municipality_id: "validationMunicipalityNotFound" } };
      }
      const m = await Municipality.findByPk(mid);
      if (!m) return { status: 400, fieldErrors: { municipality_id: "validationMunicipalityNotFound" } };
      patch.municipality_id = mid;
    }
  }

  await row.update(patch);
  const full = await MunicipalityAnnouncement.findByPk(row.id, {
    include: [{ model: Municipality, as: "municipality", attributes: ["id", "code", "name_ar", "name_fr"], required: false }]
  });
  return { announcement: toDto(full) };
}

async function listActiveForMunicipality(municipalityId) {
  const rows = await MunicipalityAnnouncement.findAll({
    where: activeScopeWhere(municipalityId),
    attributes: ["id", "priority", "body_text", "display_date"],
    order: [
      ["display_date", "DESC"],
      ["id", "DESC"]
    ]
  });
  return rows.map((r) => {
    const j = r.toJSON();
    return {
      id: j.id,
      priority: j.priority,
      body_text: j.body_text,
      display_date: j.display_date
    };
  });
}

async function revisionForMunicipality(municipalityId) {
  const out = await sequelize.query(
    `
    SELECT COALESCE(MAX(EXTRACT(EPOCH FROM updated_at)::bigint), 0)::bigint AS mx,
           COUNT(*)::bigint AS cnt
    FROM municipality_announcements
    WHERE status = 'active'
      AND (municipality_id IS NULL OR municipality_id = :mid)
    `,
    {
      replacements: { mid: municipalityId },
      type: sequelize.QueryTypes.SELECT
    }
  );
  const mx = Number(out?.[0]?.mx ?? 0);
  const cnt = Number(out?.[0]?.cnt ?? 0);
  return { revision: mx * 1000 + cnt };
}

module.exports = {
  listWilaya,
  createWilaya,
  updateWilaya,
  listActiveForMunicipality,
  revisionForMunicipality,
  MAX_BODY
};
