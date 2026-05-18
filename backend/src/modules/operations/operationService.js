const { Op } = require("sequelize");
const {
  sequelize,
  Operation,
  OperationRecipient,
  OperationColumn,
  OperationColumnChoice,
  OperationSheet,
  OperationRow,
  OperationCellValue,
  OperationPaletteColor,
  Municipality,
  User
} = require("../../db");
const { resolveRecipientsFromTarget, mapTargetTypeToStoredKind, httpError } = require("./recipients");
const { assertColumnMeta, normalizeAndValidateCell, defaultValueForColumn } = require("./validation");

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,119}$/;

async function buildTargetSnapshot(operationId, targetKind) {
  if (targetKind === "ALL_MUNICIPALITIES") return { type: "ALL_COMMUNES" };
  const recs = await OperationRecipient.findAll({
    where: { operation_id: operationId },
    attributes: ["user_id", "recipient_kind", "recipient_municipality_id"],
    raw: true
  });
  if (targetKind === "MUNICIPALITIES") {
    const ids = [
      ...new Set(
        recs
          .filter((r) => r.recipient_kind === "MUNICIPALITY_TARGET" && r.recipient_municipality_id != null)
          .map((r) => Number(r.recipient_municipality_id))
      )
    ];
    return { type: "COMMUNES", municipality_ids: ids };
  }
  if (targetKind === "USERS") {
    const userIds = [...new Set(recs.map((r) => Number(r.user_id)))];
    if (!userIds.length) return { type: "USERS", user_ids: [], users: [] };
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id", "username", "role", "municipality_id"],
      raw: true
    });
    return { type: "USERS", user_ids: userIds, users };
  }
  return { type: "ALL_COMMUNES" };
}

function sortMunicipalitiesByCode(rows) {
  return [...rows].sort((a, b) => {
    const ac = String(a.code ?? "");
    const bc = String(b.code ?? "");
    const an = /^\d+$/.test(ac);
    const bn = /^\d+$/.test(bc);
    if (an && bn) return BigInt(ac) < BigInt(bc) ? -1 : BigInt(ac) > BigInt(bc) ? 1 : 0;
    return ac.localeCompare(bc);
  });
}

function validateColumnDefinition(col, { requireChoicesForChoice } = { requireChoicesForChoice: true }) {
  if (!col?.key || !KEY_RE.test(String(col.key))) throw httpError(400, "Each column requires a valid key");
  if (!col?.label_ar) throw httpError(400, "Each column requires label_ar");
  const ct = String(col.column_type || "").toUpperCase();
  if (!["BOOLEAN", "NUMBER", "TEXT", "DATE", "CHOICE"].includes(ct)) throw httpError(400, "Invalid column_type");
  if (ct === "TEXT" && col.is_result) throw httpError(400, "TEXT columns cannot have is_result");
  if (ct === "DATE" && col.is_result) throw httpError(400, "DATE columns cannot have is_result");
  if (ct === "CHOICE") {
    const choices = Array.isArray(col.choices) ? col.choices : [];
    if (requireChoicesForChoice && choices.length < 1) throw httpError(400, "CHOICE columns require choices");
    for (const ch of choices) {
      if (!ch?.value_key || !KEY_RE.test(String(ch.value_key))) throw httpError(400, "Invalid choice value_key");
      if (!ch?.label_ar) throw httpError(400, "Each choice requires label_ar");
      if (!ch?.color_hex || !/^#[0-9A-Fa-f]{6}$/.test(String(ch.color_hex))) {
        throw httpError(400, "Each choice requires color_hex like #RRGGBB");
      }
    }
  }
}

async function loadOperationDetail(operationId, opts = {}) {
  const includeTarget = opts.includeTarget === true;
  const op = await Operation.findByPk(operationId, {
    include: [
      {
        model: OperationColumn,
        as: "columns",
        separate: true,
        order: [
          ["position", "ASC"],
          ["id", "ASC"]
        ],
        include: [
          {
            model: OperationColumnChoice,
            as: "choices",
            separate: true,
            order: [
              ["position", "ASC"],
              ["id", "ASC"]
            ]
          }
        ]
      },
      { model: User, as: "createdByUser", attributes: ["id", "username", "name"] }
    ]
  });
  if (!op) return null;
  const plain = op.get({ plain: true });
  if (includeTarget) plain.target = await buildTargetSnapshot(operationId, plain.target_kind);
  return plain;
}

async function listOperationsAdmin({ page, pageSize, q, status }) {
  const p = Math.max(Number(page || 1), 1);
  const ps = Math.min(Math.max(Number(pageSize || 20), 1), 100);
  const offset = (p - 1) * ps;
  const where = {};
  if (q) where.title = { [Op.iLike]: `%${String(q).trim()}%` };
  const st = String(status || "").trim().toUpperCase();
  if (st === "EN_COURS" || st === "ARCHIVE") where.status = st;
  const { rows, count } = await Operation.findAndCountAll({
    where,
    order: [["created_at", "DESC"], ["id", "DESC"]],
    offset,
    limit: ps
  });
  return {
    operations: rows.map((r) => r.get({ plain: true })),
    total: count,
    page: p,
    pageSize: ps
  };
}

async function attachCommuneSheetSummary(userId, operationsPlain) {
  if (!operationsPlain.length) return;
  const u = await User.findByPk(userId, { attributes: ["municipality_id"] });
  const muniId = u?.municipality_id != null ? Number(u.municipality_id) : null;
  const opIds = [...new Set(operationsPlain.map((o) => Number(o.id)).filter((id) => Number.isFinite(id)))];
  const counts = new Map();
  if (muniId && opIds.length) {
    const sheets = await OperationSheet.findAll({
      where: { municipality_id: muniId, operation_id: { [Op.in]: opIds } },
      attributes: ["id", "operation_id"]
    });
    const sheetIds = sheets.map((s) => Number(s.id));
    const sheetIdToOpId = new Map(sheets.map((s) => [Number(s.id), Number(s.operation_id)]));
    if (sheetIds.length) {
      const agg = await OperationRow.findAll({
        attributes: ["sheet_id", [sequelize.fn("COUNT", sequelize.col("OperationRow.id")), "cnt"]],
        where: { sheet_id: { [Op.in]: sheetIds } },
        group: ["sheet_id"],
        raw: true
      });
      for (const row of agg) {
        const opid = sheetIdToOpId.get(Number(row.sheet_id));
        if (opid != null) counts.set(opid, Number(row.cnt));
      }
    }
  }
  for (const o of operationsPlain) {
    const cnt = counts.get(Number(o.id)) ?? 0;
    o.commune_row_count = cnt;
    o.commune_needs_data = o.status === "EN_COURS" && cnt === 0;
  }
}

async function listOperationsMuni(userId, { page, pageSize, q, status }) {
  const p = Math.max(Number(page || 1), 1);
  const ps = Math.min(Math.max(Number(pageSize || 20), 1), 100);
  const offset = (p - 1) * ps;

  const whereOp = {};
  if (q) whereOp.title = { [Op.iLike]: `%${String(q).trim()}%` };
  const st = String(status || "").trim().toUpperCase();
  if (st === "EN_COURS" || st === "ARCHIVE") whereOp.status = st;
  const include = [{ model: Operation, as: "operation", where: whereOp, required: true }];

  // Avoid OperationRecipient.findAndCountAll + order on include: Sequelize can emit a broken COUNT
  // (PostgreSQL: missing FROM-clause entry for table "OperationRecipient->operation_recipients").
  const [count, rows] = await Promise.all([
    OperationRecipient.count({
      where: { user_id: userId },
      include,
      distinct: true,
      col: "id"
    }),
    OperationRecipient.findAll({
      where: { user_id: userId },
      include,
      order: [[{ model: Operation, as: "operation" }, "created_at", "DESC"]],
      subQuery: false,
      offset,
      limit: ps
    })
  ]);

  const operations = rows.map((r) => r.operation).filter(Boolean);
  const opPlain = operations.map((o) => o.get({ plain: true }));
  await attachCommuneSheetSummary(userId, opPlain);
  return { operations: opPlain, total: count, page: p, pageSize: ps };
}

async function assertRecipient(userId, operationId) {
  const rec = await OperationRecipient.findOne({ where: { operation_id: operationId, user_id: userId } });
  if (!rec) throw httpError(403, "Forbidden");
  return rec;
}

async function getMunicipalityIdForUser(userId) {
  const u = await User.findByPk(userId, { attributes: ["id", "municipality_id", "role"] });
  if (!u || u.role !== "MUNI_ADMIN" || !u.municipality_id) throw httpError(403, "Forbidden");
  return Number(u.municipality_id);
}

async function createColumns(operationId, columnsPayload, transaction) {
  let pos = 0;
  for (const col of columnsPayload || []) {
    validateColumnDefinition(col, { requireChoicesForChoice: true });
    const created = await OperationColumn.create(
      {
        operation_id: operationId,
        key: String(col.key).trim(),
        label_ar: String(col.label_ar).trim(),
        label_fr: col.label_fr ? String(col.label_fr).trim() : null,
        column_type: String(col.column_type).toUpperCase(),
        position: col.position != null ? Number(col.position) : pos,
        is_result: Boolean(col.is_result),
        default_value: col.default_value ?? null,
        created_at: new Date(),
        updated_at: new Date()
      },
      { transaction }
    );
    pos += 1;

    if (String(col.column_type).toUpperCase() === "CHOICE") {
      let cpos = 0;
      for (const ch of col.choices || []) {
        await OperationColumnChoice.create(
          {
            column_id: created.id,
            value_key: String(ch.value_key).trim(),
            label_ar: String(ch.label_ar).trim(),
            label_fr: ch.label_fr ? String(ch.label_fr).trim() : null,
            color_hex: String(ch.color_hex).trim(),
            palette_index: ch.palette_index != null ? Number(ch.palette_index) : null,
            position: ch.position != null ? Number(ch.position) : cpos,
            created_at: new Date(),
            updated_at: new Date()
          },
          { transaction }
        );
        cpos += 1;
      }
    }
  }
}

async function createOperation(actorUserId, body) {
  const { title, description, target, columns } = body || {};
  if (!title || !String(title).trim()) throw httpError(400, "title is required");
  if (!target?.type) throw httpError(400, "target is required");
  const recipients = await resolveRecipientsFromTarget(User, target);
  if (!recipients.length) throw httpError(400, "No recipients resolved for this target");
  const storedKind = mapTargetTypeToStoredKind(target.type);
  if (!storedKind) throw httpError(400, "Unsupported target.type");

  if (!Array.isArray(columns) || columns.length < 1) throw httpError(400, "columns array is required");

  const now = new Date();
  let status = "EN_COURS";
  if (body?.status != null) {
    const s = String(body.status).toUpperCase();
    if (!["EN_COURS", "ARCHIVE"].includes(s)) throw httpError(400, "Invalid status");
    status = s;
  }

  const operationId = await sequelize.transaction(async (transaction) => {
    const op = await Operation.create(
      {
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        created_by_user_id: actorUserId,
        target_kind: storedKind,
        status,
        created_at: now,
        updated_at: now
      },
      { transaction }
    );

    await OperationRecipient.bulkCreate(
      recipients.map((r) => ({
        operation_id: op.id,
        user_id: r.user_id,
        recipient_kind: r.recipient_kind,
        recipient_municipality_id: r.recipient_municipality_id,
        created_at: now
      })),
      { transaction }
    );

    await createColumns(op.id, columns, transaction);
    return Number(op.id);
  });

  return loadOperationDetail(operationId, { includeTarget: true });
}

async function patchOperation(operationId, body) {
  const op = await Operation.findByPk(operationId);
  if (!op) throw httpError(404, "Operation not found");
  const title = body?.title != null ? String(body.title).trim() : null;
  const description = body?.description !== undefined ? (body.description == null ? null : String(body.description).trim()) : undefined;
  const updates = { updated_at: new Date() };
  if (title) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (body?.status != null) {
    const s = String(body.status).toUpperCase();
    if (!["EN_COURS", "ARCHIVE"].includes(s)) throw httpError(400, "Invalid status");
    updates.status = s;
  }
  await op.update(updates);
  return loadOperationDetail(operationId, { includeTarget: true });
}

async function replaceRecipients(operationId, target) {
  const op = await Operation.findByPk(operationId);
  if (!op) throw httpError(404, "Operation not found");
  const recipients = await resolveRecipientsFromTarget(User, target);
  if (!recipients.length) throw httpError(400, "No recipients resolved for this target");
  const storedKind = mapTargetTypeToStoredKind(target.type);
  if (!storedKind) throw httpError(400, "Unsupported target.type");

  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    await OperationRecipient.destroy({ where: { operation_id: operationId }, transaction });
    await OperationRecipient.bulkCreate(
      recipients.map((r) => ({
        operation_id: operationId,
        user_id: r.user_id,
        recipient_kind: r.recipient_kind,
        recipient_municipality_id: r.recipient_municipality_id,
        created_at: now
      })),
      { transaction }
    );
    await Operation.update({ target_kind: storedKind, updated_at: now }, { where: { id: operationId }, transaction });
  });

  return loadOperationDetail(operationId, { includeTarget: true });
}

async function nextColumnPosition(operationId, transaction) {
  const max = await OperationColumn.max("position", { where: { operation_id: operationId }, transaction });
  return max == null ? 0 : Number(max) + 1;
}

async function addColumn(operationId, payload) {
  validateColumnDefinition(payload, { requireChoicesForChoice: true });
  const op = await Operation.findByPk(operationId);
  if (!op) throw httpError(404, "Operation not found");

  return sequelize.transaction(async (transaction) => {
    const position = payload.position != null ? Number(payload.position) : await nextColumnPosition(operationId, transaction);
    const created = await OperationColumn.create(
      {
        operation_id: operationId,
        key: String(payload.key).trim(),
        label_ar: String(payload.label_ar).trim(),
        label_fr: payload.label_fr ? String(payload.label_fr).trim() : null,
        column_type: String(payload.column_type).toUpperCase(),
        position,
        is_result: Boolean(payload.is_result),
        default_value: payload.default_value ?? null,
        created_at: new Date(),
        updated_at: new Date()
      },
      { transaction }
    );

    if (String(payload.column_type).toUpperCase() === "CHOICE") {
      let cpos = 0;
      for (const ch of payload.choices || []) {
        await OperationColumnChoice.create(
          {
            column_id: created.id,
            value_key: String(ch.value_key).trim(),
            label_ar: String(ch.label_ar).trim(),
            label_fr: ch.label_fr ? String(ch.label_fr).trim() : null,
            color_hex: String(ch.color_hex).trim(),
            palette_index: ch.palette_index != null ? Number(ch.palette_index) : null,
            position: ch.position != null ? Number(ch.position) : cpos,
            created_at: new Date(),
            updated_at: new Date()
          },
          { transaction }
        );
        cpos += 1;
      }
    }

    await Operation.update({ updated_at: new Date() }, { where: { id: operationId }, transaction });
    return loadOperationDetail(operationId, { includeTarget: true });
  });
}

async function updateColumn(operationId, columnId, payload) {
  const col = await OperationColumn.findOne({ where: { id: columnId, operation_id: operationId } });
  if (!col) throw httpError(404, "Column not found");
  assertColumnMeta(col);

  const updates = { updated_at: new Date() };
  if (payload.label_ar != null) updates.label_ar = String(payload.label_ar).trim();
  if (payload.label_fr !== undefined) updates.label_fr = payload.label_fr == null ? null : String(payload.label_fr).trim();
  if (payload.is_result != null) {
    updates.is_result = Boolean(payload.is_result);
    const merged = { ...col.toJSON(), ...updates };
    assertColumnMeta(merged);
  }
  if (payload.default_value !== undefined) updates.default_value = payload.default_value;

  const hasPosition = payload.position != null;
  const targetIndex0 = hasPosition ? Math.trunc(Number(payload.position)) : null;
  if (hasPosition && (!Number.isFinite(targetIndex0) || targetIndex0 < 0 || !Number.isInteger(targetIndex0))) {
    throw httpError(400, "Invalid position");
  }

  if (!hasPosition) {
    await col.update(updates);
    return loadOperationDetail(operationId, { includeTarget: true });
  }

  const cid = Number(columnId);

  await sequelize.transaction(async (transaction) => {
    const all = await OperationColumn.findAll({
      where: { operation_id: operationId },
      order: [
        ["position", "ASC"],
        ["id", "ASC"],
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const ids = all.map((r) => Number(r.id));
    const oldIdx = ids.indexOf(cid);
    if (oldIdx === -1) throw httpError(500, "Column ordering error");
    const n = ids.length;
    const newIdx = Math.min(Math.max(targetIndex0, 0), n - 1);
    if (oldIdx !== newIdx) {
      const reordered = [...ids];
      const [moved] = reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, moved);
      for (let i = 0; i < reordered.length; i++) {
        await OperationColumn.update(
          { position: i, updated_at: new Date() },
          { where: { id: reordered[i], operation_id: operationId }, transaction },
        );
      }
    }

    const metaOnly = {};
    if (payload.label_ar != null) metaOnly.label_ar = updates.label_ar;
    if (payload.label_fr !== undefined) metaOnly.label_fr = updates.label_fr;
    if (payload.is_result != null) metaOnly.is_result = updates.is_result;
    if (payload.default_value !== undefined) metaOnly.default_value = updates.default_value;
    if (Object.keys(metaOnly).length) {
      metaOnly.updated_at = new Date();
      await OperationColumn.update(metaOnly, { where: { id: cid, operation_id: operationId }, transaction });
    }
  });

  return loadOperationDetail(operationId, { includeTarget: true });
}

async function deleteColumn(operationId, columnId) {
  const col = await OperationColumn.findOne({ where: { id: columnId, operation_id: operationId } });
  if (!col) throw httpError(404, "Column not found");
  await sequelize.transaction(async (transaction) => {
    await col.destroy({ transaction });
    await Operation.update({ updated_at: new Date() }, { where: { id: operationId }, transaction });
  });
  return loadOperationDetail(operationId, { includeTarget: true });
}

async function addChoice(operationId, columnId, payload) {
  const col = await OperationColumn.findOne({ where: { id: columnId, operation_id: operationId } });
  if (!col) throw httpError(404, "Column not found");
  if (String(col.column_type) !== "CHOICE") throw httpError(400, "Choices only apply to CHOICE columns");
  if (!payload?.value_key || !payload?.label_ar || !payload?.color_hex) throw httpError(400, "value_key, label_ar, color_hex are required");
  if (!/^#[0-9A-Fa-f]{6}$/.test(String(payload.color_hex))) throw httpError(400, "color_hex must be #RRGGBB");

  const max = await OperationColumnChoice.max("position", { where: { column_id: col.id } });
  const position = payload.position != null ? Number(payload.position) : (max == null ? 0 : Number(max) + 1);

  await OperationColumnChoice.create({
    column_id: col.id,
    value_key: String(payload.value_key).trim(),
    label_ar: String(payload.label_ar).trim(),
    label_fr: payload.label_fr ? String(payload.label_fr).trim() : null,
    color_hex: String(payload.color_hex).trim(),
    palette_index: payload.palette_index != null ? Number(payload.palette_index) : null,
    position,
    created_at: new Date(),
    updated_at: new Date()
  });
  await Operation.update({ updated_at: new Date() }, { where: { id: operationId } });
  return loadOperationDetail(operationId, { includeTarget: true });
}

async function updateChoice(operationId, columnId, choiceId, payload) {
  const col = await OperationColumn.findOne({ where: { id: columnId, operation_id: operationId } });
  if (!col) throw httpError(404, "Column not found");
  const ch = await OperationColumnChoice.findOne({ where: { id: choiceId, column_id: col.id } });
  if (!ch) throw httpError(404, "Choice not found");
  const updates = { updated_at: new Date() };
  if (payload.label_ar != null) updates.label_ar = String(payload.label_ar).trim();
  if (payload.label_fr !== undefined) updates.label_fr = payload.label_fr == null ? null : String(payload.label_fr).trim();
  if (payload.color_hex != null) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(String(payload.color_hex))) throw httpError(400, "color_hex must be #RRGGBB");
    updates.color_hex = String(payload.color_hex).trim();
  }
  if (payload.position != null) updates.position = Number(payload.position);
  if (payload.palette_index !== undefined) updates.palette_index = payload.palette_index == null ? null : Number(payload.palette_index);
  await ch.update(updates);
  await Operation.update({ updated_at: new Date() }, { where: { id: operationId } });
  return loadOperationDetail(operationId, { includeTarget: true });
}

async function deleteChoice(operationId, columnId, choiceId) {
  const col = await OperationColumn.findOne({ where: { id: columnId, operation_id: operationId } });
  if (!col) throw httpError(404, "Column not found");
  const ch = await OperationColumnChoice.findOne({ where: { id: choiceId, column_id: col.id } });
  if (!ch) throw httpError(404, "Choice not found");
  await ch.destroy();
  await Operation.update({ updated_at: new Date() }, { where: { id: operationId } });
  return loadOperationDetail(operationId, { includeTarget: true });
}

async function distinctMunicipalityIdsForOperation(operationId) {
  const recs = await OperationRecipient.findAll({
    where: { operation_id: operationId },
    include: [{ model: User, as: "user", attributes: ["id", "municipality_id"] }]
  });
  const ids = new Set();
  for (const r of recs) {
    const mid = r.user?.municipality_id;
    if (mid) ids.add(Number(mid));
  }
  return Array.from(ids);
}

async function getOrCreateSheet(operationId, municipalityId, userId, transaction) {
  const existing = await OperationSheet.findOne({
    where: { operation_id: operationId, municipality_id: municipalityId },
    transaction
  });
  if (existing) return existing;
  return OperationSheet.create(
    {
      operation_id: operationId,
      municipality_id: municipalityId,
      updated_by_user_id: userId,
      updated_at: new Date()
    },
    { transaction }
  );
}

async function getSheetBundle(operationId, municipalityId) {
  const sheet = await OperationSheet.findOne({
    where: { operation_id: operationId, municipality_id: municipalityId },
    include: [
      {
        model: OperationRow,
        as: "rows",
        separate: true,
        order: [
          ["row_index", "ASC"],
          ["id", "ASC"]
        ],
        include: [{ model: OperationCellValue, as: "cells" }]
      }
    ]
  });
  return sheet;
}

async function replaceSheetForMunicipality(operationId, municipalityId, userId, rowsPayload) {
  const op = await loadOperationDetail(operationId, { includeTarget: false });
  if (!op) throw httpError(404, "Operation not found");
  if (String(op.status || "").toUpperCase() === "ARCHIVE") throw httpError(403, "Cannot update sheet for archived operation");

  const colsByKey = new Map();
  for (const c of op.columns || []) colsByKey.set(String(c.key), c);

  if (!Array.isArray(rowsPayload)) throw httpError(400, "rows must be an array");

  await sequelize.transaction(async (transaction) => {
    const sheet = await getOrCreateSheet(operationId, municipalityId, userId, transaction);
    await OperationRow.destroy({ where: { sheet_id: sheet.id }, transaction });

    let ri = 0;
    for (const row of rowsPayload) {
      const rowIndex = row.row_index != null ? Number(row.row_index) : ri;
      const createdRow = await OperationRow.create(
        { sheet_id: sheet.id, row_index: rowIndex, created_at: new Date(), updated_at: new Date() },
        { transaction }
      );
      const cells = row.cells && typeof row.cells === "object" ? row.cells : {};
      for (const [key, raw] of Object.entries(cells)) {
        const col = colsByKey.get(String(key));
        if (!col) throw httpError(400, `Unknown column key: ${key}`);
        const choices = await OperationColumnChoice.findAll({ where: { column_id: col.id }, transaction });
        const normalized = normalizeAndValidateCell(col, choices, raw);
        await OperationCellValue.create(
          {
            row_id: createdRow.id,
            column_id: col.id,
            value_json: normalized,
            created_at: new Date(),
            updated_at: new Date()
          },
          { transaction }
        );
      }
      ri += 1;
    }

    await sheet.update({ updated_by_user_id: userId, updated_at: new Date() }, { transaction });
  });

  return getSheetBundle(operationId, municipalityId);
}

/** Coerce operation cell JSON `{ value }` to a finite number (matches validation.js for NUMBER). */
function numberFromCellValueJson(v) {
  if (!v || v.value === undefined || v.value === null) return null;
  const x = v.value;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && String(x).trim() !== "") {
    const n = Number(String(x).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function collectAnalytics(columns, sheetsPayload) {
  const resultCols = (columns || []).filter((c) => c.is_result);
  const analytics = {};

  const cellsForColumn = (columnId) => {
    const out = [];
    for (const sh of sheetsPayload || []) {
      for (const row of sh.rows || []) {
        for (const cell of row.cells || []) {
          if (Number(cell.column_id) === Number(columnId)) out.push(cell.value_json);
        }
      }
    }
    return out;
  };

  for (const col of resultCols) {
    const colType = String(col.column_type || "").trim().toUpperCase();
    const vals = cellsForColumn(col.id);
    if (colType === "BOOLEAN") {
      let t = 0;
      let f = 0;
      for (const v of vals) {
        if (!v || typeof v.value !== "boolean") continue;
        if (v.value) t += 1;
        else f += 1;
      }
      analytics[col.key] = { kind: "BOOLEAN", true_count: t, false_count: f, total: t + f };
    } else if (colType === "NUMBER") {
      const nums = vals.map(numberFromCellValueJson).filter((n) => n != null);
      if (!nums.length) analytics[col.key] = { kind: "NUMBER", count: 0, sum: 0, min: null, max: null, avg: null };
      else {
        const sum = nums.reduce((a, b) => a + b, 0);
        const count = nums.length;
        const avg = sum / count;
        analytics[col.key] = {
          kind: "NUMBER",
          count,
          sum: Number(sum),
          min: Math.min(...nums),
          max: Math.max(...nums),
          avg: Number(avg)
        };
      }
    } else if (colType === "CHOICE") {
      const counts = {};
      for (const v of vals) {
        const k = v?.value_key != null ? String(v.value_key) : "";
        if (!k) continue;
        counts[k] = (counts[k] || 0) + 1;
      }
      analytics[col.key] = {
        kind: "CHOICE",
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0)
      };
    }
  }
  return analytics;
}

async function getResults(operationId) {
  const op = await loadOperationDetail(operationId, { includeTarget: true });
  if (!op) throw httpError(404, "Operation not found");

  const muniIds = await distinctMunicipalityIdsForOperation(operationId);
  if (!muniIds.length) {
    return {
      operation: op,
      municipalities: [],
      analytics: collectAnalytics(op.columns, []),
      submission: { total: 0, submitted: 0, pending: 0 }
    };
  }
  const munis = await Municipality.findAll({ where: { id: { [Op.in]: muniIds } } });
  const sorted = sortMunicipalitiesByCode(munis);

  const sheetsPayload = [];
  for (const m of sorted) {
    const sheet = await OperationSheet.findOne({
      where: { operation_id: operationId, municipality_id: m.id },
      include: [
        {
          model: OperationRow,
          as: "rows",
          include: [{ model: OperationCellValue, as: "cells" }],
          order: [["row_index", "ASC"], ["id", "ASC"]]
        }
      ]
    });
    const rowsOut = [];
    if (sheet) {
      for (const row of sheet.rows || []) {
        const cells = [];
        const colById = new Map((op.columns || []).map((c) => [Number(c.id), c]));
        for (const cell of row.cells || []) {
          const c = colById.get(Number(cell.column_id));
          cells.push({
            column_id: cell.column_id,
            key: c ? c.key : null,
            value_json: cell.value_json
          });
        }
        rowsOut.push({ row_index: row.row_index, cells });
      }
    }
    const has_submitted = rowsOut.length > 0;
    sheetsPayload.push({
      municipality: { id: m.id, code: m.code, name_ar: m.name_ar, name_fr: m.name_fr },
      rows: rowsOut,
      has_submitted
    });
  }

  const analytics = collectAnalytics(op.columns, sheetsPayload);
  const submitted = sheetsPayload.filter((b) => b.has_submitted).length;
  const total = sheetsPayload.length;

  return {
    operation: op,
    municipalities: sheetsPayload,
    analytics,
    submission: { total, submitted, pending: total - submitted }
  };
}

async function listPaletteColors() {
  const rows = await OperationPaletteColor.findAll({ order: [["palette_index", "ASC"]] });
  return rows;
}

module.exports = {
  loadOperationDetail,
  listOperationsAdmin,
  listOperationsMuni,
  assertRecipient,
  getMunicipalityIdForUser,
  createOperation,
  patchOperation,
  replaceRecipients,
  addColumn,
  updateColumn,
  deleteColumn,
  addChoice,
  updateChoice,
  deleteChoice,
  replaceSheetForMunicipality,
  getSheetBundle,
  getResults,
  listPaletteColors,
  sortMunicipalitiesByCode,
  httpError,
  collectAnalytics
};
