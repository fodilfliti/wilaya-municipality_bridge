const { httpError } = require("./recipients");

function assertColumnMeta(column) {
  if (!column) throw httpError(400, "Unknown column");
  if (column.column_type === "TEXT" && column.is_result) {
    throw httpError(400, "TEXT columns cannot be marked as result/analytics");
  }
  if (column.column_type === "DATE" && column.is_result) {
    throw httpError(400, "DATE columns cannot be marked as result/analytics");
  }
}

/**
 * @param {object} column Sequelize OperationColumn
 * @param {Array<{ value_key: string }>} choices
 * @param {any} raw cell raw value from client
 */
function normalizeAndValidateCell(column, choices, raw) {
  const t = column.column_type;
  if (t === "BOOLEAN") {
    const v = raw === true || raw === "true" || raw === 1 || raw === "1";
    return { value: Boolean(v) };
  }
  if (t === "NUMBER") {
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n)) throw httpError(400, "Invalid number");
    return { value: n };
  }
  if (t === "TEXT") {
    return { value: raw == null ? "" : String(raw) };
  }
  if (t === "DATE") {
    const s = raw == null ? "" : String(raw).trim();
    if (!s) return { value: "" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw httpError(400, "Invalid date (use YYYY-MM-DD)");
    const d = new Date(`${s}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) throw httpError(400, "Invalid date");
    return { value: s };
  }
  if (t === "CHOICE") {
    const key = String(raw ?? "").trim();
    if (!key) throw httpError(400, "Choice value is required");
    const ok = (choices || []).some((c) => String(c.value_key) === key);
    if (!ok) throw httpError(400, "Invalid choice value");
    return { value_key: key };
  }
  throw httpError(400, "Unsupported column type");
}

function defaultValueForColumn(column, choices) {
  const t = column.column_type;
  if (t === "BOOLEAN") return { value: false };
  if (t === "NUMBER") return { value: 0 };
  if (t === "TEXT") return { value: "" };
  if (t === "DATE") return { value: "" };
  if (t === "CHOICE") {
    const def = column.default_value && typeof column.default_value === "object" ? column.default_value.choice_key : null;
    if (def && (choices || []).some((c) => String(c.value_key) === String(def))) {
      return { value_key: String(def) };
    }
    const first = (choices || []).slice().sort((a, b) => a.position - b.position)[0];
    if (!first) throw httpError(400, "CHOICE column requires at least one choice");
    return { value_key: String(first.value_key) };
  }
  return {};
}

module.exports = { assertColumnMeta, normalizeAndValidateCell, defaultValueForColumn };
