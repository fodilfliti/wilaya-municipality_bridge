import { useCallback, useEffect, useState } from "react";
import { BackButton } from '../components/BackButton'
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from 'zod'

import * as api from "../api";
import { Modal } from "../components/Modal";
import { ErrorPopup } from "../components/ErrorPopup";
import { FormErrorBlock, FieldErrorText } from '../components/FormErrorBlock'
import { useSnackbar } from "../snackbar/SnackbarContext";
import { formatApiErrorMessage } from "../snackbar/formatApiErrorMessage";
import { V, requiredString } from '../validation/messages'
import { useZodForm } from '../validation/useZodForm'
import { applyApiErrorToForm } from '../validation/applyApiError'

const uploadVersionSchema = z.object({
  file: z.instanceof(File, { message: 'chooseAppFile' }),
  version_number: requiredString('versionNumberRequired').max(64, { message: V.maxLength }),
})

export function AdminAppDetailPage({ token }: { token: string }) {
  const { t } = useTranslation();
  const snack = useSnackbar();
  const params = useParams();
  const appId = Number(params.appId);

  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [app, setApp] = useState<any | null>(null);
  const [versions, setVersions] = useState<any[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<any | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<any | null>(null);

  const [binaryFile, setBinaryFile] = useState<File | null>(null);
  const [versionNumber, setVersionNumber] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const uploadForm = useZodForm(uploadVersionSchema)

  const reportPageErr = useCallback(
    (e: unknown) => {
      const raw =
        e instanceof api.ApiError
          ? e.message
          : String((e as Error)?.message || "VALIDATION_ERROR");
      const msg = formatApiErrorMessage(raw, t);
      setError(msg);
      snack.show(msg, "error");
    },
    [t, snack],
  );

  function reportModalErr(e: unknown) {
    const raw =
      e instanceof api.ApiError
        ? e.message
        : String((e as Error)?.message || "VALIDATION_ERROR");
    const msg = formatApiErrorMessage(raw, t);
    setModalError(msg);
    snack.show(msg, "error");
  }

  async function load() {
    setError(null);
    const res = await api.adminGetApp(token, appId);
    setApp(res.app);
    setVersions(res.versions);
  }

  useEffect(() => {
    if (!Number.isFinite(appId) || !appId) return;
    load().catch(reportPageErr);
  }, [appId, token, reportPageErr]);

  if (!appId) {
    return (
      <div className="card">
        <div className="title">App</div>
        <div className="muted">{t("invalidAppId")}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div className="title" style={{ margin: 0 }}>
          {app ? app.app_name : "..."}
        </div>
        <div className="row">
          <button className="btn btnPrimary" onClick={() => setAddOpen(true)}>
            + {t("uploadVersion")}
          </button>
          <button className="btn" onClick={() => load().catch(reportPageErr)}>
            {t("refresh")}
          </button>
          <BackButton fallbackTo="/apps" />
        </div>
      </div>

      {error ? (
        <ErrorPopup message={error} onClose={() => setError(null)} />
      ) : null}

      {app?.description ? (
        <div className="card cardSubtle" style={{ marginTop: 10 }}>
          <div className="muted" style={{ fontWeight: 900 }}>
            {t("appDescription")}
          </div>
          <div
            className="muted"
            style={{ marginTop: 6, whiteSpace: "pre-wrap" }}
          >
            {app.description}
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {versions.map((v) => (
          <div key={v.id} className="card cardSubtle">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{v.version_number}</div>
              </div>
              <div className="row">
                <Link className="btn btnPrimary" to={`/versions/${v.id}`}>
                  {t("downloadsDetails")}
                </Link>
                <button className="btn" onClick={() => setEditOpen(v)}>
                  {t("edit")}
                </button>
                <button
                  className="btn btnWarning"
                  onClick={() => setDeleteOpen(v)}
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          </div>
        ))}
        {versions.length === 0 ? (
          <div className="muted">{t("noVersions")}</div>
        ) : null}
      </div>

      {addOpen ? (
        <Modal
          title={`${t("uploadVersion")}`}
          onClose={() => {
            setAddOpen(false);
            setModalError(null);
            setModalSubmitting(false);
            resetForm();
            uploadForm.clearErrors()
          }}
          error={modalError}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">{t("appBinaryFile")}</div>
              <input
                id="field-file"
                className={`input${uploadForm.hasFieldError('file') ? ' inputInvalid' : ''}`}
                type="file"
                onChange={(e) => setBinaryFile(e.target.files?.[0] || null)}
              />
              <FieldErrorText message={uploadForm.fieldErrorText('file', t)} />
            </label>
            <label className="field">
              <div className="muted">{t("versionNumber")}</div>
              <input
                id="field-version_number"
                className={`input${uploadForm.hasFieldError('version_number') ? ' inputInvalid' : ''}`}
                value={versionNumber}
                onChange={(e) => {
                  uploadForm.clearField('version_number')
                  setVersionNumber(e.target.value)
                }}
              />
              <FieldErrorText message={uploadForm.fieldErrorText('version_number', t)} />
            </label>
            <label className="field">
              <div className="muted">{t("releaseNotes")}</div>
              <textarea
                className="textarea"
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
              />
            </label>
            <label className="field">
              <div className="muted">{t("changeLogoWithVersionOptional")}</div>
              <input
                className="input"
                type="file"
                accept="image/*,image/svg+xml"
                onChange={(e) => setNewLogoFile(e.target.files?.[0] || null)}
              />
            </label>
            <FormErrorBlock message={uploadForm.formError} />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                className="btn btnPrimary"
                disabled={modalSubmitting}
                onClick={async () => {
                  try {
                    const payload = { file: binaryFile, version_number: versionNumber }
                    if (!uploadForm.validate(payload, t, ['field-file', 'field-version_number'])) return
                    setModalError(null);
                    setModalSubmitting(true);
                    await api.adminUploadVersion(token, appId, {
                      file: payload.file,
                      version_number: payload.version_number.trim(),
                      release_notes: releaseNotes || undefined,
                      logoFile: newLogoFile,
                    });
                    setAddOpen(false);
                    setModalError(null);
                    resetForm();
                    uploadForm.clearErrors()
                    await load();
                    snack.show(t("snackbarCreated"), "success");
                  } catch (e: unknown) {
                    applyApiErrorToForm(e, t, {
                      setFormError: uploadForm.setFormError,
                      setFieldErrors: uploadForm.setFieldErrors,
                      snackShow: (msg) => snack.show(msg, 'error'),
                    })
                  } finally {
                    setModalSubmitting(false);
                  }
                }}
              >
                {modalSubmitting ? t("loading") : t("upload")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {editOpen ? (
        <Modal
          title={t("editVersionTitle", { version: editOpen.version_number })}
          onClose={() => {
            setEditOpen(null);
            setModalError(null);
            setModalSubmitting(false);
            setVersionNumber("");
            setReleaseNotes("");
          }}
          error={modalError}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">{t("versionNumber")}</div>
              <input
                className="input"
                defaultValue={editOpen.version_number}
                onChange={(e) => setVersionNumber(e.target.value)}
              />
            </label>
            <label className="field">
              <div className="muted">{t("releaseNotes")}</div>
              <textarea
                className="textarea"
                defaultValue={editOpen.release_notes || ""}
                onChange={(e) => setReleaseNotes(e.target.value)}
              />
            </label>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                className="btn btnPrimary"
                disabled={modalSubmitting}
                onClick={async () => {
                  try {
                    setModalError(null);
                    setModalSubmitting(true);
                    await api.adminUpdateVersion(token, editOpen.id, {
                      version_number:
                        versionNumber.trim() || editOpen.version_number,
                      release_notes: releaseNotes,
                    });
                    setEditOpen(null);
                    setModalError(null);
                    setVersionNumber("");
                    setReleaseNotes("");
                    await load();
                    snack.show(t("snackbarSaved"), "success");
                  } catch (e: unknown) {
                    reportModalErr(e);
                  } finally {
                    setModalSubmitting(false);
                  }
                }}
              >
                {modalSubmitting ? t("loading") : t("save")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteOpen ? (
        <Modal
          title={t("deleteVersionTitle", {
            version: deleteOpen.version_number,
          })}
          onClose={() => {
            setDeleteOpen(null);
            setModalError(null);
            setModalSubmitting(false);
          }}
          error={modalError}
        >
          <div className="grid">
            <div className="muted">{t("deleteVersionConfirm")}</div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setDeleteOpen(null)}>
                {t("cancel")}
              </button>
              <button
                className="btn btnWarning"
                disabled={modalSubmitting}
                onClick={async () => {
                  try {
                    setModalError(null);
                    setModalSubmitting(true);
                    await api.adminDeleteVersion(token, deleteOpen.id);
                    setDeleteOpen(null);
                    setModalError(null);
                    await load();
                    snack.show(t("snackbarDeleted"), "success");
                  } catch (e: unknown) {
                    reportModalErr(e);
                  } finally {
                    setModalSubmitting(false);
                  }
                }}
              >
                {modalSubmitting ? t("loading") : t("delete")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );

  function resetForm() {
    setBinaryFile(null);
    setVersionNumber("");
    setReleaseNotes("");
    setNewLogoFile(null);
  }
}
