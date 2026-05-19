import { useCallback, useEffect, useState } from "react";
import { BackButton } from "../components/BackButton";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { Modal } from "../components/Modal";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { formatApiErrorMessage } from "../snackbar/formatApiErrorMessage";
import { UserAccessProfileModal } from "../components/UserAccessProfileModal";
import { Can } from "../permissions/Can";
import { PAGE_PERMS } from "../permissions/pagePermissions";
import { usePerm } from "../permissions/PermissionsContext";
import { ViewOnlyBanner } from "../components/ViewOnlyBanner";
import {
  UserCreateProfileFields,
  emptyUserCreateProfileDraft,
  userCreateProfileToBody,
} from "../components/UserCreateProfileFields";

const P = PAGE_PERMS.wilayaAdmins;

export function AdminWilayaAdminsPage({
  token,
  me,
  onSelfProfileSaved,
}: {
  token: string;
  me: api.LoginResponse["user"] & { can_create_wilaya_admins?: boolean };
  onSelfProfileSaved?: (profile: Awaited<ReturnType<typeof api.adminUserAccessProfileGet>>) => void;
}) {
  const { t, i18n } = useTranslation();
  const { can } = usePerm();
  const snack = useSnackbar();
  const canManage = can(P.manage, "manage");

  const [rows, setRows] = useState<api.WilayaAdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [optUsername, setOptUsername] = useState("");
  const [optName, setOptName] = useState("");
  const [createProfile, setCreateProfile] = useState(emptyUserCreateProfileDraft);
  const [createdCreds, setCreatedCreds] = useState<{ code8: string; pdf_url: string } | null>(null);

  const [resetUser, setResetUser] = useState<api.WilayaAdminRow | null>(null);
  const [blockUser, setBlockUser] = useState<api.WilayaAdminRow | null>(null);
  const [unblockUser, setUnblockUser] = useState<api.WilayaAdminRow | null>(null);
  const [profileUser, setProfileUser] = useState<api.WilayaAdminRow | null>(null);

  const canCreate = canManage && Boolean(me.can_create_wilaya_admins);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminWilayaAdminsList(token, {
        page,
        pageSize,
        q: q.trim() || undefined,
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      snack.show(formatApiErrorMessage(raw, t), "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q, snack, t, token]);

  useEffect(() => {
    loadRows().catch(() => {});
  }, [loadRows]);

  function openCreate() {
    setModalError(null);
    setOptUsername("");
    setOptName("");
    setCreateProfile(emptyUserCreateProfileDraft());
    setCreateOpen(true);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="card">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}
      >
        <div className="title" style={{ margin: 0 }}>
          {t("wilayaAdminsAdminTitle")}
        </div>
        <div className="row">
          {canCreate ? (
            <button type="button" className="btn btnPrimary" onClick={openCreate}>
              {t("quickCreateWilayaAdmin")}
            </button>
          ) : null}
          <button type="button" className="btn" onClick={() => loadRows().catch(() => {})}>
            {t("refresh")}
          </button>
          <BackButton />
        </div>
      </div>

      <div className="muted" style={{ marginTop: 8, marginBottom: 14 }}>
        {t("wilayaAdminsAdminIntro")}
      </div>
      {!canManage ? <ViewOnlyBanner /> : null}

      <div className="row" style={{ flexWrap: "wrap", gap: 10, marginBottom: 12, alignItems: "flex-end" }}>
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
          <table className="table" style={{ minWidth: 640, fontSize: 13 }}>
            <thead>
              <tr>
                <th>{t("username")}</th>
                <th>{t("name")}</th>
                <th>{t("accountType")}</th>
                <th>{t("status")}</th>
                <th>{t("canCreateWilayaAdminsCol")}</th>
                <th>{t("accessProfileCol")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSelf = Number(u.id) === Number(me.id);
                return (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.name || "—"}</td>
                    <td>{t("accountTypeWilaya")}</td>
                    <td>{u.is_blocked ? t("blocked") : t("active")}</td>
                    <td>{u.can_create_wilaya_admins ? t("yes") : t("no")}</td>
                    <td className="muted" style={{ maxWidth: 140 }}>
                      {u.access_role_template
                        ? `${i18n.language === "fr" ? u.access_role_template.name_fr : u.access_role_template.name_ar}${
                            u.use_custom_permissions ? ` (${t("accessProfileCustomBadge")})` : ""
                          }`
                        : "—"}
                    </td>
                    <td>
                      <div className="row">
                        {isSelf ? (
                          <button type="button" className="btn" onClick={() => setProfileUser(u)}>
                            {t("myProfileEdit")}
                          </button>
                        ) : canManage ? (
                          <button type="button" className="btn" onClick={() => setProfileUser(u)}>
                            {t("accessProfileEdit")}
                          </button>
                        ) : null}
                        <Can perm={P.manage}>
                          <button type="button" className="btn" onClick={() => setResetUser(u)}>
                            {t("reset")}
                          </button>
                          {!u.is_blocked ? (
                            !isSelf ? (
                              <button type="button" className="btn btnWarning" onClick={() => setBlockUser(u)}>
                                {t("block")}
                              </button>
                            ) : null
                          ) : (
                            <button type="button" className="btn btnSuccess" onClick={() => setUnblockUser(u)}>
                              {t("unblock")}
                            </button>
                          )}
                        </Can>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <div className="muted" style={{ marginTop: 8 }}>
              {t("wilayaAdminsNoRows")}
            </div>
          ) : null}
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
          <button type="button" className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t("next")}
          </button>
        </div>
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
              <button type="button" className="btn" onClick={() => setCreatedCreds(null)}>
                {t("close")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {createOpen ? (
        <Modal
          wide
          title={t("createWilayaAdmin")}
          onClose={() => {
            setCreateOpen(false);
            setModalError(null);
            setOptUsername("");
            setOptName("");
            setCreateProfile(emptyUserCreateProfileDraft());
          }}
          error={modalError}
        >
          <div className="grid">
            <div className="muted">{t("createUserAutoHint")}</div>
            <label className="field">
              <div className="muted">{t("username")}</div>
              <input className="input" value={optUsername} onChange={(e) => setOptUsername(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t("fullNameOptional")}</div>
              <input className="input" value={optName} onChange={(e) => setOptName(e.target.value)} />
            </label>
            <UserCreateProfileFields
              token={token}
              accountScope="wilaya"
              value={createProfile}
              onChange={setCreateProfile}
            />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setCreateOpen(false)}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    setModalError(null);
                    const u = optUsername.trim();
                    if (!u) throw new Error(t("usernameRequired"));
                    if (!/^[A-Za-z0-9_]+$/.test(u)) throw new Error(t("errorUsernameFormat"));
                    if (!createProfile.access_role_template_id) {
                      setModalError(t("accessProfileTemplateRequired"));
                      return;
                    }
                    const res = await api.adminCreateWilayaAdmin(token, {
                      username: u,
                      name: optName.trim() || undefined,
                      ...userCreateProfileToBody(createProfile),
                    });
                    setCreatedCreds(res.credentials);
                    setCreateOpen(false);
                    setOptUsername("");
                    setOptName("");
                    setCreateProfile(emptyUserCreateProfileDraft());
                    snack.show(t("snackbarSaved"), "success");
                    await loadRows();
                  } catch (e: unknown) {
                    const raw =
                      e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
                    setModalError(formatApiErrorMessage(raw, t));
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
              <button type="button" className="btn" onClick={() => setResetUser(null)}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    setModalError(null);
                    const res = await api.adminResetUser(token, resetUser.id);
                    setCreatedCreds(res.credentials);
                    setResetUser(null);
                    snack.show(t("snackbarSaved"), "success");
                    await loadRows();
                  } catch (e: unknown) {
                    const raw =
                      e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
                    setModalError(formatApiErrorMessage(raw, t));
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
              <button type="button" className="btn" onClick={() => setBlockUser(null)}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className="btn btnWarning"
                onClick={async () => {
                  try {
                    setModalError(null);
                    if (Number(blockUser.id) === Number(me.id)) {
                      setModalError(t("cannotBlockSelf"));
                      return;
                    }
                    await api.adminBlockUser(token, blockUser.id);
                    setBlockUser(null);
                    snack.show(t("snackbarSaved"), "success");
                    await loadRows();
                  } catch (e: unknown) {
                    const raw =
                      e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
                    setModalError(formatApiErrorMessage(raw, t));
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
              <button type="button" className="btn" onClick={() => setUnblockUser(null)}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className="btn btnSuccess"
                onClick={async () => {
                  try {
                    setModalError(null);
                    await api.adminUnblockUser(token, unblockUser.id);
                    setUnblockUser(null);
                    snack.show(t("snackbarSaved"), "success");
                    await loadRows();
                  } catch (e: unknown) {
                    const raw =
                      e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
                    setModalError(formatApiErrorMessage(raw, t));
                  }
                }}
              >
                {t("unblock")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {profileUser ? (
        <UserAccessProfileModal
          open
          token={token}
          userId={profileUser.id}
          displayName={profileUser.name || profileUser.username}
          accountScope="wilaya"
          isSelf={Number(profileUser.id) === Number(me.id)}
          canEditRoles={canManage}
          onClose={() => setProfileUser(null)}
          onSaved={() => loadRows().catch(() => {})}
          onProfileSaved={
            Number(profileUser.id) === Number(me.id) ? onSelfProfileSaved : undefined
          }
        />
      ) : null}
    </div>
  );
}
