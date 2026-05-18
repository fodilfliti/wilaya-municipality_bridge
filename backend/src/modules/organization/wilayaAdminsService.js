const { Op } = require("sequelize");
const { User, AccessRoleTemplate } = require("../../db");

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
  return {
    id: Number(j.id),
    username: j.username,
    name: j.name,
    role: j.role,
    is_blocked: j.is_blocked,
    can_create_wilaya_admins: Boolean(j.can_create_wilaya_admins),
    can_manage_access_roles: Boolean(j.can_manage_access_roles),
    job_title: j.job_title,
    email: j.email,
    email_hidden: Boolean(j.email_hidden),
    use_custom_permissions: Boolean(j.use_custom_permissions),
    access_role_template_id:
      j.access_role_template_id != null ? Number(j.access_role_template_id) : null,
    access_role_template: j.accessRoleTemplate
      ? {
          id: Number(j.accessRoleTemplate.id),
          slug: j.accessRoleTemplate.slug,
          name_ar: j.accessRoleTemplate.name_ar,
          name_fr: j.accessRoleTemplate.name_fr
        }
      : null
  };
}

async function listWilaya({ page, pageSize, q }) {
  const p = clampPage(page);
  const ps = clampPageSize(pageSize);
  const offset = (p - 1) * ps;

  const where = { role: "SUPER_ADMIN" };
  const qstr = q != null ? String(q).trim() : "";
  if (qstr) {
    const like = { [Op.iLike]: `%${qstr.replace(/%/g, "\\%").replace(/_/g, "\\_")}%` };
    where[Op.and] = [{ role: "SUPER_ADMIN" }, { [Op.or]: [{ username: like }, { name: like }] }];
    delete where.role;
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: [
      "id",
      "username",
      "name",
      "role",
      "is_blocked",
      "can_create_wilaya_admins",
      "can_manage_access_roles",
      "job_title",
      "email",
      "email_hidden",
      "access_role_template_id",
      "use_custom_permissions"
    ],
    include: [
      {
        model: AccessRoleTemplate,
        as: "accessRoleTemplate",
        attributes: ["id", "slug", "name_ar", "name_fr"],
        required: false
      }
    ],
    order: [["id", "ASC"]],
    limit: ps,
    offset
  });

  return {
    rows: rows.map(serializeRow),
    total: count,
    page: p,
    pageSize: ps
  };
}

/** Lightweight list for mail / pickers (id + display name only). */
async function listAllBrief() {
  const rows = await User.findAll({
    where: { role: "SUPER_ADMIN" },
    attributes: ["id", "name", "role"],
    order: [["id", "ASC"]]
  });
  return rows.map((u) => ({ id: u.id, name: u.name, role: u.role }));
}

module.exports = { listWilaya, listAllBrief };
