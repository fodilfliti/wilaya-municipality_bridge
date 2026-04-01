const crypto = require("crypto");

function randomDigits(len) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += String(bytes[i] % 10);
  return out;
}

function generate8DigitCode() {
  // 8 digits, including leading zeros
  return randomDigits(8);
}

function generateUsernameFromMunicipalityCode(code) {
  const safe = String(code || "").trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  const suffix = randomDigits(4);
  return `muni_${safe}_${suffix}`.toLowerCase();
}

module.exports = { generate8DigitCode, generateUsernameFromMunicipalityCode };

