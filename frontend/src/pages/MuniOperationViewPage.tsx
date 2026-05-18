import { useEffect, useMemo, useState } from "react";
import { BackButton } from '../components/BackButton'
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import {
  labelColumn,
  rawFromValueJson,
  triggerBlobDownload,
} from "../operations/format";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { formatApiErrorMessage } from "../snackbar/formatApiErrorMessage";

function displayCell(c: any, raw: unknown, lang: "ar" | "fr") {
  const t = c.column_type;
  if (t === "BOOLEAN")
    return raw ? (lang === "fr" ? "Oui" : "نعم") : lang === "fr" ? "Non" : "لا";
  if (t === "NUMBER") return raw != null && raw !== "" ? String(raw) : "—";
  if (t === "TEXT") {
    const s = String(raw ?? "").trim();
    return s || "—";
  }
  if (t === "DATE") {
    const s = String(raw ?? "")
      .trim()
      .slice(0, 10);
    return s || "—";
  }
  if (t === "CHOICE") {
    const ch = (c.choices || []).find(
      (x: any) => String(x.value_key) === String(raw),
    );
    return ch ? labelColumn(ch, lang) : String(raw ?? "") || "—";
  }
  return "—";
}

function MuniOpAddDataGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MuniOperationViewPage({ token }: { token: string }) {
  const { operationId } = useParams();
  const id = Number(operationId);
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "fr" ? "fr" : "ar";
  const snack = useSnackbar();

  const [op, setOp] = useState<any | null>(null);
  const [sheetRows, setSheetRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cols = useMemo(
    () =>
      (op?.columns || [])
        .slice()
        .sort((a: any, b: any) => a.position - b.position),
    [op],
  );

  async function refresh() {
    if (!id) return;
    setError(null);
    try {
      const [o, sh] = await Promise.all([
        api.muniOperationGet(token, id),
        api.muniOperationSheetGet(token, id),
      ]);
      setOp(o.operation);
      setSheetRows(sh.sheet?.rows?.length ? sh.sheet.rows : []);
    } catch (e: unknown) {
      const raw =
        e instanceof api.ApiError
          ? e.message
          : (e as Error)?.message || "Erreur";
      const msg = formatApiErrorMessage(raw, t);
      setError(msg);
      snack.show(msg, "error");
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  async function exportXlsx() {
    if (!id) return;
    try {
      const { blob, filename } = await api.downloadMuniOperationXlsx(
        token,
        id,
        lang,
      );
      triggerBlobDownload(blob, filename);
    } catch (e: unknown) {
      const raw =
        e instanceof api.ApiError
          ? e.message
          : (e as Error)?.message || "Erreur";
      const msg = formatApiErrorMessage(raw, t);
      setError(msg);
      snack.show(msg, "error");
    }
  }

  const isArchived = op?.status === "ARCHIVE";
  const showEmptySheetCTA =
    !isArchived && cols.length > 0 && sheetRows.length === 0;

  return (
    <div className="card">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div className="title" style={{ margin: 0 }}>
            {t("operationsMuniViewTitle")} — {op?.title || "..."}
          </div>
          {op?.description ? (
            <div className="muted">{op.description}</div>
          ) : null}
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {!isArchived ? (
            <Link
              className="btn btnPrimary"
              to={`/operations/${id}`}
              style={{ gap: 10, alignItems: "center", display: "inline-flex" }}
            >
              {showEmptySheetCTA ? (
                <>
                  <MuniOpAddDataGlyph />
                  {t("operationsMuniAddDataCta")}
                </>
              ) : (
                t("edit")
              )}
            </Link>
          ) : null}
          {!showEmptySheetCTA ? (
            <button type="button" className="btn" onClick={() => exportXlsx()}>
              {t("operationsExportCommuneSheet")}
            </button>
          ) : null}
          <BackButton fallbackTo="/operations" />
        </div>
      </div>

      {isArchived ? (
        <div
          className="formFeedback formFeedback--error"
          role="status"
          style={{ marginBottom: 12 }}
        >
          {t("operationsMuniArchivedReadOnly")}
        </div>
      ) : null}

      {error ? (
        <div className="muted" role="alert">
          {error}
        </div>
      ) : null}

      {!cols.length ? (
        <div className="muted">{t("operationsNoColumns")}</div>
      ) : null}

      {cols.length > 0 && sheetRows.length === 0 ? (
        <div className="muted" style={{ marginTop: 8 }}>
          {t("operationsMuniTableEmpty")}
        </div>
      ) : null}

      {cols.length > 0 && sheetRows.length > 0 ? (
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                {cols.map((c: any) => (
                  <th key={c.id}>{labelColumn(c, lang)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheetRows.map((r: any, ri: number) => {
                const cells: Record<string, unknown> = {};
                for (const c of cols) {
                  const cell = (r.cells || []).find(
                    (x: any) => Number(x.column_id) === Number(c.id),
                  );
                  cells[c.key] = rawFromValueJson(c, cell?.value_json);
                }
                return (
                  <tr key={r.id ?? ri}>
                    <td>{ri + 1}</td>
                    {cols.map((c: any) => (
                      <td
                        key={c.id}
                        style={{
                          whiteSpace:
                            c.column_type === "TEXT" ? "pre-wrap" : undefined,
                        }}
                      >
                        {displayCell(c, cells[c.key], lang)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
