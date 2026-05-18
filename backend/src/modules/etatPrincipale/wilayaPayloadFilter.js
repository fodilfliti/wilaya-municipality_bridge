function parseMunicipalityIdFilter(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function filterWilayaByMunicipality(payload, municipalityId, computeAnalytics) {
  if (!municipalityId) return payload;
  const municipalities = (payload.municipalities || []).filter(
    (b) => b.municipality && Number(b.municipality.id) === municipalityId
  );
  const total = municipalities.length;
  const submitted = municipalities.filter((x) => x.has_submitted).length;
  const out = {
    ...payload,
    municipalities,
    submission: { total, submitted, pending: total - submitted }
  };
  if (typeof computeAnalytics === "function") {
    out.analytics = computeAnalytics(municipalities);
  }
  return out;
}

/** Transmission (`submit`) is commune-only; wilaya admin PATCH must not change it. */
function bodyWithoutWilayaTransmission(body) {
  if (!body || typeof body !== "object") return body;
  const { submit: _omit, ...rest } = body;
  return rest;
}

module.exports = {
  parseMunicipalityIdFilter,
  filterWilayaByMunicipality,
  bodyWithoutWilayaTransmission
};
