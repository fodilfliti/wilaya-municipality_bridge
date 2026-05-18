/**
 * Local calendar date YYYY-MM-DD (server timezone).
 * @param {Date} [d]
 * @returns {string}
 */
function exportDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Single path segment: strip illegal filename chars, collapse spaces to underscores.
 * @param {unknown} raw
 * @param {{ maxLen?: number; fallback?: string }} [opts]
 */
function sanitizeFilenameSegment(raw, opts = {}) {
  const maxLen = opts.maxLen ?? 120;
  const fallback = opts.fallback ?? "export";
  if (raw == null) return fallback;
  let s = String(raw)
    .replace(/[\u0000-\u001F\\/:?"<>|]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  s = s.replace(/_+/g, "_").replace(/^[_.]+|[_.]+$/g, "");
  if (!s) return fallback;
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/[_.]+$/, "");
  return s || fallback;
}

function buildWilayaOperationXlsxFilename(operationTitle, operationId) {
  const base = sanitizeFilenameSegment(operationTitle, {
    fallback: `operation_${operationId}`,
  });
  return `${base}_${exportDateString()}.xlsx`;
}

function buildWilayaSubmissionXlsxFilename(operationTitle, operationId) {
  const base = sanitizeFilenameSegment(operationTitle, {
    fallback: `operation_${operationId}`,
  });
  return `${base}_${exportDateString()}_submission.xlsx`;
}

function buildMuniOperationXlsxFilename(operationTitle, muniCode, operationId) {
  const name = sanitizeFilenameSegment(operationTitle, {
    fallback: `operation_${operationId}`,
  });
  const code = sanitizeFilenameSegment(muniCode, {
    maxLen: 50,
    fallback: "commune",
  });
  return `${name}_${exportDateString()}_${code}.xlsx`;
}

function buildBackupServerWilayaXlsxFilename() {
  return `etat_serveurs_secours_wilaya_${exportDateString()}.xlsx`;
}

function buildBackupServerMuniXlsxFilename(muniCode) {
  const code = sanitizeFilenameSegment(muniCode, { maxLen: 50, fallback: "commune" });
  return `etat_serveurs_secours_${code}_${exportDateString()}.xlsx`;
}

function buildCommuneItStaffWilayaXlsxFilename() {
  return `ingenieurs_it_communes_${exportDateString()}.xlsx`;
}

function buildCommuneItStaffMuniXlsxFilename(muniCode) {
  const code = sanitizeFilenameSegment(muniCode, { maxLen: 50, fallback: "commune" });
  return `ingenieurs_it_${code}_${exportDateString()}.xlsx`;
}

function buildMcltWilayaXlsxFilename() {
  return `postes_mclt_wilaya_${exportDateString()}.xlsx`;
}

function buildMcltMuniXlsxFilename(muniCode) {
  const code = sanitizeFilenameSegment(muniCode, { maxLen: 50, fallback: "commune" });
  return `postes_mclt_${code}_${exportDateString()}.xlsx`;
}

function buildAnnexRncWilayaXlsxFilename() {
  return `ip_rnc_annexes_wilaya_${exportDateString()}.xlsx`;
}

function buildAnnexRncMuniXlsxFilename(muniCode) {
  const code = sanitizeFilenameSegment(muniCode, { maxLen: 50, fallback: "commune" });
  return `ip_rnc_annexes_${code}_${exportDateString()}.xlsx`;
}

/**
 * RFC 6266 / 5987: UTF-8 display name + ASCII-only legacy filename for older clients.
 * @param {string} utf8Filename
 * @param {string} legacyAsciiFilename
 */
function attachmentContentDisposition(utf8Filename, legacyAsciiFilename) {
  const legacy = String(legacyAsciiFilename || "export.xlsx")
    .replace(/[\r\n"]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .slice(0, 200);
  const enc = encodeURIComponent(utf8Filename);
  return `attachment; filename="${legacy}"; filename*=UTF-8''${enc}`;
}

module.exports = {
  exportDateString,
  sanitizeFilenameSegment,
  buildWilayaOperationXlsxFilename,
  buildWilayaSubmissionXlsxFilename,
  buildMuniOperationXlsxFilename,
  buildBackupServerWilayaXlsxFilename,
  buildBackupServerMuniXlsxFilename,
  buildCommuneItStaffWilayaXlsxFilename,
  buildCommuneItStaffMuniXlsxFilename,
  buildMcltWilayaXlsxFilename,
  buildMcltMuniXlsxFilename,
  buildAnnexRncWilayaXlsxFilename,
  buildAnnexRncMuniXlsxFilename,
  attachmentContentDisposition,
};
