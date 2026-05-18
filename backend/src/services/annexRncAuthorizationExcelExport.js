const ExcelJS = require("exceljs");
const { thinCellBorder, applyThinBordersToRange } = require("./excelThinBorders");

function fillSolid(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

const FILL_HEADER = fillSolid("FFE5E7EB");
const FILL_RNC_PENDING = fillSolid("FFFFEDD5");
const FILL_RNC_APPROVED = fillSolid("FFD1FAE5");
const FILL_RNC_REJECTED = fillSolid("FFFEE2E2");

function rncStatusLabel(st, locale) {
  const s = String(st || "none");
  if (locale === "fr") {
    if (s === "pending") return "En attente";
    if (s === "approved") return "Autorisé";
    if (s === "rejected") return "Refusé";
    return "—";
  }
  if (s === "pending") return "قيد الانتظار";
  if (s === "approved") return "مصرّح";
  if (s === "rejected") return "مرفوض";
  return "—";
}

function communeName(m, locale) {
  return locale === "fr" ? m.name_fr || m.name_ar : m.name_ar || m.name_fr;
}

function labels(locale) {
  const fr = locale === "fr";
  return {
    sheetData: fr ? "IP RNC annexes" : "IP RNC الملحقات",
    sheetStats: fr ? "Statistiques" : "الإحصاءات",
    code: fr ? "Code" : "الرمز",
    commune: fr ? "Commune" : "البلدية",
    annex: fr ? "Nom annexe" : "اسم الملحق",
    ipAuth: fr ? "IP autorisée" : "IP مصرّح",
    year: fr ? "Année autorisation" : "سنة التفويض",
    ipCount: fr ? "Nombre IP autorisées" : "عدد IP مصرّح",
    pcUsed: fr ? "PC utilisé" : "حاسوب مستخدم",
    ipReq: fr ? "IP demandée" : "IP مطلوب",
    rncStatus: fr ? "Statut autorisation" : "حالة التفويض",
    rncPending: fr ? "Demandes en attente" : "طلبات قيد الانتظار",
    rncApproved: fr ? "Lignes autorisées" : "صفوف مصرّحة",
    metric: fr ? "Indicateur" : "المؤشر",
    value: fr ? "Valeur" : "القيمة"
  };
}

function styleDataRow(row, { rncStatus, colCount }) {
  row.eachCell((cell, colNumber) => {
    cell.border = thinCellBorder();
    if (colNumber === colCount) {
      if (rncStatus === "pending") cell.fill = FILL_RNC_PENDING;
      else if (rncStatus === "approved") cell.fill = FILL_RNC_APPROVED;
      else if (rncStatus === "rejected") cell.fill = FILL_RNC_REJECTED;
    }
    cell.alignment =
      colNumber >= 3
        ? { vertical: "middle", wrapText: true, readingOrder: 1 }
        : { vertical: "middle", horizontal: "center" };
  });
}

/** @param {{ municipalities: any[]; submission: any; analytics: any }} payload */
async function buildAnnexRncWilayaExportBuffer(payload, locale) {
  const L = labels(locale);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(L.sheetData, { views: [{ rightToLeft: locale === "ar" }] });

  const headers = [
    L.code,
    L.commune,
    L.annex,
    L.ipAuth,
    L.year,
    L.ipCount,
    L.pcUsed,
    L.ipReq,
    L.rncStatus
  ];
  const colCount = headers.length;
  const headerRow = ws.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = FILL_HEADER;
    cell.border = thinCellBorder();
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  for (const block of payload.municipalities || []) {
    const m = block.municipality;
    const list = block.lines || [];
    const cname = communeName(m, locale);
    if (!list.length) {
      const row = ws.addRow([m.code, cname, "—", "—", "—", "—", "—", "—", "—"]);
      styleDataRow(row, { rncStatus: "none", colCount });
      continue;
    }
    for (const line of list) {
      const row = ws.addRow([
        m.code,
        cname,
        line.annex_name || "—",
        line.ip_authorized || "—",
        line.authorization_year || "—",
        line.authorized_ip_count || "—",
        line.pc_used || "—",
        line.ip_requested || "—",
        rncStatusLabel(line.rnc_auth_status, locale)
      ]);
      styleDataRow(row, { rncStatus: line.rnc_auth_status, colCount });
    }
  }

  ws.columns = [
    { width: 12 },
    { width: 22 },
    { width: 22 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 16 },
    { width: 16 }
  ];

  const st = wb.addWorksheet(L.sheetStats, { views: [{ rightToLeft: locale === "ar" }] });
  const an = payload.analytics || {};
  const statsRows = [
    [L.metric, L.value],
    [L.rncPending, String(an.rnc_pending ?? 0)],
    [L.rncApproved, String(an.rnc_approved ?? 0)]
  ];
  for (const [a, b] of statsRows) {
    const row = st.addRow([a, b]);
    row.getCell(1).font = { bold: a === L.metric };
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: true, readingOrder: locale === "ar" ? 2 : 1 };
    });
  }
  st.getColumn(1).width = 40;
  st.getColumn(2).width = 16;
  const stLast = st.lastRow?.number || 1;
  applyThinBordersToRange(st, 1, stLast, 1, 2);

  return wb.xlsx.writeBuffer();
}

async function buildAnnexRncMuniExportBuffer(muni, payload, locale) {
  const L = labels(locale);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(L.sheetData, { views: [{ rightToLeft: locale === "ar" }] });
  const cname = communeName(muni, locale);
  const headers = [L.code, L.commune, L.annex, L.ipAuth, L.year, L.ipCount, L.pcUsed, L.ipReq, L.rncStatus];
  const colCount = headers.length;
  const headerRow = ws.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = FILL_HEADER;
    cell.border = thinCellBorder();
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  const list = payload?.lines || [];
  if (!list.length) {
    const row = ws.addRow([muni.code, cname, "—", "—", "—", "—", "—", "—", "—"]);
    styleDataRow(row, { rncStatus: "none", colCount });
  } else {
    for (const line of list) {
      const row = ws.addRow([
        muni.code,
        cname,
        line.annex_name || "—",
        line.ip_authorized || "—",
        line.authorization_year || "—",
        line.authorized_ip_count || "—",
        line.pc_used || "—",
        line.ip_requested || "—",
        rncStatusLabel(line.rnc_auth_status, locale)
      ]);
      styleDataRow(row, { rncStatus: line.rnc_auth_status, colCount });
    }
  }

  ws.columns = [
    { width: 12 },
    { width: 22 },
    { width: 22 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 16 },
    { width: 16 }
  ];

  return wb.xlsx.writeBuffer();
}

module.exports = { buildAnnexRncWilayaExportBuffer, buildAnnexRncMuniExportBuffer };
