import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import * as api from "../api";
import { Modal } from "../components/Modal";
import { ErrorPopup } from "../components/ErrorPopup";

export function AdminAppDetailPage({ token }: { token: string }) {
  const { t } = useTranslation();
  const params = useParams();
  const appId = Number(params.appId);

  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [app, setApp] = useState<any | null>(null);
  const [versions, setVersions] = useState<any[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<any | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<any | null>(null);

  const [binaryFile, setBinaryFile] = useState<File | null>(null);
  const [versionNumber, setVersionNumber] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);

  async function load() {
    setError(null);
    const res = await api.adminGetApp(token, appId);
    setApp(res.app);
    setVersions(res.versions);
  }

  useEffect(() => {
    if (!Number.isFinite(appId) || !appId) return;
    load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  if (!appId) {
    return (
      <div className="card">
        <div className="title">App</div>
        <div className="muted">App ID غير صحيح</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div className="row">
          <Link className="btn" to="/apps">
            رجوع
          </Link>
          <div className="title" style={{ marginInlineStart: 8 }}>
            {app ? app.app_name : "..."}
          </div>
        </div>
        <div className="row">
          <button className="btn btnPrimary" onClick={() => setAddOpen(true)}>
            + {t("uploadVersion")}
          </button>
          <button
            className="btn"
            onClick={() => load().catch((e) => setError(e.message))}
          >
            تحديث
          </button>
        </div>
      </div>

      {error ? (
        <ErrorPopup message={error} onClose={() => setError(null)} />
      ) : null}

      {app?.description ? (
        <div className="card" style={{ boxShadow: "none", marginTop: 10 }}>
          <div className="muted" style={{ fontWeight: 900 }}>
            {t("appDescription")}
          </div>
          <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
            {app.description}
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {versions.map((v) => (
          <div key={v.id} className="card" style={{ boxShadow: "none" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{v.version_number}</div>
              </div>
              <div className="row">
                <Link className="btn btnPrimary" to={`/versions/${v.id}`}>
                  تفاصيل التحميلات
                </Link>
                <button className="btn" onClick={() => setEditOpen(v)}>
                  تعديل
                </button>
                <button
                  className="btn btnWarning"
                  onClick={() => setDeleteOpen(v)}
                >
                  حذف
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
            resetForm();
          }}
          error={modalError}
        >
          <div className="grid">
            <label className="field">
              <div className="muted">ملف التطبيق (exe/msi...)</div>
              <input
                className="input"
                type="file"
                onChange={(e) => setBinaryFile(e.target.files?.[0] || null)}
              />
            </label>
            <label className="field">
              <div className="muted">{t("versionNumber")}</div>
              <input
                className="input"
                value={versionNumber}
                onChange={(e) => setVersionNumber(e.target.value)}
              />
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
              <div className="muted">تغيير الشعار مع هذا الإصدار (اختياري)</div>
              <input
                className="input"
                type="file"
                accept="image/*,image/svg+xml"
                onChange={(e) => setNewLogoFile(e.target.files?.[0] || null)}
              />
            </label>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    if (!binaryFile) throw new Error("اختر ملف التطبيق");
                    if (!versionNumber.trim())
                      throw new Error("رقم الإصدار مطلوب");
                    setModalError(null);
                    await api.adminUploadVersion(token, appId, {
                      file: binaryFile,
                      version_number: versionNumber.trim(),
                      release_notes: releaseNotes || undefined,
                      logoFile: newLogoFile,
                    });
                    setAddOpen(false);
                    setModalError(null);
                    resetForm();
                    await load();
                  } catch (e: any) {
                    setModalError(e.message);
                  }
                }}
              >
                رفع
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {editOpen ? (
        <Modal
          title={`تعديل الإصدار: ${editOpen.version_number}`}
          onClose={() => {
            setEditOpen(null);
            setModalError(null);
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
                onClick={async () => {
                  try {
                    setModalError(null);
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
                  } catch (e: any) {
                    setModalError(e.message);
                  }
                }}
              >
                حفظ
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteOpen ? (
        <Modal
          title={`حذف الإصدار: ${deleteOpen.version_number}`}
          onClose={() => {
            setDeleteOpen(null);
            setModalError(null);
          }}
          error={modalError}
        >
          <div className="grid">
            <div className="muted">هل أنت متأكد من حذف هذا الإصدار؟</div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setDeleteOpen(null)}>
                إلغاء
              </button>
              <button
                className="btn btnWarning"
                onClick={async () => {
                  try {
                    setModalError(null);
                    await api.adminDeleteVersion(token, deleteOpen.id);
                    setDeleteOpen(null);
                    setModalError(null);
                    await load();
                  } catch (e: any) {
                    setModalError(e.message);
                  }
                }}
              >
                حذف
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
