const { Op } = require("sequelize");
const { User, Municipality } = require("../../db");

const MUNI_INCLUDE = {
  model: Municipality,
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
  const m = j.Municipality;
  return {
    id: j.id,
    username: j.username,
    name: j.name,
    role: j.role,
    municipality_id: j.municipality_id,
    is_blocked: j.is_blocked,
    municipality: m
      ? { id: m.id, code: m.code, name_ar: m.name_ar, name_fr: m.name_fr }
      : null
  };
}

async function listWilaya({ page, pageSize, q, municipality_id }) {
  const p = clampPage(page);
  const ps = clampPageSize(pageSize);
  const offset = (p - 1) * ps;

  const conditions = [{ role: "MUNI_ADMIN" }];

  if (municipality_id != null && String(municipality_id).trim() !== "") {
    const mid = Number(municipality_id);
    if (Number.isFinite(mid) && mid > 0) conditions.push({ municipality_id: mid });
  }

  const qstr = q != null ? String(q).trim() : "";
  if (qstr) {
    const like = { [Op.iLike]: `%${qstr.replace(/%/g, "\\%").replace(/_/g, "\\_")}%` };
    conditions.push({
      [Op.or]: [
        { username: like },
        { name: like },
        { "$Municipality.code$": like },
        { "$Municipality.name_ar$": like },
        { "$Municipality.name_fr$": like }
      ]
    });
  }

  const where = conditions.length === 1 ? conditions[0] : { [Op.and]: conditions };

  const { rows, count } = await User.findAndCountAll({
    where,
    include: [MUNI_INCLUDE],
    attributes: ["id", "username", "name", "role", "municipality_id", "is_blocked"],
    order: [[Municipality, "code", "ASC"], ["id", "ASC"]],
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

module.exports = { listWilaya };
