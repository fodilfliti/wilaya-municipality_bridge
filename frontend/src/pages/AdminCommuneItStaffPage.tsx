import { useCallback, useEffect, useState } from "react";
import { BackButton } from '../components/BackButton'
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { Modal } from "../components/Modal";
import { triggerBlobDownload } from "../operations/format";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { formatApiErrorMessage } from "../snackbar/formatApiErrorMessage";

type MuniOpt = { id: number; code: string; name_ar: string; name_fr: string };

export function AdminCommuneItStaffPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "fr" ? "fr" : "ar";
  const snack = useSnackbar();
  const [rows, setRows] = useState<api.CommuneItStaffRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [filterMunicipalityId, setFilterMunicipalityId] = useState<number | "">("");
  const [municipalities, setMunicipalities] = useState<MuniOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formMunicipalityId, setFormMunicipalityId] = useState<number | "">("");
  const [formFirst, setFormFirst] = useState("");
  const [formLast, setFormLast] = useState("");
  const [formNin, setFormNin] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formLangs, setFormLangs] = useState("");

  const muniLabel = (m: MuniOpt | null | undefined) => {
    if (!m) return "";
    return lang === "fr" ? m.name_fr : m.name_ar;
  };

  const loadMunicipalities = useCallback(async () => {
    const acc: MuniOpt[] = [];
    let p = 1;
    while (true) {
      const res = await api.adminListMunicipalities(token, { page: p, pageSize: 50 });
      for (const x of res.municipalities || []) {
        acc.push({ id: x.id, code: x.code, name_ar: x.name_ar, name_fr: x.name_fr });
      }
      if (acc.length >= res.total) break;
      p += 1;
      if (p > 80) break;
    }
    setMunicipalities(acc);
  }, [token]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminCommuneItStaffList(token, {
        page,
        pageSize,
        q: q.trim() || undefined,
        municipalityId: filterMunicipalityId === "" ? undefined : Number(filterMunicipalityId),
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      snack.show(formatApiErrorMessage(raw, t), "error");
    } finally {
      setLoading(false);
    }
  }, [filterMunicipalityId, page, pageSize, q, snack, t, token]);

  useEffect(() => {
    loadMunicipalities().catch(() => {});
  }, [loadMunicipalities]);

  useEffect(() => {
    loadRows().catch(() => {});
  }, [loadRows]);

  function openCreate() {
    setEditingId(null);
    setModalError(null);
    setFormMunicipalityId(municipalities[0]?.id ?? "");
    setFormFirst("");
    setFormLast("");
    setFormNin("");
    setFormPhone("");
    setFormEmail("");
    setFormLangs("");
    setModalOpen(true);
  }

  function openEdit(r: api.CommuneItStaffRow) {
    setEditingId(r.id);
    setModalError(null);
    setFormMunicipalityId(r.municipality_id);
    setFormFirst(r.first_name);
    setFormLast(r.last_name);
    setFormNin(r.nin || "");
    setFormPhone(r.phone);
    setFormEmail(r.email || "");
    setFormLangs(r.programming_languages);
    setModalOpen(true);
  }

  async function saveModal() {
    setModalError(null);
    const mid = Number(formMunicipalityId);
    if (!Number.isFinite(mid) || mid < 1) {
      setModalError(t("itStaffMunicipalityRequired"));
      return;
    }
    try {
      const body = {
        municipality_id: mid,
        first_name: formFirst.trim(),
        last_name: formLast.trim(),
        nin: formNin.trim() || null,
        phone: formPhone.trim(),
        email: formEmail.trim() || null,
        programming_languages: formLangs.trim(),
      };
      if (editingId != null) {
        await api.adminCommuneItStaffUpdate(token, editingId, body);
        snack.show(t("snackbarSaved"), "success");
      } else {
        await api.adminCommuneItStaffCreate(token, body);
        snack.show(t("snackbarSaved"), "success");
      }
      setModalOpen(false);
      await loadRows();
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      setModalError(formatApiErrorMessage(raw, t));
    }
  }

  async function removeRow(id: number) {
    if (!window.confirm(t("itStaffDeleteConfirm"))) return;
    try {
      await api.adminCommuneItStaffDelete(token, id);
      snack.show(t("snackbarSaved"), "success");
      await loadRows();
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      snack.show(formatApiErrorMessage(raw, t), "error");
    }
  }

  async function exportXlsx() {
    try {
      const { blob, filename } = await api.downloadAdminCommuneItStaffXlsx(token, {
        locale: lang,
        municipalityId: filterMunicipalityId === "" ? undefined : Number(filterMunicipalityId),
      });
      triggerBlobDownload(blob, filename);
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      snack.show(formatApiErrorMessage(raw, t), "error");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div className="title" style={{ margin: 0 }}>
          {t("itStaffAdminTitle")}
        </div>
        <div className="row">
          <button type="button" className="btn btnPrimary" onClick={openCreate}>
            {t("itStaffAddRow")}
          </button>
          <button type="button" className="btn" onClick={() => exportXlsx().catch(() => {})}>
            {t("itStaffExportXlsx")}
          </button>
          <button type="button" className="btn" onClick={() => loadRows().catch(() => {})}>
            {t("refresh")}
          </button>
          <BackButton />
        </div>
      </div>

      <div className="muted" style={{ marginTop: 8, marginBottom: 14 }}>
        {t("itStaffAdminIntro")}
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: 10, marginBottom: 12, alignItems: "flex-end" }}>
        <label className="field" style={{ minWidth: 160 }}>
          <div className="muted">{t("selectMunicipality")}</div>
          <select
            className="input"
            value={filterMunicipalityId === "" ? "" : String(filterMunicipalityId)}
            onChange={(e) => {
              const v = e.target.value;
              setFilterMunicipalityId(v === "" ? "" : Number(v));
              setPage(1);
            }}
          >
            <option value="">{t("itStaffAllCommunes")}</option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {muniLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          <div className="muted">{t("search")}</div>
          <input
            className="input"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setQ(qInput);
                setPage(1);
              }
            }}
          />
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setQ(qInput);
            setPage(1);
          }}
        >
          {t("show")}
        </button>
      </div>

      {loading ? (
        <div className="muted">{t("loading")}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 900, fontSize: 13 }}>
            <thead>
              <tr>
                <th>{t("municipalityCode")}</th>
                <th>{t("itStaffCommune")}</th>
                <th>{t("itStaffFirstName")}</th>
                <th>{t("itStaffLastName")}</th>
                <th>{t("itStaffNin")}</th>
                <th>{t("itStaffPhone")}</th>
                <th>{t("itStaffEmail")}</th>
                <th>{t("itStaffLangs")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.municipality?.code ?? "—"}</td>
                  <td>{muniLabel(r.municipality ?? undefined)}</td>
                  <td>{r.first_name}</td>
                  <td>{r.last_name}</td>
                  <td>{r.nin || "—"}</td>
                  <td>{r.phone}</td>
                  <td>{r.email || "—"}</td>
                  <td style={{ maxWidth: 220, whiteSpace: "pre-wrap" }}>{r.programming_languages}</td>
                  <td>
                    <div className="row">
                      <button type="button" className="btn" onClick={() => openEdit(r)}>
                        {t("edit")}
                      </button>
                      <button type="button" className="btn" onClick={() => removeRow(r.id)}>
                        {t("delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <div className="muted" style={{ marginTop: 8 }}>{t("itStaffNoRows")}</div> : null}
        </div>
      )}

      <div className="row" style={{ marginTop: 12, justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div className="muted">
          {t("paginationSummary", { page, totalPages, total })}
        </div>
        <div className="row">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {t("prev")}
          </button>
          <button
            type="button"
            className="btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("next")}
          </button>
        </div>
      </div>

      {modalOpen ? (
        <Modal
          title={editingId != null ? t("itStaffEditRow") : t("itStaffAddRow")}
          error={modalError}
          onClose={() => setModalOpen(false)}
        >
          <div className="grid" style={{ gap: 10 }}>
            <label className="field">
              <div className="muted">{t("chooseMunicipality")}</div>
              <select
                className="input"
                value={formMunicipalityId === "" ? "" : String(formMunicipalityId)}
                onChange={(e) => setFormMunicipalityId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">{t("chooseMunicipality")}</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {muniLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <div className="muted">{t("itStaffFirstName")}</div>
              <input className="input" value={formFirst} onChange={(e) => setFormFirst(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t("itStaffLastName")}</div>
              <input className="input" value={formLast} onChange={(e) => setFormLast(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t("itStaffNin")}</div>
              <input className="input" value={formNin} onChange={(e) => setFormNin(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t("itStaffPhone")}</div>
              <input className="input" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t("itStaffEmail")}</div>
              <input className="input" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t("itStaffLangs")}</div>
              <textarea className="input" rows={3} value={formLangs} onChange={(e) => setFormLangs(e.target.value)} />
            </label>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>
                {t("cancel")}
              </button>
              <button type="button" className="btn btnPrimary" onClick={() => saveModal().catch(() => {})}>
                {t("submit")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
