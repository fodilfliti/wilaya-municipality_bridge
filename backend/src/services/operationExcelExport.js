const ExcelJS = require("exceljs");
const { collectAnalytics } = require("../modules/operations/operationService");
const { thinCellBorder, applyThinBordersToRange } = require("./excelThinBorders");

function fillSolid(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/** Pending commune row (matches UI warm highlight) */
const FILL_ROW_PENDING = fillSolid("FFFFF7ED");
/** Submitted: light tint on code / commune cells */
const FILL_META_SUBMITTED = fillSolid("FFF0FDF4");
const FILL_BOOL_TRUE = fillSolid("FFD1FAE5");
const FILL_BOOL_FALSE = fillSolid("FFFEE2E2");
const FILL_SECTION_HEADER = fillSolid("FFE5E7EB");
const FILL_SUBMISSION_SENT = fillSolid("FFD1FAE5");
const FILL_SUBMISSION_PENDING = fillSolid("FFFFEDD5");
const FILL_STATUS_SENT = fillSolid("FFD1FAE5");
const FILL_STATUS_NOT_SENT = fillSolid("FFFFEDD5");

function choiceFillFromHex(hex) {
  const s = String(hex || "").replace(/^#/, "");
  if (!/^[0-9A-Fa-f]{6}$/.test(s)) return fillSolid("FFF3F4F6");
  return fillSolid(`44${s.toUpperCase()}`);
}

function pct(part, total) {
  const t = Math.max(0, Number(total) || 0);
  if (!t) return 0;
  return Math.round((Math.max(0, Number(part) || 0) / t) * 100);
}

function fmtNum(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const x = Number(n);
  return Number.isInteger(x) ? String(x) : x.toFixed(2);
}

function numberSumDisplay(a) {
  if (!a || a.kind !== "NUMBER") return "";
  const count = Number(a.count ?? 0);
  const avgN = Number(a.avg);
  const derived = count > 0 && Number.isFinite(avgN) ? avgN * count : null;
  const declared = a.sum != null && Number.isFinite(Number(a.sum)) ? Number(a.sum) : null;
  let sum = declared;
  if (derived != null && Number.isFinite(derived)) {
    if (declared == null || Math.abs(declared - derived) > 1e-4) sum = derived;
  }
  return sum != null && Number.isFinite(sum) ? fmtNum(sum) : fmtNum(a.sum);
}

/** Excel OOXML readingOrder: 1 = LTR, 2 = RTL */
function alignmentForDataColumn(columnType, locale) {
  const t = String(columnType || "")
    .trim()
    .toUpperCase();
  if (t === "TEXT") {
    return {
      horizontal: locale === "ar" ? "right" : "left",
      vertical: "middle",
      wrapText: true,
      readingOrder: locale === "ar" ? 2 : 1,
    };
  }
  return { horizontal: "center", vertical: "middle", wrapText: false };
}

function alignmentFixedMeta() {
  return { horizontal: "center", vertical: "middle", wrapText: true };
}

function styleCellBorderAndFill(cell, fill) {
  cell.border = thinCellBorder();
  if (fill) cell.fill = fill;
}

/**
 * Wilaya / wide table: first `fixedCols` columns (code, commune, …) centered; then one cell per `columns[i]`.
 */
function applyOperationGridStyle(ws, { headerRow, lastRow, columns, locale, fixedCols }) {
  if (!lastRow || lastRow < headerRow) return;
  const lastCol = fixedCols + (columns || []).length;
  const left = 1;
  const right = Math.max(1, lastCol);

  for (let r = headerRow; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const isHeader = r === headerRow;
    for (let c = left; c <= right; c++) {
      const cell = row.getCell(c);
      cell.border = thinCellBorder();
      if (isHeader) {
        cell.font = { ...(cell.font || {}), bold: true };
      }
      if (c <= fixedCols) {
        cell.alignment = alignmentFixedMeta();
      } else {
        const colDef = columns[c - fixedCols - 1];
        const ct = colDef?.column_type;
        cell.alignment = alignmentForDataColumn(ct, locale);
      }
    }
  }
}

function applyWilayaDataRowColors(ws, headerRow, contexts, cols, choicesByColId) {
  const lastDataCol = 2 + cols.length;
  for (const ctx of contexts) {
    const r = ctx.excelRow;
    if (r <= headerRow) continue;
    const row = ws.getRow(r);
    if (!ctx.submitted) {
      for (let c = 1; c <= lastDataCol; c++) {
        row.getCell(c).fill = FILL_ROW_PENDING;
      }
    } else {
      row.getCell(1).fill = FILL_META_SUBMITTED;
      row.getCell(2).fill = FILL_META_SUBMITTED;
    }
    cols.forEach((col, j) => {
      const cidx = j + 3;
      const cell = row.getCell(cidx);
      const vj = ctx.byKey.get(col.key);
      const t = String(col.column_type || "").toUpperCase();
      if (t === "BOOLEAN" && vj && typeof vj.value === "boolean") {
        cell.fill = vj.value ? FILL_BOOL_TRUE : FILL_BOOL_FALSE;
      } else if (t === "CHOICE" && vj?.value_key != null) {
        const choices = choicesByColId.get(Number(col.id)) || [];
        const ch = choices.find((x) => String(x.value_key) === String(vj.value_key));
        if (ch?.color_hex) cell.fill = choiceFillFromHex(ch.color_hex);
      }
    });
  }
}

function applyMuniDataRowColors(ws, headerRow, lastRow, cols, choicesByColId, contexts) {
  for (const ctx of contexts) {
    const r = ctx.excelRow;
    if (r <= headerRow || r > lastRow) continue;
    const row = ws.getRow(r);
    cols.forEach((col, j) => {
      const cidx = j + 1;
      const cell = row.getCell(cidx);
      const vj = ctx.byColId.get(Number(col.id));
      const t = String(col.column_type || "").toUpperCase();
      if (t === "BOOLEAN" && vj && typeof vj.value === "boolean") {
        cell.fill = vj.value ? FILL_BOOL_TRUE : FILL_BOOL_FALSE;
      } else if (t === "CHOICE" && vj?.value_key != null) {
        const choices = choicesByColId.get(Number(col.id)) || [];
        const ch = choices.find((x) => String(x.value_key) === String(vj.value_key));
        if (ch?.color_hex) cell.fill = choiceFillFromHex(ch.color_hex);
      }
    });
  }
}

/**
 * Muni sheet: only operation columns (no leading code/commune in the grid).
 */
function applyMuniDataGridStyle(ws, { headerRow, lastRow, columns, locale }) {
  if (!lastRow || lastRow < headerRow) return;
  const lastCol = Math.max(1, (columns || []).length);
  for (let r = headerRow; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const isHeader = r === headerRow;
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c);
      cell.border = thinCellBorder();
      if (isHeader) {
        cell.font = { ...(cell.font || {}), bold: true };
      }
      const colDef = columns[c - 1];
      cell.alignment = alignmentForDataColumn(colDef?.column_type, locale);
    }
  }
}

/**
 * Simple bordered table (e.g. submission report).
 */
function applySimpleTableStyle(ws, { headerRow, lastRow, lastCol }) {
  if (!lastRow || !lastCol || lastRow < headerRow) return;
  for (let r = headerRow; r <= lastRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c);
      cell.border = thinCellBorder();
      if (r === headerRow) {
        cell.font = { ...(cell.font || {}), bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      }
    }
  }
}

function applySubmissionReportRowColors(ws, headerRow, dataEndRow) {
  for (let r = headerRow + 1; r <= dataEndRow; r++) {
    const row = ws.getRow(r);
    const statusCell = row.getCell(3);
    const v = String(statusCell.value || "");
    const isSent = /تم الإرسال|Données transmises/i.test(v);
    const fill = isSent ? FILL_STATUS_SENT : FILL_STATUS_NOT_SENT;
    for (let c = 1; c <= 4; c++) {
      row.getCell(c).fill = fill;
    }
  }
}

function pickLocaleLabel(entity, locale) {
  if (locale === "fr" && entity?.label_fr) return String(entity.label_fr);
  return String(entity?.label_ar ?? "");
}

function formatValueForExcel(column, choices, valueJson, locale) {
  if (!valueJson) return "";
  const t = column.column_type;
  if (t === "BOOLEAN") {
    const v = Boolean(valueJson.value);
    if (locale === "fr") return v ? "Oui" : "Non";
    return v ? "نعم" : "لا";
  }
  if (t === "NUMBER") return valueJson.value == null ? "" : Number(valueJson.value);
  if (t === "TEXT") return valueJson.value == null ? "" : String(valueJson.value);
  if (t === "DATE") return valueJson.value == null ? "" : String(valueJson.value);
  if (t === "CHOICE") {
    const key = valueJson.value_key != null ? String(valueJson.value_key) : "";
    const ch = (choices || []).find((c) => String(c.value_key) === key);
    return ch ? pickLocaleLabel(ch, locale) : key;
  }
  return "";
}

function mergeRowTitle(ws, r, lastCol, value, locale) {
  if (lastCol < 1) return;
  ws.mergeCells(r, 1, r, lastCol);
  const cell = ws.getCell(r, 1);
  cell.value = value;
  cell.font = { bold: true, size: 12 };
  cell.fill = FILL_SECTION_HEADER;
  cell.alignment = {
    horizontal: locale === "ar" ? "right" : "left",
    vertical: "middle",
    wrapText: true,
    readingOrder: locale === "ar" ? 2 : 1,
  };
  cell.border = thinCellBorder();
}

/**
 * Submission + analytics appendix (wilaya or single-muni).
 */
function appendSummarySections(ws, startRow, { operation, submission, analytics, locale, lastTableCol }) {
  const ar = locale !== "fr";
  let r = startRow;
  const span = Math.max(3, lastTableCol || 5);

  mergeRowTitle(ws, r, span, ar ? "ملخص حالة الإرسال" : "Résumé — état d'envoi", locale);
  r++;

  const total = Math.max(0, Number(submission?.total) || 0);
  const sub = Math.max(0, Number(submission?.submitted) || 0);
  const pen = Math.max(0, Number(submission?.pending) || 0);

  const rowSent = ws.getRow(r);
  rowSent.getCell(1).value = ar ? "أرسلت بيانات" : "Données transmises";
  rowSent.getCell(2).value = `${sub}/${total}`;
  rowSent.getCell(3).value = total ? `${pct(sub, total)}%` : "—";
  for (let c = 1; c <= span; c++) {
    styleCellBorderAndFill(rowSent.getCell(c), FILL_SUBMISSION_SENT);
  }
  r++;

  const rowPen = ws.getRow(r);
  rowPen.getCell(1).value = ar ? "لم ترسل بعد" : "Non envoyé";
  rowPen.getCell(2).value = `${pen}/${total}`;
  rowPen.getCell(3).value = total ? `${pct(pen, total)}%` : "—";
  for (let c = 1; c <= span; c++) {
    styleCellBorderAndFill(rowPen.getCell(c), FILL_SUBMISSION_PENDING);
  }
  r++;

  const resultCols = (operation.columns || []).filter((c) => c.is_result).sort((a, b) => a.position - b.position);
  const hasAnalytics = resultCols.some((c) => analytics && analytics[c.key]);
  if (!hasAnalytics) return r;

  r++;
  mergeRowTitle(ws, r, span, ar ? "إحصاءات الأعمدة المعرّفة كنتيجة" : "Statistiques — colonnes « résultat »", locale);
  r++;

  for (const col of resultCols) {
    const a = analytics[col.key];
    if (!a) continue;
    const title = pickLocaleLabel(col, locale);
    mergeRowTitle(ws, r, span, title, locale);
    r++;

    if (a.kind === "BOOLEAN") {
      const tot = a.total || 0;
      const tRow = ws.getRow(r);
      tRow.getCell(1).value = ar ? "نعم" : "Oui";
      tRow.getCell(2).value = tot ? `${a.true_count}/${tot} (${pct(a.true_count, tot)}%)` : "—";
      styleCellBorderAndFill(tRow.getCell(1), FILL_BOOL_TRUE);
      styleCellBorderAndFill(tRow.getCell(2), FILL_BOOL_TRUE);
      for (let c = 3; c <= span; c++) styleCellBorderAndFill(tRow.getCell(c), FILL_BOOL_TRUE);
      r++;
      const fRow = ws.getRow(r);
      fRow.getCell(1).value = ar ? "لا" : "Non";
      fRow.getCell(2).value = tot ? `${a.false_count}/${tot} (${pct(a.false_count, tot)}%)` : "—";
      styleCellBorderAndFill(fRow.getCell(1), FILL_BOOL_FALSE);
      styleCellBorderAndFill(fRow.getCell(2), FILL_BOOL_FALSE);
      for (let c = 3; c <= span; c++) styleCellBorderAndFill(fRow.getCell(c), FILL_BOOL_FALSE);
      r++;
    } else if (a.kind === "NUMBER") {
      const row = ws.getRow(r);
      row.getCell(1).value = ar ? "عدد القيم" : "Nombre de valeurs";
      row.getCell(2).value = a.count ?? 0;
      styleCellBorderAndFill(row.getCell(1), undefined);
      styleCellBorderAndFill(row.getCell(2), undefined);
      for (let c = 3; c <= span; c++) styleCellBorderAndFill(row.getCell(c), undefined);
      r++;
      const row2 = ws.getRow(r);
      row2.getCell(1).value = ar ? "مجموع القيم" : "Somme";
      row2.getCell(2).value = numberSumDisplay(a);
      styleCellBorderAndFill(row2.getCell(1), undefined);
      styleCellBorderAndFill(row2.getCell(2), undefined);
      for (let c = 3; c <= span; c++) styleCellBorderAndFill(row2.getCell(c), undefined);
      r++;
      const row3 = ws.getRow(r);
      row3.getCell(1).value = ar ? "أصغر / أكبر / متوسط" : "Min / max / moyenne";
      row3.getCell(2).value = `${fmtNum(a.min)} / ${fmtNum(a.max)} / ${fmtNum(a.avg)}`;
      styleCellBorderAndFill(row3.getCell(1), undefined);
      styleCellBorderAndFill(row3.getCell(2), undefined);
      for (let c = 3; c <= span; c++) styleCellBorderAndFill(row3.getCell(c), undefined);
      r++;
    } else if (a.kind === "CHOICE") {
      const counts = a.counts || {};
      const total = Math.max(0, Number(a.total) || 0);
      const choices = (col.choices || []).slice().sort((x, y) => (x.position ?? 0) - (y.position ?? 0));
      const seen = new Set();
      for (const ch of choices) {
        const vk = String(ch.value_key);
        seen.add(vk);
        const cnt = Number(counts[vk] ?? 0);
        const row = ws.getRow(r);
        row.getCell(1).value = pickLocaleLabel(ch, locale);
        row.getCell(2).value = total ? `${cnt}/${total} (${pct(cnt, total)}%)` : `${cnt}/0`;
        const fill = ch.color_hex ? choiceFillFromHex(ch.color_hex) : FILL_SECTION_HEADER;
        styleCellBorderAndFill(row.getCell(1), fill);
        styleCellBorderAndFill(row.getCell(2), fill);
        for (let c = 3; c <= span; c++) styleCellBorderAndFill(row.getCell(c), fill);
        r++;
      }
      for (const vk of Object.keys(counts)) {
        if (seen.has(vk)) continue;
        const cnt = Number(counts[vk] ?? 0);
        const row = ws.getRow(r);
        row.getCell(1).value = vk;
        row.getCell(2).value = total ? `${cnt}/${total} (${pct(cnt, total)}%)` : `${cnt}/0`;
        styleCellBorderAndFill(row.getCell(1), undefined);
        styleCellBorderAndFill(row.getCell(2), undefined);
        for (let c = 3; c <= span; c++) styleCellBorderAndFill(row.getCell(c), undefined);
        r++;
      }
    }
    r++;
  }

  return r;
}

/**
 * Wilaya consolidated export (one worksheet).
 * @param {object} resultsPayload output shape of operationService.getResults()
 * @param {'ar'|'fr'} locale
 */
async function buildWilayaExportBuffer(resultsPayload, locale = "ar") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Results");

  const op = resultsPayload.operation;
  const cols = op.columns || [];
  const choicesByColId = new Map();
  for (const c of cols) {
    choicesByColId.set(Number(c.id), c.choices || []);
  }

  const header = [];
  header.push(locale === "fr" ? "Code" : "رمز البلدية");
  header.push(locale === "fr" ? "Commune" : "البلدية");
  for (const c of cols) header.push(pickLocaleLabel(c, locale));
  ws.addRow(header);

  const dataContexts = [];

  for (const block of resultsPayload.municipalities || []) {
    const m = block.municipality;
    const rows = block.rows || [];
    const submitted = Boolean(block.has_submitted);
    if (!rows.length) {
      ws.addRow([m.code, locale === "fr" ? m.name_fr : m.name_ar, ...cols.map(() => "")]);
      dataContexts.push({ excelRow: ws.lastRow.number, submitted, byKey: new Map() });
      continue;
    }
    for (const row of rows) {
      const byKey = new Map();
      for (const cell of row.cells || []) {
        if (cell.key) byKey.set(cell.key, cell.value_json);
      }
      const out = [m.code, locale === "fr" ? m.name_fr : m.name_ar];
      for (const c of cols) {
        const choices = choicesByColId.get(Number(c.id)) || [];
        out.push(formatValueForExcel(c, choices, byKey.get(c.key), locale));
      }
      ws.addRow(out);
      dataContexts.push({ excelRow: ws.lastRow.number, submitted, byKey });
    }
  }

  const headerRow = 1;
  const lastRow = ws.lastRow ? ws.lastRow.number : 1;
  const lastTableCol = 2 + cols.length;
  applyOperationGridStyle(ws, {
    headerRow,
    lastRow,
    columns: cols,
    locale,
    fixedCols: 2,
  });
  applyWilayaDataRowColors(ws, headerRow, dataContexts, cols, choicesByColId);

  const submission = resultsPayload.submission || { total: 0, submitted: 0, pending: 0 };
  const analytics = resultsPayload.analytics || {};
  appendSummarySections(ws, lastRow + 2, {
    operation: op,
    submission,
    analytics,
    locale,
    lastTableCol,
  });

  return wb.xlsx.writeBuffer();
}

/**
 * Single commune sheet export.
 */
function municipalityLabel(m, locale) {
  if (!m) return "";
  return locale === "fr" ? String(m.name_fr || m.name_ar || "") : String(m.name_ar || m.name_fr || "");
}

function sheetToSheetsPayloadForAnalytics(operationDetail, municipality, sheet) {
  const rowsOut = [];
  for (const row of (sheet?.rows || []).slice().sort((a, b) => a.row_index - b.row_index)) {
    const cells = [];
    for (const cell of row.cells || []) {
      cells.push({ column_id: cell.column_id, value_json: cell.value_json });
    }
    rowsOut.push({ row_index: row.row_index, cells });
  }
  return [
    {
      municipality: {
        id: municipality.id,
        code: municipality.code,
        name_ar: municipality.name_ar,
        name_fr: municipality.name_fr,
      },
      rows: rowsOut,
      has_submitted: rowsOut.length > 0,
    },
  ];
}

async function buildMuniExportBuffer(operationDetail, municipality, sheet, locale = "ar") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet");

  const cols = operationDetail.columns || [];
  const choicesByColId = new Map();
  for (const c of cols) choicesByColId.set(Number(c.id), c.choices || []);

  ws.addRow([`${locale === "fr" ? "Opération" : "العملية"}: ${operationDetail.title}`]);
  ws.addRow([
    `${locale === "fr" ? "Commune" : "البلدية"}: ${municipality.code} — ${municipalityLabel(municipality, locale)}`,
  ]);

  const headerRowIndex = 3;
  const header = cols.map((c) => pickLocaleLabel(c, locale));
  ws.addRow(header);

  const dataContexts = [];
  const rows = sheet?.rows || [];
  if (!rows.length) {
    ws.addRow(cols.map(() => ""));
    dataContexts.push({ excelRow: ws.lastRow.number, byColId: new Map() });
  } else {
    for (const row of rows.slice().sort((a, b) => a.row_index - b.row_index)) {
      const byColId = new Map();
      for (const cell of row.cells || []) {
        byColId.set(Number(cell.column_id), cell.value_json);
      }
      const out = [];
      for (const c of cols) {
        const choices = choicesByColId.get(Number(c.id)) || [];
        out.push(formatValueForExcel(c, choices, byColId.get(Number(c.id)), locale));
      }
      ws.addRow(out);
      dataContexts.push({ excelRow: ws.lastRow.number, byColId });
    }
  }

  const lastRow = ws.lastRow ? ws.lastRow.number : headerRowIndex;
  applyMuniDataGridStyle(ws, {
    headerRow: headerRowIndex,
    lastRow,
    columns: cols,
    locale,
  });
  applyMuniDataRowColors(ws, headerRowIndex, lastRow, cols, choicesByColId, dataContexts);

  const titleLastCol = Math.max(1, cols.length);
  for (let r = 1; r < headerRowIndex; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= titleLastCol; c++) {
      row.getCell(c).border = thinCellBorder();
      row.getCell(c).alignment = { horizontal: locale === "ar" ? "right" : "left", vertical: "middle", wrapText: true };
    }
  }

  const sheetsPayload = sheetToSheetsPayloadForAnalytics(operationDetail, municipality, sheet);
  const analytics = collectAnalytics(operationDetail.columns, sheetsPayload);
  const submitted = sheetsPayload[0]?.has_submitted ? 1 : 0;
  const submission = { total: 1, submitted, pending: 1 - submitted };

  appendSummarySections(ws, lastRow + 2, {
    operation: operationDetail,
    submission,
    analytics,
    locale,
    lastTableCol: titleLastCol,
  });

  return wb.xlsx.writeBuffer();
}

/**
 * Per-commune submission status (sent at least one row vs not).
 * @param {object} resultsPayload output shape of operationService.getResults()
 * @param {'ar'|'fr'} locale
 */
async function buildWilayaSubmissionReportBuffer(resultsPayload, locale = "ar") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(locale === "fr" ? "Rapport" : "تقرير");

  const titleRow = locale === "fr" ? "Rapport envoi par commune" : "تقرير الإرسال حسب البلدية";
  ws.addRow([titleRow, resultsPayload.operation?.title || ""]);

  const hdr =
    locale === "fr"
      ? ["Code commune", "Commune", "Statut", "Nombre de lignes"]
      : ["رمز البلدية", "البلدية", "الحالة", "عدد الصفوف"];
  ws.addRow(hdr);

  for (const block of resultsPayload.municipalities || []) {
    const m = block.municipality;
    const rows = block.rows || [];
    const sent = Boolean(block.has_submitted);
    const statusLabel =
      locale === "fr" ? (sent ? "Données envoyées" : "Non envoyé") : sent ? "تم الإرسال" : "لم يُرسل بعد";
    const name = locale === "fr" ? m.name_fr || m.name_ar : m.name_ar || m.name_fr;
    ws.addRow([m.code, name, statusLabel, rows.length]);
  }

  const headerRow = 2;
  const dataEndRow = ws.lastRow ? ws.lastRow.number : headerRow;

  const sub = resultsPayload.submission || { total: 0, submitted: 0, pending: 0 };
  ws.addRow([]);
  const blankRowAfterData = ws.lastRow.number;
  ws.addRow(
    locale === "fr"
      ? ["Synthèse", `Total: ${sub.total}`, `Envoyé: ${sub.submitted}`, `En attente: ${sub.pending}`]
      : ["ملخص", `الإجمالي: ${sub.total}`, `أرسلت: ${sub.submitted}`, `معلّق: ${sub.pending}`]
  );

  applySimpleTableStyle(ws, { headerRow, lastRow: dataEndRow, lastCol: 4 });
  applySubmissionReportRowColors(ws, headerRow, dataEndRow);

  const titleRowIdx = 1;
  for (let c = 1; c <= 4; c++) {
    const cell = ws.getRow(titleRowIdx).getCell(c);
    cell.border = thinCellBorder();
    cell.font = { ...(cell.font || {}), bold: true };
    cell.alignment = {
      horizontal: locale === "ar" ? "right" : "left",
      vertical: "middle",
      wrapText: true,
      readingOrder: locale === "ar" ? 2 : 1,
    };
  }

  const sumRow = ws.lastRow.number;
  for (let c = 1; c <= 4; c++) {
    const cell = ws.getRow(sumRow).getCell(c);
    cell.border = thinCellBorder();
    cell.fill = FILL_SECTION_HEADER;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }

  applyThinBordersToRange(ws, blankRowAfterData, blankRowAfterData, 1, 4);

  return wb.xlsx.writeBuffer();
}

module.exports = { buildWilayaExportBuffer, buildWilayaSubmissionReportBuffer, buildMuniExportBuffer, formatValueForExcel };
