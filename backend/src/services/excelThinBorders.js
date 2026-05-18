/**
 * Shared Excel (.xlsx) cell borders for server-side exports (ExcelJS).
 * @see spec/CORE.md — Excel export (cross-cutting pattern)
 */

const BORDER_THIN = { style: "thin", color: { argb: "FFBBBBBB" } };

function thinCellBorder() {
  return {
    top: BORDER_THIN,
    left: BORDER_THIN,
    bottom: BORDER_THIN,
    right: BORDER_THIN,
  };
}

/**
 * Apply {@link thinCellBorder} to every cell in the inclusive rectangle (1-based row/column indices).
 * @param {import("exceljs").Worksheet} ws
 */
function applyThinBordersToRange(ws, rowStart, rowEnd, colStart, colEnd) {
  const r0 = Math.max(1, rowStart);
  const r1 = Math.max(r0, rowEnd);
  const c0 = Math.max(1, colStart);
  const c1 = Math.max(c0, colEnd);
  for (let r = r0; r <= r1; r++) {
    const row = ws.getRow(r);
    for (let c = c0; c <= c1; c++) {
      row.getCell(c).border = thinCellBorder();
    }
  }
}

module.exports = {
  BORDER_THIN,
  thinCellBorder,
  applyThinBordersToRange,
};
