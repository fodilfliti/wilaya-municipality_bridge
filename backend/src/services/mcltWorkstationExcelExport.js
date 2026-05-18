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
    sheetData: fr ? "Données MCLT" : "بيانات MCLT",
    sheetStats: fr ? "Statistiques" : "الإحصاءات",
    code: fr ? "Code" : "الرمز",
    commune: fr ? "Commune" : "البلدية",
    ipMclt: fr ? "IP MCLT" : "IP MCLT",
    pcUsage: fr ? "Poste / utilisation" : "المنصب / الاستخدام",
    app: fr ? "Application installée" : "التطبيق المثبت",
    win: fr ? "Version Windows" : "إصدار Windows",
    pcName: fr ? "Nom PC" : "اسم الحاسوب",
    av: fr ? "Antivirus" : "مضاد الفيروسات",
    ipRnc: fr ? "IP autorisée RNC" : "IP مصرّح RNC",
    ipRncReq: fr ? "IP demandée RNC" : "IP مطلوب RNC",
    rncStatus: fr ? "Statut autorisation RNC" : "حالة تفويض RNC",
    rncPending: fr ? "Demandes RNC en attente" : "طلبات RNC قيد الانتظار",
    rncApproved: fr ? "Lignes RNC autorisées" : "صفوف RNC مصرّحة",
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
async function buildMcltWilayaExportBuffer(payload, locale) {
  const L = labels(locale);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(L.sheetData, { views: [{ rightToLeft: locale === "ar" }] });

  const headers = [
    L.code,
    L.commune,
    L.ipMclt,
    L.pcUsage,
    L.app,
    L.win,
    L.pcName,
    L.av,
    L.ipRncReq,
    L.ipRnc,
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
    const list = block.workstations || [];
    const cname = communeName(m, locale);
    if (!list.length) {
      const row = ws.addRow([m.code, cname, "—", "—", "—", "—", "—", "—", "—", "—", "—"]);
      styleDataRow(row, { rncStatus: "none", colCount });
      continue;
    }
    for (const w of list) {
      const row = ws.addRow([
        m.code,
        cname,
        w.ip_mclt || "—",
        w.pc_usage || "—",
        w.installed_application || "—",
        w.windows_version || "—",
        w.pc_name || "—",
        w.antivirus_name || "—",
        w.ip_rnc_requested || "—",
        w.ip_rnc_authorized || "—",
        rncStatusLabel(w.rnc_auth_status, locale)
      ]);
      styleDataRow(row, { rncStatus: w.rnc_auth_status, colCount });
    }
  }

  ws.columns = [
    { width: 12 },
    { width: 22 },
    { width: 16 },
    { width: 22 },
    { width: 22 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
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

async function buildMcltMuniExportBuffer(muni, payload, locale) {
  const L = labels(locale);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(L.sheetData, { views: [{ rightToLeft: locale === "ar" }] });
  const cname = communeName(muni, locale);
  const headers = [
    L.code,
    L.commune,
    L.ipMclt,
    L.pcUsage,
    L.app,
    L.win,
    L.pcName,
    L.av,
    L.ipRncReq,
    L.ipRnc,
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

  const list = payload?.workstations || [];
  if (!list.length) {
    const row = ws.addRow([muni.code, cname, "—", "—", "—", "—", "—", "—", "—", "—", "—"]);
    styleDataRow(row, { rncStatus: "none", colCount });
  } else {
    for (const w of list) {
      const row = ws.addRow([
        muni.code,
        cname,
        w.ip_mclt || "—",
        w.pc_usage || "—",
        w.installed_application || "—",
        w.windows_version || "—",
        w.pc_name || "—",
        w.antivirus_name || "—",
        w.ip_rnc_requested || "—",
        w.ip_rnc_authorized || "—",
        rncStatusLabel(w.rnc_auth_status, locale)
      ]);
      styleDataRow(row, { rncStatus: w.rnc_auth_status, colCount });
    }
  }

  ws.columns = [
    { width: 12 },
    { width: 16 },
    { width: 22 },
    { width: 22 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 16 }
  ];

  return wb.xlsx.writeBuffer();
}

module.exports = { buildMcltWilayaExportBuffer, buildMcltMuniExportBuffer };
