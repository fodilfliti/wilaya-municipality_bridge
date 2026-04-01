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

    // Report header (Arabic or French)
    if (!isFr && hasArabicFont) doc.font("ar").fontSize(18).text(ar("تقرير تقدّم تحميل الإصدار"), { align: "right" });
    else doc.font(latinFont).fontSize(16).text(isFr ? "Rapport d'avancement des telechargements" : "Version download progress report", { align: "left" });
    doc.moveDown(0.6);

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

    doc.moveDown(0.8);
    if (!isFr && hasArabicFont) {
      doc.font("ar").fontSize(12).text(ar(`عدد البلديات: ${summary.total_municipalities}`), { align: "right" });
      doc.font("ar").fontSize(12).text(ar(`بلديات حمّلت: ${summary.downloaded_municipalities}`), { align: "right" });
      doc.font("ar").fontSize(12).text(ar(`بلديات لم تحمّل بعد: ${summary.not_downloaded_municipalities}`), { align: "right" });
    } else {
      doc.font(latinFont)
        .fontSize(10)
        .text(`${isFr ? "Communes" : "Municipalities"}: ${summary.total_municipalities}`, { align: "left" });
      doc.font(latinFont)
        .fontSize(10)
        .text(`${isFr ? "Telecharge" : "Downloaded"}: ${summary.downloaded_municipalities}`, { align: "left" });
      doc.font(latinFont)
        .fontSize(10)
        .text(`${isFr ? "Non telecharge" : "Not downloaded"}: ${summary.not_downloaded_municipalities}`, { align: "left" });
    }
    doc.moveDown(0.8);

    // Visual progress bar (simple + clear in PDF)
    const total = Math.max(1, Number(summary.total_municipalities || 0));
    const downloaded = Math.max(0, Number(summary.downloaded_municipalities || 0));
    const pct = Math.max(0, Math.min(1, downloaded / total));

    const barX = 50;
    const barY = doc.y;
    const barW = 495;
    const barH = 14;
    doc.roundedRect(barX, barY, barW, barH, 6).strokeColor("#cbd5e1").lineWidth(1).stroke();
    doc.roundedRect(barX, barY, Math.max(0, barW * pct), barH, 6).fillColor("#10b981").fill();
    doc.moveDown(1.2);

    if (!isFr && hasArabicFont)
      doc.font("ar").fontSize(11).fillColor("#0f172a").text(ar(`نسبة التحميل: ${(pct * 100).toFixed(0)}%`), { align: "right" });
    else
      doc.font(latinFont)
        .fontSize(10)
        .fillColor("#0f172a")
        .text(`${isFr ? "Taux de telechargement" : "Download rate"}: ${(pct * 100).toFixed(0)}%`, { align: "left" });
    doc.moveDown(0.8);

    const downloadedRows = (rows || []).filter((r) => !!r.has_downloaded);
    const notDownloadedRows = (rows || []).filter((r) => !r.has_downloaded);

    const lineHeight = 16;
    let y = doc.y;

    function sectionHeader(titleAr, titleEn) {
      if (y > 740) {
        doc.addPage();
        y = doc.y;
      }
      if (!isFr && hasArabicFont) doc.font("ar").fontSize(12).fillColor("#0f172a").text(ar(titleAr), { align: "right" });
      else doc.font(latinFont).fontSize(11).fillColor("#0f172a").text(titleEn, { align: "left" });
      doc.moveDown(0.3);
      y = doc.y;
      doc.moveTo(50, y).lineTo(545, y).strokeColor("#e2e8f0").stroke();
      y += 8;
      doc.fillColor("#0f172a");
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
    doc.moveDown(0.8);
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

