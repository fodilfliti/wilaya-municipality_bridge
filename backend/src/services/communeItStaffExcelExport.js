const ExcelJS = require("exceljs");
const { applyThinBordersToRange } = require("./excelThinBorders");

function fillSolid(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

const FILL_HEADER = fillSolid("FFE5E7EB");

function labels(locale) {
  const fr = locale === "fr";
  return {
    sheet: fr ? "Ingénieurs et techniciens" : "المهندسون والفنيون",
    code: fr ? "Code commune" : "رمز البلدية",
    commune: fr ? "Nom commune" : "اسم البلدية",
    first: fr ? "Prénom" : "الاسم",
    last: fr ? "Nom" : "اللقب",
    nin: fr ? "NIN" : "رقم التعريف",
    phone: fr ? "Téléphone" : "الهاتف",
    email: fr ? "Email" : "البريد",
    langs: fr ? "Langages de programmation" : "لغات البرمجة"
  };
}

function communeName(m, locale) {
  if (!m) return "";
  return locale === "fr" ? m.name_fr : m.name_ar;
}

/** @param {import('sequelize').Model[]} rows */
async function buildWilayaExportBuffer(rows, locale) {
  const L = labels(locale);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(L.sheet, { views: [{ rightToLeft: locale === "ar" }] });

  const headers = [L.code, L.commune, L.first, L.last, L.nin, L.phone, L.email, L.langs];
  ws.addRow(headers);
  ws.getRow(1).eachCell((cell) => {
    cell.fill = FILL_HEADER;
    cell.font = { bold: true };
  });

  for (const row of rows) {
    const j = row.toJSON ? row.toJSON() : row;
    const m = j.municipality;
    ws.addRow([
      m?.code || "",
      communeName(m, locale),
      j.first_name || "",
      j.last_name || "",
      j.nin || "",
      j.phone || "",
      j.email || "",
      j.programming_languages || ""
    ]);
  }

  ws.columns.forEach((col, i) => {
    let max = 10;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const len = cell.value != null ? String(cell.value).length : 0;
      if (len > max) max = Math.min(len, 60);
    });
    col.width = i === 7 ? 48 : Math.max(12, max + 2);
  });

  const lastRow = ws.lastRow?.number || 1;
  const lastCol = headers.length;
  applyThinBordersToRange(ws, 1, lastRow, 1, lastCol);

  const buf = await wb.xlsx.writeBuffer();
  return buf;
}

/** @param {import('sequelize').Model[]} rows */
async function buildMuniExportBuffer(rows, locale) {
  return buildWilayaExportBuffer(rows, locale);
}

module.exports = { buildWilayaExportBuffer, buildMuniExportBuffer };
