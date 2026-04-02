import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import * as api from "../api";
import { Modal } from "../components/Modal";
import { ErrorPopup } from "../components/ErrorPopup";

export function AdminUsersPage({ token }: { token: string }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMuniId = Number(searchParams.get("municipalityId") || "") || "";

  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [municipalityId, setMunicipalityId] = useState<number | "">(
    initialMuniId,
  );
  const [municipalities, setMunicipalities] = useState<any[]>([]);

  const [municipality, setMunicipality] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [blockUser, setBlockUser] = useState<any | null>(null);
  const [unblockUser, setUnblockUser] = useState<any | null>(null);

  const [optUsername, setOptUsername] = useState("");
  const [createdCreds, setCreatedCreds] = useState<{
    code8: string;
    pdf_url: string;
  } | null>(null);

  async function load() {
    if (!municipalityId) return;
    setError(null);
    const res = await api.adminListMunicipalityUsers(
      token,
      municipalityId as number,
      { page, pageSize },
    );
    setMunicipality(res.municipality);
    setUsers(res.users);
    setTotal(res.total);
  }

  async function loadMunicipalitiesForDropdown() {
    const out: any[] = [];
    let page = 1;
    const pageSize = 50;
    while (true) {
      const res = await api.adminListMunicipalities(token, { page, pageSize });
      out.push(...res.municipalities);
      if (out.length >= res.total) break;
      page += 1;
      if (page > 10) break;
    }
    setMunicipalities(out);
  }

  useEffect(() => {
    loadMunicipalitiesForDropdown().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!municipalityId) return;
    setSearchParams({ municipalityId: String(municipalityId) });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipalityId]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipalityId, page]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="title">{t("navUsers")}</div>
          <div className="muted">{t("usersPageHint")}</div>
        </div>
        <div className="row">
          <Link className="btn" to="/municipalities">
            {t("navMunicipalities")}
          </Link>
          <button
            className="btn"
            onClick={() => load().catch((e) => setError(e.message))}
            disabled={!municipalityId}
          >
            {t("refresh")}
          </button>
          <button
            className="btn btnPrimary"
            onClick={() => setCreateOpen(true)}
            disabled={!municipalityId}
          >
            {t("createUserCta")}
          </button>
        </div>
      </div>

      {error ? (
        <ErrorPopup message={error} onClose={() => setError(null)} />
      ) : null}

      <div className="row" style={{ marginTop: 12 }}>
        <label className="field" style={{ minWidth: 320 }}>
          <div className="muted">{t("selectMunicipality")}</div>
          <select
            className="input"
            value={municipalityId === "" ? "" : String(municipalityId)}
            onChange={(e) =>
              setMunicipalityId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">{t("chooseMunicipality")}</option>
            {municipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name_ar} — {m.code}
              </option>
            ))}
          </select>
        </label>
        {municipality ? (
          <div className="card cardSubtle" style={{ flex: 1 }}>
            <div style={{ fontWeight: 900 }}>{municipality.name_ar}</div>
            <div className="muted">
              {municipality.name_fr} — {municipality.code}
            </div>
          </div>
        ) : null}
      </div>

      {createdCreds ? (
        <Modal title={t("userCreatedTitle")} onClose={() => setCreatedCreds(null)}>
          <div className="grid">
            <div className="muted">{t("codeLabel", { code: createdCreds.code8 })}</div>
            <a
              className="btn"
              href={`${import.meta.env.VITE_API_URL || "http://localhost:4000"}${createdCreds.pdf_url}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("downloadPdf")}
            </a>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setCreatedCreds(null)}>
                {t("close")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {users.map((u) => (
          <div key={u.id} className="card cardSubtle">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 900 }}>{u.username}</div>
                <div className="muted">{u.is_blocked ? t("blocked") : t("active")}</div>
              </div>
              <div className="row">
                <button className="btn" onClick={() => setResetUser(u)}>
                  {t("reset")}
                </button>
                {!u.is_blocked ? (
                  <button
                    className="btn btnWarning"
                    onClick={() => setBlockUser(u)}
                  >
                    {t("block")}
                  </button>
                ) : (
                  <button
                    className="btn btnSuccess"
                    onClick={() => setUnblockUser(u)}
                  >
                    {t("unblock")}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {municipalityId && users.length === 0 ? (
          <div className="muted">{t("noUsers")}</div>
        ) : null}
      </div>

      {municipalityId ? (
        <div
          className="row"
          style={{ justifyContent: "space-between", marginTop: 12 }}
        >
          <div className="muted">
            {t("paginationSummary", { page, totalPages, total })}
          </div>
          <div className="row">
            <button
              className="btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("prev")}
            </button>
            <button
              className="btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t("next")}
            </button>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <Modal
          title={t("createMuniUser")}
          onClose={() => {
            setCreateOpen(false);
            setModalError(null);
            setOptUsername("");
          }}
          error={modalError}
        >
          <div className="grid">
            <div className="muted">{t("createUserAutoHint")}</div>
            <label className="field">
              <div className="muted">{t("optionalUsername")}</div>
              <input
                className="input"
                value={optUsername}
                onChange={(e) => setOptUsername(e.target.value)}
              />
            </label>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    if (!municipalityId)
                      throw new Error(t("municipalityIdRequired"));
                    setModalError(null);
                    const res = await api.adminCreateMuniUser(
                      token,
                      municipalityId as number,
                      { username: optUsername || undefined },
                    );
                    setCreatedCreds(res.credentials);
                    setCreateOpen(false);
                    setOptUsername("");
                    setModalError(null);
                    await load();
                  } catch (e: any) {
                    setModalError(e.message);
                  }
                }}
              >
                {t("create")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {resetUser ? (
        <Modal
          title={t("resetUserTitle", { username: resetUser.username })}
          onClose={() => {
            setResetUser(null);
            setModalError(null);
          }}
          error={modalError}
        >
          <div className="grid">
            <div className="muted">{t("resetUserHint")}</div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setResetUser(null)}>
                {t("cancel")}
              </button>
              <button
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    setModalError(null);
                    const res = await api.adminResetUser(token, resetUser.id);
                    setCreatedCreds(res.credentials);
                    setResetUser(null);
                    setModalError(null);
                    await load();
                  } catch (e: any) {
                    setModalError(e.message);
                  }
                }}
              >
                {t("confirm")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {blockUser ? (
        <Modal
          title={t("blockUserTitle", { username: blockUser.username })}
          onClose={() => {
            setBlockUser(null);
            setModalError(null);
          }}
          error={modalError}
        >
          <div className="grid">
            <div className="muted">{t("blockUserConfirm")}</div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setBlockUser(null)}>
                {t("cancel")}
              </button>
              <button
                className="btn btnWarning"
                onClick={async () => {
                  try {
                    setModalError(null);
                    await api.adminBlockUser(token, blockUser.id);
                    setBlockUser(null);
                    setModalError(null);
                    await load();
                  } catch (e: any) {
                    setModalError(e.message);
                  }
                }}
              >
                {t("block")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {unblockUser ? (
        <Modal
          title={t("unblockUserTitle", { username: unblockUser.username })}
          onClose={() => {
            setUnblockUser(null);
            setModalError(null);
          }}
          error={modalError}
        >
          <div className="grid">
            <div className="muted">{t("unblockUserConfirm")}</div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setUnblockUser(null)}>
                {t("cancel")}
              </button>
              <button
                className="btn btnSuccess"
                onClick={async () => {
                  try {
                    setModalError(null);
                    await api.adminUnblockUser(token, unblockUser.id);
                    setUnblockUser(null);
                    setModalError(null);
                    await load();
                  } catch (e: any) {
                    setModalError(e.message);
                  }
                }}
              >
                {t("unblock")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
