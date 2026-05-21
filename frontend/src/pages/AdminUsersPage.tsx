import { useCallback, useEffect, useState } from "react";
import { BackButton } from "../components/BackButton";
import { useSearchParams } from "react-router-dom";
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

const P = PAGE_PERMS.communeAgents;

type MuniOpt = { id: number; code: string; name_ar: string; name_fr: string };

export function AdminUsersPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const { can } = usePerm();
  const lang = i18n.language === "fr" ? "fr" : "ar";
  const snack = useSnackbar();
  const canManage = can(P.manage, "manage");
  const [searchParams] = useSearchParams();
  const initialMuniId = Number(searchParams.get("municipalityId") || "") || "";

  const [rows, setRows] = useState<api.CommuneAgentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [filterMunicipalityId, setFilterMunicipalityId] = useState<number | "">(initialMuniId);
  const [municipalities, setMunicipalities] = useState<MuniOpt[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [formMunicipalityId, setFormMunicipalityId] = useState<number | "">("");
  const [optUsername, setOptUsername] = useState("");
  const [optName, setOptName] = useState("");
  const [createProfile, setCreateProfile] = useState(emptyUserCreateProfileDraft);
  const [createdCreds, setCreatedCreds] = useState<{ code8: string; pdf_url: string } | null>(null);

  const [resetUser, setResetUser] = useState<api.CommuneAgentRow | null>(null);
  const [blockUser, setBlockUser] = useState<api.CommuneAgentRow | null>(null);
  const [unblockUser, setUnblockUser] = useState<api.CommuneAgentRow | null>(null);
  const [profileUser, setProfileUser] = useState<api.CommuneAgentRow | null>(null);

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
      const res = await api.adminCommuneAgentsList(token, {
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
    setModalError(null);
    setFormMunicipalityId(
      filterMunicipalityId !== "" ? filterMunicipalityId : municipalities[0]?.id ?? "",
    );
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
          {t("communeAgentsAdminTitle")}
        </div>
        <div className="row">
          <Can perm={P.manage}>
            <button type="button" className="btn btnPrimary" onClick={openCreate}>
              {t("createUserCta")}
            </button>
          </Can>
          <button type="button" className="btn" onClick={() => void loadRows()}>
            {t("refresh")}
          </button>
          <BackButton />
        </div>
      </div>

      <div className="muted" style={{ marginTop: 8, marginBottom: 14 }}>
        {t("communeAgentsAdminIntro")}
      </div>
      {!canManage ? <ViewOnlyBanner /> : null}

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
          <table className="table" style={{ minWidth: 720, fontSize: 13 }}>
            <thead>
              <tr>
                <th>{t("municipalityCode")}</th>
                <th>{t("itStaffCommune")}</th>
                <th>{t("username")}</th>
                <th>{t("name")}</th>
                <th>{t("accountType")}</th>
                <th>{t("status")}</th>
                <th>{t("accessProfileCol")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.municipality?.code ?? "—"}</td>
                  <td>{muniLabel(u.municipality ?? undefined)}</td>
                  <td>{u.username}</td>
                  <td>{u.name || "—"}</td>
                  <td>{t("accountTypeCommune")}</td>
                  <td>{u.is_blocked ? t("blocked") : t("active")}</td>
                  <td className="muted" style={{ maxWidth: 140 }}>
                    {u.access_role_template
                      ? lang === "fr"
                        ? u.access_role_template.name_fr
                        : u.access_role_template.name_ar
                      : "—"}
                  </td>
                  <td>
                    <div className="row">
                      <Can perm={P.manage}>
                        <button type="button" className="btn" onClick={() => setProfileUser(u)}>
                          {t("accessProfileEdit")}
                        </button>
                        <button type="button" className="btn" onClick={() => setResetUser(u)}>
                          {t("reset")}
                        </button>
                        {!u.is_blocked ? (
                          <button type="button" className="btn btnWarning" onClick={() => setBlockUser(u)}>
                            {t("block")}
                          </button>
                        ) : (
                          <button type="button" className="btn btnSuccess" onClick={() => setUnblockUser(u)}>
                            {t("unblock")}
                          </button>
                        )}
                      </Can>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <div className="muted" style={{ marginTop: 8 }}>
              {t("noUsers")}
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
          title={t("createMuniUser")}
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
              <div className="muted">{t("username")}</div>
              <input className="input" value={optUsername} onChange={(e) => setOptUsername(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t("fullNameOptional")}</div>
              <input className="input" value={optName} onChange={(e) => setOptName(e.target.value)} />
            </label>
            <UserCreateProfileFields
              token={token}
              accountScope="commune"
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
                    const mid = Number(formMunicipalityId);
                    if (!Number.isFinite(mid) || mid < 1) {
                      setModalError(t("municipalityIdRequired"));
                      return;
                    }
                    const u = optUsername.trim();
                    if (!u) throw new Error(t("usernameRequired"));
                    if (!/^[A-Za-z0-9_]+$/.test(u)) throw new Error(t("errorUsernameFormat"));
                    if (!createProfile.access_role_template_id) {
                      setModalError(t("accessProfileTemplateRequired"));
                      return;
                    }
                    const res = await api.adminCreateMuniUser(token, mid, {
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
          accountScope="commune"
          onClose={() => setProfileUser(null)}
          onSaved={() => void loadRows()}
        />
      ) : null}
    </div>
  );
}
