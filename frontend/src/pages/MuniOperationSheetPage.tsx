import { useEffect, useState } from "react";
import { BackButton } from '../components/BackButton'
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import {
  defaultRawForColumn,
  labelColumn,
  rawFromValueJson,
  triggerBlobDownload,
} from "../operations/format";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { formatApiErrorMessage } from "../snackbar/formatApiErrorMessage";

type RowState = {
  key: string;
  row_index: number;
  cells: Record<string, unknown>;
};

function mkUid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function MuniOperationSheetPage({ token }: { token: string }) {
  const { operationId } = useParams();
  const navigate = useNavigate();
  const id = Number(operationId);
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "fr" ? "fr" : "ar";
  const snack = useSnackbar();

  const [op, setOp] = useState<any | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cols = (op?.columns || [])
    .slice()
    .sort((a: any, b: any) => a.position - b.position);
  const isArchived = op?.status === "ARCHIVE";

  async function refresh() {
    if (!id) return;
    setError(null);
    try {
      const [o, sh] = await Promise.all([
        api.muniOperationGet(token, id),
        api.muniOperationSheetGet(token, id),
      ]);
      setOp(o.operation);
      const sortedCols = (o.operation.columns || [])
        .slice()
        .sort((a: any, b: any) => a.position - b.position);
      if (!sh.sheet?.rows?.length) {
        setRows([
          {
            key: "r0",
            row_index: 0,
            cells: Object.fromEntries(
              sortedCols.map((c: any) => [c.key, defaultRawForColumn(c)]),
            ),
          },
        ]);
      } else {
        setRows(
          sh.sheet.rows.map((r: any, i: number) => {
            const cells: Record<string, unknown> = {};
            for (const c of sortedCols) {
              const cell = (r.cells || []).find(
                (x: any) => Number(x.column_id) === Number(c.id),
              );
              cells[c.key] = rawFromValueJson(c, cell?.value_json);
            }
            return { key: `r${r.id || i}`, row_index: r.row_index ?? i, cells };
          }),
        );
      }
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

  useEffect(() => {
    if (!op?.columns?.length) return;
    const colList = (op.columns as any[])
      .slice()
      .sort((a: any, b: any) => a.position - b.position);
    setRows((prev) =>
      prev.map((row) => {
        const nextCells = { ...row.cells };
        for (const c of colList) {
          if (nextCells[c.key] === undefined)
            nextCells[c.key] = defaultRawForColumn(c);
        }
        return { ...row, cells: nextCells };
      }),
    );
  }, [op]);

  function addRow() {
    setRows((r) => [
      ...r,
      {
        key: mkUid(),
        row_index: r.length,
        cells: Object.fromEntries(
          cols.map((c: any) => [c.key, defaultRawForColumn(c)]),
        ),
      },
    ]);
  }

  function removeRow(k: string) {
    setRows((r) => (r.length <= 1 ? r : r.filter((x) => x.key !== k)));
  }

  function setCell(rowKey: string, colKey: string, val: unknown) {
    setRows((r) =>
      r.map((row) => {
        if (row.key !== rowKey) return row;
        return { ...row, cells: { ...row.cells, [colKey]: val } };
      }),
    );
  }

  async function save() {
    if (!id) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const sortedCols = cols;
      const payload = rows.map((r, i) => ({
        row_index: r.row_index ?? i,
        cells: Object.fromEntries(
          sortedCols.map((c: any) => [c.key, r.cells[c.key]]),
        ),
      }));
      await api.muniOperationSheetPut(token, id, payload);
      const ok = t("snackbarSaved");
      setSuccessMsg(ok);
      snack.show(ok, "success");
      window.setTimeout(() => {
        navigate("/operations");
      }, 900);
    } catch (e: unknown) {
      const raw =
        e instanceof api.ApiError ? e.message : (e as any)?.message || "Erreur";
      const msg = formatApiErrorMessage(raw, t);
      setError(msg);
      snack.show(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function exportXlsx() {
    if (!id) return;
    const { blob, filename } = await api.downloadMuniOperationXlsx(
      token,
      id,
      lang,
    );
    triggerBlobDownload(blob, filename);
  }

  return (
    <div className="card">
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: 12 }}
      >
        <div>
          <div className="title" style={{ margin: 0 }}>
            {op?.title || "..."}
          </div>
          {op?.description ? (
            <div className="muted">{op.description}</div>
          ) : null}
        </div>
        <div className="row">
          <Link className="btn" to={`/operations/${operationId}/view`}>
            {t("operationsMuniViewTable")}
          </Link>
          <button
            type="button"
            className="btn btnExcel"
            onClick={() =>
              exportXlsx().catch((e: unknown) => {
                const raw =
                  e instanceof api.ApiError
                    ? e.message
                    : (e as Error)?.message || "Erreur";
                const msg = formatApiErrorMessage(raw, t);
                setError(msg);
                snack.show(msg, "error");
              })
            }
          >
            {t("operationsExportCommuneSheet")}
          </button>
          {!isArchived ? (
            <button
              type="button"
              className="btn btnPrimary"
              disabled={saving}
              onClick={() => save()}
            >
              {saving ? t("loading") : t("save")}
            </button>
          ) : null}
          <BackButton fallbackTo="/operations" />
        </div>
      </div>

      {isArchived ? (
        <div
          className="formFeedback formFeedback--error"
          role="status"
          style={{ marginBottom: 8 }}
        >
          {t("operationsMuniArchivedReadOnly")}{" "}
          <Link to={`/operations/${operationId}/view`}>
            {t("operationsMuniViewTable")}
          </Link>
        </div>
      ) : null}

      {(error || successMsg) && !saving ? (
        <div
          className={`formFeedback ${error ? "formFeedback--error" : "formFeedback--success"}`}
          role={error ? "alert" : "status"}
          style={{ marginTop: 8 }}
        >
          {error || successMsg}
        </div>
      ) : null}

      {!cols.length ? (
        <div className="muted">{t("operationsNoColumns")}</div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              {cols.map((c: any) => (
                <th key={c.id}>{labelColumn(c, lang)}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.key}>
                <td>{ri + 1}</td>
                {cols.map((c: any) => (
                  <td
                    key={c.id}
                    style={{
                      minWidth:
                        c.column_type === "TEXT"
                          ? 200
                          : c.column_type === "DATE"
                            ? 140
                            : 100,
                    }}
                  >
                    {c.column_type === "BOOLEAN" ? (
                      <input
                        type="checkbox"
                        disabled={isArchived}
                        checked={Boolean(row.cells[c.key])}
                        onChange={(e) =>
                          setCell(row.key, c.key, e.target.checked)
                        }
                      />
                    ) : null}
                    {c.column_type === "NUMBER" ? (
                      <input
                        className="input"
                        type="number"
                        disabled={isArchived}
                        value={Number(row.cells[c.key] ?? 0)}
                        onChange={(e) =>
                          setCell(
                            row.key,
                            c.key,
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                      />
                    ) : null}
                    {c.column_type === "TEXT" ? (
                      <textarea
                        className="input opsTextCell"
                        rows={2}
                        disabled={isArchived}
                        value={String(row.cells[c.key] ?? "")}
                        onChange={(e) =>
                          setCell(row.key, c.key, e.target.value)
                        }
                      />
                    ) : null}
                    {c.column_type === "DATE" ? (
                      <input
                        className="input"
                        type="date"
                        disabled={isArchived}
                        value={String(row.cells[c.key] ?? "").slice(0, 10)}
                        onChange={(e) =>
                          setCell(row.key, c.key, e.target.value)
                        }
                      />
                    ) : null}
                    {c.column_type === "CHOICE" ? (
                      <select
                        className="input"
                        disabled={isArchived}
                        value={String(row.cells[c.key] ?? "")}
                        onChange={(e) =>
                          setCell(row.key, c.key, e.target.value)
                        }
                      >
                        {(c.choices || [])
                          .slice()
                          .sort((a: any, b: any) => a.position - b.position)
                          .map((ch: any) => (
                            <option key={ch.value_key} value={ch.value_key}>
                              {labelColumn(ch, lang)}
                            </option>
                          ))}
                      </select>
                    ) : null}
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="btn btnSmall"
                    disabled={isArchived || rows.length <= 1}
                    onClick={() => removeRow(row.key)}
                  >
                    {t("delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="btn"
        style={{ marginTop: 12 }}
        disabled={isArchived}
        onClick={() => addRow()}
      >
        + {t("operationsAddRow")}
      </button>

      {(error || successMsg) && !saving ? (
        <div
          className={`formFeedback ${error ? "formFeedback--error" : "formFeedback--success"}`}
          role={error ? "alert" : "status"}
          style={{ marginTop: 12 }}
        >
          {error || successMsg}
        </div>
      ) : null}
    </div>
  );
}
