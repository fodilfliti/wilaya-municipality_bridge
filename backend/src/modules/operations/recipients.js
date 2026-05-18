const { Op } = require("sequelize");

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/**
 * Expands API `target` (same shape as mail) into recipient rows for `operation_recipients`.
 * @param {import('sequelize').ModelCtor<any>} User
 * @param {object} target
 * @returns {Promise<Array<{ user_id: number, recipient_kind: string, recipient_municipality_id: number | null }>>}
 */
async function resolveRecipientsFromTarget(User, target) {
  const type = target?.type;
  if (!type) throw httpError(400, "target.type is required");

  if (type === "ALL_COMMUNES") {
    const users = await User.findAll({
      where: { role: "MUNI_ADMIN", municipality_id: { [Op.ne]: null } },
      attributes: ["id", "municipality_id"]
    });
    return dedupeRecipients(
      users.map((u) => ({
        user_id: Number(u.id),
        recipient_kind: "ALL_MUNICIPALITIES",
        recipient_municipality_id: u.municipality_id ? Number(u.municipality_id) : null
      }))
    );
  }

  if (type === "COMMUNES") {
    const ids = Array.isArray(target.municipality_ids) ? target.municipality_ids.map((x) => Number(x)).filter(Boolean) : [];
    if (!ids.length) throw httpError(400, "target.municipality_ids is required");
    const users = await User.findAll({
      where: { role: "MUNI_ADMIN", municipality_id: { [Op.in]: ids } },
      attributes: ["id", "municipality_id"]
    });
    return dedupeRecipients(
      users.map((u) => ({
        user_id: Number(u.id),
        recipient_kind: "MUNICIPALITY_TARGET",
        recipient_municipality_id: u.municipality_id ? Number(u.municipality_id) : null
      }))
    );
  }

  if (type === "USERS") {
    const ids = Array.isArray(target.user_ids) ? target.user_ids.map((x) => Number(x)).filter(Boolean) : [];
    if (!ids.length) throw httpError(400, "target.user_ids is required");
    const users = await User.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["id", "municipality_id"]
    });
    return dedupeRecipients(
      users.map((u) => ({
        user_id: Number(u.id),
        recipient_kind: "DIRECT_USER",
        recipient_municipality_id: u.municipality_id ? Number(u.municipality_id) : null
      }))
    );
  }

  throw httpError(400, "Unsupported target.type");
}

function mapTargetTypeToStoredKind(type) {
  if (type === "ALL_COMMUNES") return "ALL_MUNICIPALITIES";
  if (type === "COMMUNES") return "MUNICIPALITIES";
  if (type === "USERS") return "USERS";
  return null;
}

function dedupeRecipients(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const k = `${r.user_id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

module.exports = { resolveRecipientsFromTarget, mapTargetTypeToStoredKind, httpError };
