import { useCallback, useEffect, useState } from "react";
import { BackButton } from '../components/BackButton'
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { Modal } from "../components/Modal";
import { FormErrorBlock, FieldErrorText } from "../components/FormErrorBlock";
import { triggerBlobDownload } from "../operations/format";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { apiErrorMessage, applyApiErrorToForm } from "../validation/applyApiError";
import { communeItStaffBodySchema } from "../validation/schemas/communeItStaff";
import { useZodForm } from "../validation/useZodForm";

export function MuniCommuneItStaffPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "fr" ? "fr" : "ar";
  const snack = useSnackbar();
  const form = useZodForm(communeItStaffBodySchema);
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
  const [saving, setSaving] = useState(false);

  const fieldIds = [
    "field-first_name",
    "field-last_name",
    "field-nin",
    "field-phone",
    "field-email",
    "field-programming_languages",
  ];

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.muniCommuneItStaffList(token);
      setRows(res.rows);
    } catch (e: unknown) {
      snack.show(apiErrorMessage(e, t), "error");
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
    form.clearErrors();
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
    form.clearErrors();
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
    const payload = {
      first_name: formFirst,
      last_name: formLast,
      nin: formNin.trim() || null,
      phone: formPhone,
      email: formEmail,
      programming_languages: formLangs,
    };
    if (!form.validate(payload, t, fieldIds)) return;
    setSaving(true);
    try {
      if (editingId != null) {
        await api.muniCommuneItStaffUpdate(token, editingId, payload);
      } else {
        await api.muniCommuneItStaffCreate(token, payload);
      }
      snack.show(t("snackbarSaved"), "success");
      setModalOpen(false);
      await loadRows();
    } catch (e: unknown) {
      applyApiErrorToForm(e, t, {
        setFormError: setModalError,
        setFieldErrors: form.setFieldErrors,
        snackShow: (msg) => snack.show(msg, "error"),
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id: number) {
    if (!window.confirm(t("itStaffDeleteConfirm"))) return;
    try {
      await api.muniCommuneItStaffDelete(token, id);
      snack.show(t("snackbarSaved"), "success");
      await loadRows();
    } catch (e: unknown) {
      snack.show(apiErrorMessage(e, t), "error");
    }
  }

  async function exportXlsx() {
    try {
      const { blob, filename } = await api.downloadMuniCommuneItStaffXlsx(token, lang);
      triggerBlobDownload(blob, filename);
    } catch (e: unknown) {
      snack.show(apiErrorMessage(e, t), "error");
    }
  }

  const inputClass = (path: string) => (form.hasFieldError(path) ? "input inputInvalid" : "input");

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
          <button type="button" className="btn btnExcel" onClick={() => void exportXlsx()}>
            {t("itStaffExportXlsx")}
          </button>
          <button type="button" className="btn" onClick={() => void loadRows()}>
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
                      <button type="button" className="btn" onClick={() => void removeRow(r.id)}>
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
              <input
                id="field-first_name"
                className={inputClass("first_name")}
                value={formFirst}
                onChange={(e) => {
                  setFormFirst(e.target.value);
                  form.clearField("first_name");
                }}
                aria-invalid={form.hasFieldError("first_name")}
                aria-describedby={form.hasFieldError("first_name") ? "err-first_name" : undefined}
              />
              <FieldErrorText message={form.fieldErrorText("first_name", t)} />
            </label>
            <label className="field">
              <div className="muted">{t("itStaffLastName")}</div>
              <input
                id="field-last_name"
                className={inputClass("last_name")}
                value={formLast}
                onChange={(e) => {
                  setFormLast(e.target.value);
                  form.clearField("last_name");
                }}
                aria-invalid={form.hasFieldError("last_name")}
              />
              <FieldErrorText message={form.fieldErrorText("last_name", t)} />
            </label>
            <label className="field">
              <div className="muted">{t("itStaffNin")}</div>
              <input
                id="field-nin"
                className={inputClass("nin")}
                value={formNin}
                onChange={(e) => setFormNin(e.target.value)}
              />
              <FieldErrorText message={form.fieldErrorText("nin", t)} />
            </label>
            <label className="field">
              <div className="muted">{t("itStaffPhone")}</div>
              <input
                id="field-phone"
                className={inputClass("phone")}
                value={formPhone}
                onChange={(e) => {
                  setFormPhone(e.target.value);
                  form.clearField("phone");
                }}
                aria-invalid={form.hasFieldError("phone")}
              />
              <FieldErrorText message={form.fieldErrorText("phone", t)} />
            </label>
            <label className="field">
              <div className="muted">{t("itStaffEmail")}</div>
              <input
                id="field-email"
                className={inputClass("email")}
                value={formEmail}
                onChange={(e) => {
                  setFormEmail(e.target.value);
                  form.clearField("email");
                }}
                aria-invalid={form.hasFieldError("email")}
              />
              <FieldErrorText message={form.fieldErrorText("email", t)} />
            </label>
            <label className="field">
              <div className="muted">{t("itStaffLangs")}</div>
              <textarea
                id="field-programming_languages"
                className={inputClass("programming_languages")}
                rows={3}
                value={formLangs}
                onChange={(e) => {
                  setFormLangs(e.target.value);
                  form.clearField("programming_languages");
                }}
                aria-invalid={form.hasFieldError("programming_languages")}
              />
              <FieldErrorText message={form.fieldErrorText("programming_languages", t)} />
            </label>
            <FormErrorBlock message={form.formError} />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setModalOpen(false)} disabled={saving}>
                {t("cancel")}
              </button>
              <button type="button" className="btn btnPrimary" onClick={() => void saveModal()} disabled={saving}>
                {saving ? "..." : t("submit")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
