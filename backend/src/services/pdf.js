const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const reshaper = require("arabic-persian-reshaper");
const bidiFactory = require("bidi-js");

const { storageRoot } = require("./storage");

function resolveAmiriFontPath() {
  // @fontsource/amiri ships web font formats in npm (woff/woff2).
  // PDFKit/fontkit support for woff/woff2 is inconsistent across environments.
  // For reliability, only use TTF/OTF for PDF generation (when available).
  const candidates = [
    "@fontsource/amiri/files/amiri-arabic-400-normal.ttf" // in case future versions add TTF
  ];
  for (const c of candidates) {
    try {
      return require.resolve(c);
    } catch (e) {
      // ignore and try next
    }
  }
  return null;
}

function resolveSystemArabicFontPath() {
  // Prefer Windows system fonts when running on Windows (common in this project).
  // This avoids shipping binary font files in the repository.
  const winDir = process.env.WINDIR || "C:\\Windows";
  const fontsDir = path.join(winDir, "Fonts");
  const candidates = [
    path.join(fontsDir, "arial.ttf"),
    path.join(fontsDir, "tahoma.ttf"),
    path.join(fontsDir, "times.ttf"),
    path.join(fontsDir, "calibri.ttf")
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

function tryRegisterLatinFont(doc) {
  const fontPath = resolveSystemArabicFontPath();
  if (!fontPath) return false;
  try {
    doc.registerFont("lat", fontPath);
    return true;
  } catch (e) {
    return false;
  }
}

function tryRegisterArabicFont(doc) {
  const fontPath = resolveAmiriFontPath() || resolveSystemArabicFontPath();
  if (!fontPath) return false;
  try {
    doc.registerFont("ar", fontPath);
    return true;
  } catch (e) {
    return false;
  }
}

function ar(text) {
  const s = String(text == null ? "" : text);
  // Arabic shaping + bidi reordering for PDFKit
  const reshaped = reshaper?.ArabicShaper?.convertArabic ? reshaper.ArabicShaper.convertArabic(s) : s;
  try {
    const bidi = bidiFactory();
    // bidi-js exposes getReorderedString (not getDisplayString)
    if (bidi && typeof bidi.getReorderedString === "function") return bidi.getReorderedString(reshaped);
  } catch (e) {
    // Some bidi-js builds can throw on certain inputs/environments.
    // Shaping + right alignment is still preferable to crashing PDF generation.
  }
  return reshaped;
}

function writePdfToFile(buildDoc, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = fs.createWriteStream(outPath);
    stream.on("finish", () => resolve(outPath));
    stream.on("error", reject);
    doc.pipe(stream);
    buildDoc(doc);
    doc.end();
  });
}

async function generateCredentialsPdf({
  username,
  code8,
  municipalityNameAr,
  municipalityNameFr,
  municipalityCode
}) {
  const fileName = `credentials_${municipalityCode || "muni"}_${Date.now()}.pdf`;
  const abs = path.join(storageRoot(), "pdf", fileName);

  await writePdfToFile((doc) => {
    const hasArabicFont = tryRegisterArabicFont(doc);

    doc.fontSize(18).text("Wilaya - Municipality Credentials", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(12).text("Arabic / Français", { align: "left" });
    doc.moveDown(1.2);

    if (municipalityNameAr) {
      if (hasArabicFont) doc.font("ar").fontSize(14).text(ar(`البلدية: ${municipalityNameAr}`), { align: "right" });
      else doc.font("Helvetica").fontSize(12).text(`Municipality (AR): ${municipalityNameAr}`, { align: "left" });
    }
    doc.font("Helvetica");
    if (municipalityNameFr) doc.fontSize(12).text(`Commune: ${municipalityNameFr}`, { align: "left" });
    if (municipalityCode) doc.fontSize(12).text(`Code: ${municipalityCode}`, { align: "left" });
    doc.moveDown(1.2);

    doc.fontSize(14).text(`Username: ${username}`, { align: "left" });
    doc.fontSize(14).text(`8-digit code: ${code8}`, { align: "left" });

    doc.moveDown(2);
    doc.fontSize(10).text(
      "Note: This code should be treated as confidential. The user must change credentials after first login if you enforce that in UI.",
      { align: "left" }
    );
  }, abs);

  return {
    file_abs_path: abs,
    file_url: `/files/pdf/${fileName}`
  };
}

async function generateVersionProgressPdf({ appName, versionNumber, generatedBy, summary, rows, lang }) {
  const safeApp = String(appName || "app").replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 40) || "app";
  const safeVer = String(versionNumber || "version").replace(/[^a-zA-Z0-9_\-\.]/g, "_").slice(0, 30) || "version";
  const fileName = `rapport_progress_${safeApp}_${safeVer}_${Date.now()}.pdf`;
  const abs = path.join(storageRoot(), "pdf", fileName);

  await writePdfToFile((doc) => {
    const now = new Date();
    const hasArabicFont = tryRegisterArabicFont(doc);
    const isFr = String(lang || "").toLowerCase() === "fr";
    const hasLatinFont = tryRegisterLatinFont(doc);
    const latinFont = hasLatinFont ? "lat" : "Helvetica";

    // Report header (Arabic or French) - centered
    if (!isFr && hasArabicFont) doc.font("ar").fontSize(18).text(ar("تقرير تقدّم تحميل الإصدار"), { align: "center" });
    else doc.font(latinFont).fontSize(16).text(isFr ? "Rapport d'avancement des telechargements" : "Version download progress report", { align: "center" });
    doc.moveDown(0.9);

    if (!isFr && hasArabicFont) {
      doc.font("ar").fontSize(12).text(ar(`التطبيق: ${appName || "-"}`), { align: "right" });
      doc.font("ar").fontSize(12).text(ar(`الإصدار: ${versionNumber || "-"}`), { align: "right" });
      doc.font("ar").fontSize(10).text(ar(`تاريخ الإنشاء: ${now.toLocaleString()}`), { align: "right" });
      if (generatedBy) doc.font("ar").fontSize(10).text(ar(`تم الإنشاء بواسطة: ${generatedBy}`), { align: "right" });
    } else {
      doc.font(latinFont).fontSize(11).text(`App: ${appName || "-"}`, { align: "left" });
      doc.font(latinFont).fontSize(11).text(`Version: ${versionNumber || "-"}`, { align: "left" });
      doc.font(latinFont).fontSize(9).text(`${isFr ? "Genere le" : "Generated at"}: ${now.toLocaleString()}`, { align: "left" });
      if (generatedBy) doc.font(latinFont).fontSize(9).text(`${isFr ? "Genere par" : "Generated by"}: ${generatedBy}`, { align: "left" });
    }

    const total = Math.max(1, Number(summary.total_municipalities || 0));
    const downloaded = Math.max(0, Number(summary.downloaded_municipalities || 0));
    const notDownloaded = Math.max(0, Number(summary.not_downloaded_municipalities || 0));
    const pct = Math.max(0, Math.min(1, downloaded / total));

    // Colored statistics block (graph + badges)
    const statsTop = doc.y;
    const statsX = 50;
    const statsW = 495;
    const statsH = 150;

    doc.roundedRect(statsX, statsTop, statsW, statsH, 12).strokeColor("#e2e8f0").lineWidth(1).stroke();

    // Donut chart (downloaded vs not downloaded)
    const cx = statsX + 62;
    const cy = statsTop + 62;
    const r = 36;
    const sw = 10;

    // Track
    doc.circle(cx, cy, r).strokeColor("#e5e7eb").lineWidth(sw).stroke();

    // Two arcs so the ring is "percentage", not all-green
    const startDeg = -90;
    const notPct = Math.max(0, Math.min(1, notDownloaded / total));
    const notEndDeg = startDeg + 360 * notPct;
    const dlEndDeg = notEndDeg + 360 * pct;

    if (notPct > 0) {
      doc.save();
      doc.strokeColor("#ef4444").lineWidth(sw).lineCap("round");
      doc.arc(cx, cy, r, startDeg, notEndDeg).stroke();
      doc.restore();
    }

    if (pct > 0) {
      doc.save();
      doc.strokeColor("#10b981").lineWidth(sw).lineCap("round");
      doc.arc(cx, cy, r, notEndDeg, dlEndDeg).stroke();
      doc.restore();
    }

    // Center percent text
    doc.font(latinFont).fillColor("#0f172a").fontSize(16).text(`${(pct * 100).toFixed(0)}%`, cx - 20, cy - 10, {
      width: 40,
      align: "center"
    });

    // Right-side badges
    const badgeX = statsX + 140;
    const badgeY = statsTop + 16;
    const badgeGap = 10;
    const badgeH = 22;

    function badge(y, fillHex, borderHex, text) {
      // PDFKit doesn't reliably parse CSS rgba() strings; use hex + opacity.
      doc.save();
      doc.fillColor(fillHex).fillOpacity(0.12);
      doc.roundedRect(badgeX, y, 320, badgeH, 999).fill();
      doc.restore();

      doc.save();
      doc.strokeColor(borderHex).strokeOpacity(0.35).lineWidth(1);
      doc.roundedRect(badgeX, y, 320, badgeH, 999).stroke();
      doc.restore();

      doc.fillColor("#0f172a").font(latinFont).fontSize(10).text(text, badgeX + 12, y + 6, { width: 296, align: "left" });
    }

    const totalLabel = isFr ? `Communes: ${total}` : `Municipalities: ${total}`;
    const downloadedLabel = isFr ? `Telecharge: ${downloaded}` : `Downloaded: ${downloaded}`;
    const notDownloadedLabel = isFr ? `Non telecharge: ${notDownloaded}` : `Not downloaded: ${notDownloaded}`;
    const rateLabel = isFr ? `Taux de telechargement: ${(pct * 100).toFixed(0)}%` : `Download rate: ${(pct * 100).toFixed(0)}%`;

    badge(badgeY + 0 * (badgeH + badgeGap), "#94a3b8", "#94a3b8", totalLabel);
    badge(badgeY + 1 * (badgeH + badgeGap), "#10b981", "#10b981", downloadedLabel);
    badge(badgeY + 2 * (badgeH + badgeGap), "#ef4444", "#ef4444", notDownloadedLabel);
    badge(badgeY + 3 * (badgeH + badgeGap), "#1d4ed8", "#1d4ed8", rateLabel);

    // Continue after statistics block (no extra progress bar)
    doc.y = statsTop + statsH + 30;
    doc.moveDown(0.4);

    const downloadedRows = (rows || []).filter((r) => !!r.has_downloaded);
    const notDownloadedRows = (rows || []).filter((r) => !r.has_downloaded);

    const lineHeight = 16;
    let y = doc.y;

    function sectionHeader(titleAr, titleEn) {
      if (y > 740) {
        doc.addPage();
        y = doc.y;
      }
      // Header strip (cleaner than double separators)
      const stripY = doc.y;
      doc.save();
      doc.fillColor("#e2e8f0").fillOpacity(0.55);
      doc.roundedRect(50, stripY - 2, 495, 20, 8).fill();
      doc.restore();

      if (!isFr && hasArabicFont) doc.font("ar").fontSize(12).fillColor("#0f172a").text(ar(titleAr), 60, stripY + 2, { width: 475, align: "right" });
      else doc.font(latinFont).fontSize(11).fillColor("#0f172a").text(titleEn, 60, stripY + 3, { width: 475, align: "left" });

      doc.moveDown(1.1);
      y = doc.y;
    }

    function renderRows(list, opts) {
      list.forEach((r, i) => {
        if (y > 760) {
          doc.addPage();
          y = doc.y;
          sectionHeader(opts.titleAr, opts.titleEn);
        }

        const muni = r.municipality || {};
        const last = r.last_download_at ? new Date(r.last_download_at).toLocaleString() : "—";

        if (!isFr && hasArabicFont) {
          const line = opts.showLast
            ? `${i + 1}) ${muni.name_ar || ""} — الكود: ${muni.code || ""} — آخر تحميل: ${last}`
            : `${i + 1}) ${muni.name_ar || ""} — الكود: ${muni.code || ""}`;
          doc.font("ar").fontSize(10).text(ar(line), 50, y, { width: 495, align: "right" });
        } else {
          const line = opts.showLast
            ? `${i + 1}) ${muni.name_fr || muni.name_ar || ""} - code: ${muni.code || ""} - ${isFr ? "dernier" : "last"}: ${last}`
            : `${i + 1}) ${muni.name_fr || ""} - code: ${muni.code || ""}`;
          doc.font(latinFont).fontSize(9).text(line, 50, y, { width: 495, align: "left" });
        }
        y += lineHeight;
      });
    }

    sectionHeader(
      `قائمة البلديات التي حمّلت هذا الإصدار (${downloadedRows.length})`,
      `${isFr ? "Communes ayant téléchargé" : "Downloaded municipalities"} (${downloadedRows.length})`
    );
    renderRows(downloadedRows, {
      titleAr: "قائمة البلديات التي حمّلت هذا الإصدار",
      titleEn: isFr ? "Communes ayant téléchargé" : "Downloaded municipalities",
      showLast: true
    });
    doc.moveDown(1.3);
    y = doc.y;

    sectionHeader(
      `قائمة البلديات التي لم تحمّل بعد (${notDownloadedRows.length})`,
      `${isFr ? "Communes non téléchargées" : "Not downloaded yet"} (${notDownloadedRows.length})`
    );
    renderRows(notDownloadedRows, {
      titleAr: "قائمة البلديات التي لم تحمّل بعد",
      titleEn: isFr ? "Communes non téléchargées" : "Not downloaded yet",
      showLast: false
    });
  }, abs);

  return {
    file_abs_path: abs,
    file_url: `/files/pdf/${fileName}`
  };
}

module.exports = { generateCredentialsPdf, generateVersionProgressPdf };

