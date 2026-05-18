const ExcelJS = require("exceljs");
const { thinCellBorder, applyThinBordersToRange } = require("./excelThinBorders");

function fillSolid(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

const FILL_BOOL_TRUE = fillSolid("FFD1FAE5");
const FILL_BOOL_FALSE = fillSolid("FFFEE2E2");
const FILL_HEADER = fillSolid("FFE5E7EB");
const FILL_ANOMALY = fillSolid("FFFEF3C7");

function yn(v, locale) {
  if (v) return locale === "fr" ? "Oui" : "نعم";
  return locale === "fr" ? "Non" : "لا";
}

function communeName(m, locale) {
  return locale === "fr" ? m.name_fr || m.name_ar : m.name_ar || m.name_fr;
}

function labels(locale) {
  const fr = locale === "fr";
  return {
    sheetData: fr ? "Données" : "البيانات",
    sheetStats: fr ? "Statistiques" : "الإحصاءات",
    code: fr ? "Code" : "الرمز",
    commune: fr ? "Commune" : "البلدية",
    existe: fr ? "Serveur de secours existant" : "وجود خادم احتياطي",
    serverType: fr ? "Type de serveur" : "نوع الخادم",
    configured: fr ? "Configuré" : "مهيأ",
    osType: fr ? "Système d’exploitation" : "نظام التشغيل",
    osActive: fr ? "OS actif" : "نظام التشغيل نشط",
    anomalie: fr ? "Anomalie détectée" : "خلل مكتشف",
    metric: fr ? "Indicateur" : "المؤشر",
    value: fr ? "Valeur" : "القيمة",
    existeY: fr ? "Oui (existe)" : "نعم (موجود)",
    existeN: fr ? "Non (n’existe pas)" : "لا (غير موجود)",
    confY: fr ? "Configuré : oui" : "مهيأ: نعم",
    confN: fr ? "Configuré : non" : "مهيأ: لا",
    osAY: fr ? "OS actif : oui" : "نظام نشط: نعم",
    osAN: fr ? "OS actif : non" : "نظام نشط: لا",
    anomalies: fr ? "Communes avec anomalie renseignée" : "بلديات بخلل مذكور"
  };
}

/** @param {{ municipalities: any[]; submission: any; analytics: any }} payload */
async function buildBackupServerWilayaExportBuffer(payload, locale) {
  const L = labels(locale);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(L.sheetData, { views: [{ rightToLeft: locale === "ar" }] });

  const headers = [
    L.code,
    L.commune,
    L.existe,
    L.serverType,
    L.configured,
    L.osType,
    L.osActive,
    L.anomalie
  ];
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
    const servers =
      Array.isArray(block.servers) && block.servers.length > 0
        ? block.servers
        : block.status
          ? [block.status]
          : [{}];
    const cname = communeName(m, locale);
    for (const s of servers) {
      const row = ws.addRow([
        m.code,
        cname,
        yn(Boolean(s.existe), locale),
        s.server_type || "—",
        yn(Boolean(s.configured), locale),
        s.os_type || "—",
        yn(Boolean(s.os_active), locale),
        s.anomalie || "—"
      ]);
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.border = thinCellBorder();
        if (colNumber === 3 || colNumber === 5 || colNumber === 7) {
          const v = colNumber === 3 ? s.existe : colNumber === 5 ? s.configured : s.os_active;
          cell.fill = v ? FILL_BOOL_TRUE : FILL_BOOL_FALSE;
        }
        if (colNumber === 8 && String(s.anomalie || "").trim()) cell.fill = FILL_ANOMALIE;
        cell.alignment =
          colNumber === 4 || colNumber === 6 || colNumber === 8
            ? { vertical: "middle", wrapText: true, readingOrder: locale === "ar" ? 2 : 1 }
            : { vertical: "middle", horizontal: "center" };
      });
    }
  }

  ws.columns = [
    { width: 12 },
    { width: 22 },
    { width: 14 },
    { width: 22 },
    { width: 12 },
    { width: 22 },
    { width: 12 },
    { width: 36 }
  ];

  const st = wb.addWorksheet(L.sheetStats, { views: [{ rightToLeft: locale === "ar" }] });
  const an = payload.analytics || {};
  const statsRows = [
    [L.metric, L.value],
    [L.existeY, String(an.existe?.yes ?? 0)],
    [L.existeN, String(an.existe?.no ?? 0)],
    [L.confY, String(an.configured?.yes ?? 0)],
    [L.confN, String(an.configured?.no ?? 0)],
    [L.osAY, String(an.os_active?.yes ?? 0)],
    [L.osAN, String(an.os_active?.no ?? 0)],
    [L.anomalies, String(an.anomalies_nonempty ?? 0)]
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

async function buildBackupServerMuniExportBuffer(muni, payload, locale) {
  const L = labels(locale);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(L.sheetData, { views: [{ rightToLeft: locale === "ar" }] });
  const headers = [L.code, L.commune, L.existe, L.serverType, L.configured, L.osType, L.osActive, L.anomalie];
  const headerRow = ws.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = FILL_HEADER;
    cell.border = thinCellBorder();
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  const servers =
    Array.isArray(payload?.servers) && payload.servers.length > 0 ? payload.servers : [{}];
  const cname = communeName(muni, locale);
  for (const s of servers) {
    const row = ws.addRow([
      muni.code,
      cname,
      yn(Boolean(s.existe), locale),
      s.server_type || "—",
      yn(Boolean(s.configured), locale),
      s.os_type || "—",
      yn(Boolean(s.os_active), locale),
      s.anomalie || "—"
    ]);
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.border = thinCellBorder();
      if (colNumber === 3 || colNumber === 5 || colNumber === 7) {
        const v = colNumber === 3 ? s.existe : colNumber === 5 ? s.configured : s.os_active;
        cell.fill = v ? FILL_BOOL_TRUE : FILL_BOOL_FALSE;
      }
      if (colNumber === 9 && String(s.anomalie || "").trim()) cell.fill = FILL_ANOMALY;
      cell.alignment =
        colNumber === 5 || colNumber === 7 || colNumber === 9
          ? { vertical: "middle", wrapText: true, readingOrder: locale === "ar" ? 2 : 1 }
          : { vertical: "middle", horizontal: "center" };
    });
  }
  ws.columns = [
    { width: 12 },
    { width: 22 },
    { width: 14 },
    { width: 22 },
    { width: 12 },
    { width: 22 },
    { width: 12 },
    { width: 36 }
  ];
  return wb.xlsx.writeBuffer();
}

module.exports = {
  buildBackupServerWilayaExportBuffer,
  buildBackupServerMuniExportBuffer
};
