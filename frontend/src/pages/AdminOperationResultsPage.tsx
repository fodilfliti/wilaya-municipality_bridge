import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { BackButton } from "../components/BackButton";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { DonutChart } from "../components/DonutChart";
import { labelColumn, triggerBlobDownload } from "../operations/format";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { formatApiErrorMessage } from "../snackbar/formatApiErrorMessage";

function blockHasSubmitted(block: {
  has_submitted?: boolean;
  rows?: unknown[];
}) {
  if (typeof block.has_submitted === "boolean") return block.has_submitted;
  return Array.isArray(block.rows) && block.rows.length > 0;
}

export function AdminOperationResultsPage({ token }: { token: string }) {
  const { operationId } = useParams();
  const location = useLocation();
  const id = Number(operationId);
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "fr" ? "fr" : "ar";
  const snack = useSnackbar();

  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  async function load() {
    if (!id) return;
    setError(null);
    try {
      const res = await api.adminOperationResults(token, id);
      setData(res);
    } catch (e: unknown) {
      const raw =
        e instanceof api.ApiError
          ? e.message
          : String((e as Error)?.message || "Erreur");
      const msg = formatApiErrorMessage(raw, t);
      setError(msg);
      snack.show(msg, "error");
    }
  }

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  async function saveOperationStatus(next: "EN_COURS" | "ARCHIVE") {
    if (!id) return;
    setSavingStatus(true);
    setError(null);
    try {
      const res = await api.adminOperationPatch(token, id, { status: next });
      setData((prev: typeof data) =>
        prev
          ? { ...prev, operation: { ...prev.operation, ...res.operation } }
          : prev,
      );
      snack.show(t("snackbarSaved"), "success");
    } catch (e: unknown) {
      const raw =
        e instanceof api.ApiError
          ? e.message
          : String((e as Error)?.message || "Erreur");
      const msg = formatApiErrorMessage(raw, t);
      setError(msg);
      snack.show(msg, "error");
    } finally {
      setSavingStatus(false);
    }
  }

  const op = data?.operation;
  const cols = (op?.columns || [])
    .slice()
    .sort((a: any, b: any) => a.position - b.position);
  const municipalities = data?.municipalities || [];
  const analytics = data?.analytics || {};

  const submission = useMemo(() => {
    if (data?.submission && typeof data.submission.total === "number") {
      return data.submission as {
        total: number;
        submitted: number;
        pending: number;
      };
    }
    let submitted = 0;
    for (const b of municipalities) {
      if (blockHasSubmitted(b)) submitted += 1;
    }
    const total = municipalities.length;
    return { total, submitted, pending: total - submitted };
  }, [data?.submission, municipalities]);

  function cellValue(row: any, colKey: string) {
    const cell = (row.cells || []).find((c: any) => c.key === colKey);
    const v = cell?.value_json;
    const col = cols.find((c: any) => c.key === colKey);
    if (!col || !v) return "—";
    if (col.column_type === "BOOLEAN")
      return v.value
        ? lang === "fr"
          ? "Oui"
          : "نعم"
        : lang === "fr"
          ? "Non"
          : "لا";
    if (col.column_type === "NUMBER") return String(v.value ?? "");
    if (col.column_type === "TEXT") return String(v.value ?? "");
    if (col.column_type === "DATE") return v.value ? String(v.value) : "—";
    if (col.column_type === "CHOICE") {
      const ch = (col.choices || []).find(
        (x: any) => String(x.value_key) === String(v.value_key),
      );
      return ch ? labelColumn(ch, lang) : String(v.value_key || "");
    }
    return "—";
  }

  function cellHighlightStyle(row: any, col: any): CSSProperties | undefined {
    const cell = (row.cells || []).find((c: any) => c.key === col.key);
    const v = cell?.value_json;
    if (!v || !col) return undefined;
    if (col.column_type === "BOOLEAN") {
      return {
        background: v.value ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.12)",
      };
    }
    if (col.column_type === "CHOICE") {
      const ch = (col.choices || []).find(
        (x: any) => String(x.value_key) === String(v.value_key),
      );
      if (ch?.color_hex && /^#[0-9A-Fa-f]{6}$/.test(String(ch.color_hex))) {
        return { background: `${ch.color_hex}26` };
      }
    }
    return undefined;
  }

  async function exportXlsx() {
    if (!id) return;
    const { blob, filename } = await api.downloadAdminOperationXlsx(
      token,
      id,
      lang,
    );
    triggerBlobDownload(blob, filename);
  }

  async function exportSubmissionXlsx() {
    if (!id) return;
    const { blob, filename } = await api.downloadAdminOperationSubmissionXlsx(
      token,
      id,
      lang,
    );
    triggerBlobDownload(blob, filename);
  }

  /** First data column ~30% narrower than a typical equal split: bias code column smaller. */
  const codeColStyle: CSSProperties = {
    width: "11%",
    maxWidth: 113,
    whiteSpace: "nowrap",
  };

  const resultsBackTarget = (
    location.state as { resultsBackTarget?: "list" | "detail" } | null
  )?.resultsBackTarget;
  const backHref =
    resultsBackTarget === "detail" && Number.isFinite(id) && id > 0
      ? `/operations/${id}`
      : "/operations";

  return (
    <div className="card">
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: 12 }}
      >
        <div className="title" style={{ margin: 0 }}>
          {t("operationsResults")} — {op?.title || "..."}
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btnExcel"
            onClick={() =>
              exportXlsx().catch((e: unknown) => {
                const raw =
                  e instanceof api.ApiError
                    ? e.message
                    : String((e as Error)?.message || "Erreur");
                const msg = formatApiErrorMessage(raw, t);
                setError(msg);
                snack.show(msg, "error");
              })
            }
          >
            {t("operationsExportWilayaFullSheet")}
          </button>
          <BackButton fallbackTo={backHref} />
        </div>
      </div>

      {error ? <div className="muted">{error}</div> : null}

      <div className="title" style={{ marginTop: 16, fontSize: 16 }}>
        {t("operationsStatus")}
      </div>
      <div
        className="row"
        style={{ marginTop: 8, alignItems: "center", gap: 10 }}
      >
        <select
          className="input"
          style={{ maxWidth: 220 }}
          disabled={savingStatus || !op}
          value={op?.status === "ARCHIVE" ? "ARCHIVE" : "EN_COURS"}
          onChange={(e) =>
            saveOperationStatus(e.target.value as "EN_COURS" | "ARCHIVE")
          }
        >
          <option value="EN_COURS">{t("operationsStatusEnCours")}</option>
          <option value="ARCHIVE">{t("operationsStatusArchive")}</option>
        </select>
      </div>

      <div className="title" style={{ marginTop: 18, fontSize: 16 }}>
        {t("operationsDataTable")}
      </div>
      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table className="table">
          <colgroup>
            <col style={{ width: "11%", maxWidth: 113 }} />
            <col />
            {cols.map((c: any) => (
              <col key={c.id} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={codeColStyle}>{t("municipalityCode")}</th>
              <th>
                {lang === "fr"
                  ? t("municipalityNameFr")
                  : t("municipalityNameAr")}
              </th>
              {cols.map((c: any) => (
                <th key={c.id}>{labelColumn(c, lang)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {municipalities.flatMap((block: any) => {
              const m = block.municipality;
              const submitted = blockHasSubmitted(block);
              const rows = submitted
                ? block.rows || []
                : [{ row_index: 0, cells: [] }];
              const rowBg: CSSProperties | undefined = submitted
                ? undefined
                : { background: "#fff7ed" };
              return rows.map((row: any, idx: number) => (
                <tr key={`${m.id}-${row.row_index}-${idx}`} style={rowBg}>
                  <td style={codeColStyle}>{m.code}</td>
                  <td>{lang === "fr" ? m.name_fr : m.name_ar}</td>
                  {cols.map((c: any) => (
                    <td key={c.id} style={cellHighlightStyle(row, c)}>
                      {cellValue(row, c.key)}
                    </td>
                  ))}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      <div
        className="row"
        style={{
          marginTop: 24,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div className="title" style={{ margin: 0, fontSize: 16 }}>
          {t("operationsSubmissionChart")}
        </div>
        <button
          type="button"
          className="btn btnExcel"
          onClick={() =>
            exportSubmissionXlsx().catch((e: unknown) => {
              const raw =
                e instanceof api.ApiError
                  ? e.message
                  : String((e as Error)?.message || "Erreur");
              const msg = formatApiErrorMessage(raw, t);
              setError(msg);
              snack.show(msg, "error");
            })
          }
        >
          {t("operationsExportWilayaSubmissionSheet")}
        </button>
      </div>
      {submission.total > 0 ? (
        <div
          className="row"
          style={{
            marginTop: 12,
            justifyContent: "flex-start",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <DonutChart
            value={submission.submitted}
            total={submission.total}
            label={t("operationsSubmittedCommunes")}
            progressColor="rgba(16,185,129,0.95)"
          />
          <DonutChart
            value={submission.pending}
            total={submission.total}
            label={t("operationsPendingCommunes")}
            progressColor="rgba(249,115,22,0.9)"
          />
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 8 }}>
          —
        </div>
      )}

      <div className="title" style={{ marginTop: 24, fontSize: 16 }}>
        {t("operationsAnalytics")}
      </div>
      <div className="grid" style={{ marginTop: 10 }}>
        {Object.entries(analytics).map(([key, a]: [string, any]) => {
          const col = cols.find((c: any) => c.key === key);
          const title = col ? labelColumn(col, lang) : key;
          if (a.kind === "BOOLEAN") {
            const total = a.total || 0;
            if (!total) {
              return (
                <div key={key} className="card cardSubtle">
                  <div style={{ fontWeight: 700 }}>{title}</div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    —
                  </div>
                </div>
              );
            }
            return (
              <div key={key} className="card cardSubtle">
                <div style={{ fontWeight: 700 }}>{title}</div>
                <div
                  className="row"
                  style={{
                    marginTop: 10,
                    justifyContent: "flex-start",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <DonutChart
                    value={a.true_count}
                    total={total}
                    label={lang === "fr" ? "Oui" : "نعم"}
                    progressColor="rgba(16,185,129,0.95)"
                  />
                  <DonutChart
                    value={a.false_count}
                    total={total}
                    label={lang === "fr" ? "Non" : "لا"}
                    progressColor="rgba(239,68,68,0.85)"
                  />
                </div>
              </div>
            );
          }
          if (a.kind === "NUMBER") {
            const fmt = (n: unknown) => {
              if (n == null || !Number.isFinite(Number(n))) return "—";
              const x = Number(n);
              return Number.isInteger(x) ? String(x) : x.toFixed(2);
            };
            const count = Number(a.count ?? 0);
            const avgN = Number(a.avg);
            const derived =
              count > 0 && Number.isFinite(avgN) ? avgN * count : null;
            const declaredRaw = a.sum;
            const declared =
              declaredRaw != null &&
              declaredRaw !== "" &&
              Number.isFinite(Number(declaredRaw))
                ? Number(declaredRaw)
                : null;
            let sumNum = 0;
            if (declared != null) sumNum = declared;
            if (derived != null && Number.isFinite(derived)) {
              if (declared == null || Math.abs(declared - derived) > 1e-4)
                sumNum = derived;
            }
            const sumStr = fmt(sumNum);
            const avgStr = fmt(a.avg);
            return (
              <div key={key} className="card cardSubtle">
                <div style={{ fontWeight: 700 }}>{title}</div>
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gap: 6,
                    fontSize: 14,
                    lineHeight: 1.45,
                  }}
                >
                  <div>
                    {t("operationsAnalyticsNumberCount", {
                      count: a.count ?? 0,
                    })}
                  </div>
                  <div className="muted">
                    {t("operationsAnalyticsNumberSum", { v: sumStr })}
                  </div>
                  <div className="muted">
                    {t("operationsAnalyticsNumberMin", { v: fmt(a.min) })}
                  </div>
                  <div className="muted">
                    {t("operationsAnalyticsNumberMax", { v: fmt(a.max) })}
                  </div>
                  <div className="muted">
                    {t("operationsAnalyticsNumberAvg", { v: avgStr })}
                  </div>
                </div>
              </div>
            );
          }
          if (a.kind === "CHOICE") {
            const counts = (a.counts || {}) as Record<string, number>;
            const definedChoices = (col?.choices || [])
              .slice()
              .sort((x: any, y: any) => (x.position ?? 0) - (y.position ?? 0));
            const seen = new Set<string>();
            const rows: { vk: string; cnt: number; ch: any | null }[] = [];
            for (const ch of definedChoices) {
              const vk = String(ch.value_key);
              seen.add(vk);
              rows.push({ vk, cnt: Number(counts[vk] ?? 0), ch });
            }
            for (const vk of Object.keys(counts)) {
              if (seen.has(vk)) continue;
              const ch =
                (col?.choices || []).find(
                  (x: any) => String(x.value_key) === vk,
                ) || null;
              rows.push({ vk, cnt: Number(counts[vk] ?? 0), ch });
            }
            if (!rows.length) {
              return (
                <div key={key} className="card cardSubtle">
                  <div style={{ fontWeight: 700 }}>{title}</div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    —
                  </div>
                </div>
              );
            }
            const total = Math.max(
              0,
              Number(a.total) || rows.reduce((s, r) => s + r.cnt, 0),
            );
            return (
              <div key={key} className="card cardSubtle">
                <div style={{ fontWeight: 700 }}>{title}</div>
                <div
                  style={{
                    display: "flex",
                    height: 28,
                    borderRadius: 8,
                    overflow: "hidden",
                    width: "100%",
                    marginTop: 10,
                    border: "1px solid rgba(15,23,42,0.08)",
                  }}
                >
                  {rows.map(({ vk, cnt, ch }) => {
                    const c = cnt;
                    const bg =
                      ch?.color_hex &&
                      /^#[0-9A-Fa-f]{6}$/.test(String(ch.color_hex))
                        ? String(ch.color_hex)
                        : "#94a3b8";
                    const lab = ch ? labelColumn(ch, lang) : vk;
                    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                    const flexGrow = total > 0 ? Math.max(c, 0) : 1;
                    const minW =
                      total > 0
                        ? c > 0
                          ? 3
                          : 2
                        : Math.max(4, Math.floor(80 / rows.length));
                    return (
                      <div
                        key={vk}
                        title={`${lab}: ${c}/${total} (${pct}%)`}
                        style={{
                          flexGrow,
                          flexBasis: 0,
                          minWidth: minW,
                          background: c > 0 ? bg : `${bg}55`,
                          boxSizing: "border-box",
                          borderInlineEnd: "1px solid rgba(255,255,255,0.35)",
                        }}
                      />
                    );
                  })}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px 20px",
                    marginTop: 12,
                    alignItems: "center",
                  }}
                >
                  {rows.map(({ vk, cnt, ch }) => {
                    const lab = ch ? labelColumn(ch, lang) : vk;
                    const c = cnt;
                    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                    const bg =
                      ch?.color_hex &&
                      /^#[0-9A-Fa-f]{6}$/.test(String(ch.color_hex))
                        ? String(ch.color_hex)
                        : "#94a3b8";
                    return (
                      <div
                        key={`${vk}-legend`}
                        className="row"
                        style={{ gap: 8, alignItems: "center" }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: bg,
                            flexShrink: 0,
                            opacity: c > 0 ? 1 : 0.45,
                          }}
                        />
                        <span className="muted" style={{ fontSize: 13 }}>
                          {t("operationsAnalyticsChoiceLegend", {
                            label: lab,
                            count: c,
                            total,
                            pct,
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
