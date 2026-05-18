"use strict";

function hslToRgb(hDeg, sPct, lPct) {
  const h = hDeg / 360;
  const s = sPct / 100;
  const l = lPct / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function toHex([r, g, b]) {
  const x = (n) => n.toString(16).padStart(2, "0");
  return `#${x(r)}${x(g)}${x(b)}`.toUpperCase();
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkDelete("operation_palette_colors", null, {});

    const rows = [];
    for (let i = 0; i < 100; i++) {
      const h = (i * 137.508) % 360;
      rows.push({
        palette_index: i,
        hex: toHex(hslToRgb(h, 62, 52)),
        created_at: new Date()
      });
    }
    await queryInterface.bulkInsert("operation_palette_colors", rows, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("operation_palette_colors", null, {});
  }
};
