import { useCallback, useEffect, useState } from "react";
import { BackButton } from '../components/BackButton'
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { Modal } from "../components/Modal";
import { triggerBlobDownload } from "../operations/format";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { formatApiErrorMessage } from "../snackbar/formatApiErrorMessage";

export function MuniCommuneItStaffPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "fr" ? "fr" : "ar";
  const snack = useSnackbar();
  const [rows, setRows] = useState<api.CommuneItStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formFirst, setFormFirst] = useState("");
  const [formLast, setFormLast] = useState("");
  const [formNin, setFormNin] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formLangs, setFormLangs] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.muniCommuneItStaffList(token);
      setRows(res.rows);
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      snack.show(formatApiErrorMessage(raw, t), "error");
    } finally {
      setLoading(false);
    }
  }, [snack, t, token]);

  useEffect(() => {
    loadRows().catch(() => {});
  }, [loadRows]);

  function openCreate() {
    setEditingId(null);
    setModalError(null);
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
    try {
      const body = {
        first_name: formFirst.trim(),
        last_name: formLast.trim(),
        nin: formNin.trim() || null,
        phone: formPhone.trim(),
        email: formEmail.trim() || null,
        programming_languages: formLangs.trim(),
      };
      if (editingId != null) {
        await api.muniCommuneItStaffUpdate(token, editingId, body);
      } else {
        await api.muniCommuneItStaffCreate(token, body);
      }
      snack.show(t("snackbarSaved"), "success");
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
      await api.muniCommuneItStaffDelete(token, id);
      snack.show(t("snackbarSaved"), "success");
      await loadRows();
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      snack.show(formatApiErrorMessage(raw, t), "error");
    }
  }

  async function exportXlsx() {
    try {
      const { blob, filename } = await api.downloadMuniCommuneItStaffXlsx(token, lang);
      triggerBlobDownload(blob, filename);
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      snack.show(formatApiErrorMessage(raw, t), "error");
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div className="title" style={{ margin: 0 }}>
          {t("itStaffMuniTitle")}
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
        {t("itStaffMuniIntro")}
      </div>

      {loading ? (
        <div className="muted">{t("loading")}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 720, fontSize: 13 }}>
            <thead>
              <tr>
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
                  <td>{r.first_name}</td>
                  <td>{r.last_name}</td>
                  <td>{r.nin || "—"}</td>
                  <td>{r.phone}</td>
                  <td>{r.email || "—"}</td>
                  <td style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>{r.programming_languages}</td>
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

      {modalOpen ? (
        <Modal
          title={editingId != null ? t("itStaffEditRow") : t("itStaffAddRow")}
          error={modalError}
          onClose={() => setModalOpen(false)}
        >
          <div className="grid" style={{ gap: 10 }}>
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
