import { useEffect, useMemo, useState } from "react";
import { BackButton } from '../components/BackButton'
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { ErrorPopup } from "../components/ErrorPopup";
import { HubTileLink, type HubTile } from "../components/HubTileLink";
import { Modal } from "../components/Modal";
import {
  MuniDetailSectionNav,
  type MuniDetailSection,
  type MuniDetailSectionDef,
} from "../components/MuniDetailSectionChip";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { formatApiErrorMessage } from "../snackbar/formatApiErrorMessage";
import { Can } from "../permissions/Can";
import { PAGE_PERMS } from "../permissions/pagePermissions";

const SECTIONS: MuniDetailSectionDef[] = [
  { id: "apps", titleKey: "muniDetailTabApps", descKey: "muniDetailTabAppsDesc", icon: "\u{1F4E6}" },
  { id: "etat", titleKey: "muniDetailTabEtat", descKey: "muniDetailTabEtatDesc", icon: "\u{1F5A5}" },
  { id: "users", titleKey: "muniDetailTabUsers", descKey: "muniDetailTabUsersDesc", icon: "\u{1F465}" },
  { id: "annexes", titleKey: "muniDetailTabAnnexes", descKey: "muniDetailTabAnnexesDesc", icon: "\u{1F4DE}" },
];

function parseTab(raw: string | null): MuniDetailSection {
  if (raw === "users" || raw === "annexes" || raw === "apps" || raw === "etat") return raw;
  return "apps";
}

export function AdminMunicipalityDetailPage({ token }: { token: string }) {
  const { t } = useTranslation();
  const snack = useSnackbar();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const municipalityId = Number(params.municipalityId);
  const activeTab = parseTab(searchParams.get("tab"));

  const [error, setError] = useState<string | null>(null);
  const [municipality, setMunicipality] = useState<any | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [annexes, setAnnexes] = useState<any[]>([]);
  const [annexStatuses, setAnnexStatuses] = useState<string[]>([]);
  const [annexVillePositions, setAnnexVillePositions] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const usersPageSize = 10;

  const [annexModalOpen, setAnnexModalOpen] = useState(false);
  const [annexModalError, setAnnexModalError] = useState<string | null>(null);
  const [editingAnnexId, setEditingAnnexId] = useState<number | null>(null);
  const [annexName, setAnnexName] = useState("");
  const [annexPhones, setAnnexPhones] = useState("");
  const [annexStatus, setAnnexStatus] = useState("NEW_NOT_YET_ACTIVE");
  const [annexVillePosition, setAnnexVillePosition] = useState("INSIDE_VILLE");

  const summary = useMemo(() => {
    const counts = {
      UP_TO_DATE: 0,
      OUTDATED: 0,
      NEVER_DOWNLOADED: 0,
      NO_VERSIONS: 0,
      DOWNGRADE: 0,
      TOTAL: 0,
    };
    for (const a of apps || []) {
      counts.TOTAL += 1;
      const st = String(a.status || "");
      if (st === "UP_TO_DATE") counts.UP_TO_DATE += 1;
      else if (st === "OUTDATED") counts.OUTDATED += 1;
      else if (st === "NO_VERSIONS") counts.NO_VERSIONS += 1;
      else counts.NEVER_DOWNLOADED += 1;
      if (a.downgrade) counts.DOWNGRADE += 1;
    }
    return counts;
  }, [apps]);

  const usersTotalPages = useMemo(
    () => Math.max(1, Math.ceil(usersTotal / usersPageSize)),
    [usersTotal],
  );

  const etatTiles: HubTile[] = useMemo(
    () => [
      {
        to: `/etat-principale/backup-servers?municipalityId=${municipalityId}`,
        titleKey: "tileBackupServersTitle",
        descKey: "tileBackupServersDesc",
        icon: "\u{1F5A5}",
      },
      {
        to: `/etat-principale/mclt-workstations?municipalityId=${municipalityId}`,
        titleKey: "tileMcltTitle",
        descKey: "tileMcltDesc",
        icon: "\u{1F4BB}",
      },
      {
        to: `/etat-principale/annex-rnc-authorizations?municipalityId=${municipalityId}`,
        titleKey: "tileAnnexRncTitle",
        descKey: "tileAnnexRncDesc",
        icon: "\u{1F310}",
      },
    ],
    [municipalityId],
  );

  function setTab(tab: MuniDetailSection) {
    setSearchParams({ tab }, { replace: true });
  }

  async function loadCore() {
    setError(null);
    const [overview, appsRes, annexRes] = await Promise.all([
      api.adminMunicipalityOverview(token, municipalityId),
      api.adminMunicipalityApps(token, municipalityId),
      api.adminListMunicipalityAnnexes(token, municipalityId),
    ]);
    setMunicipality(overview.municipality);
    setApps(appsRes.apps);
    setAnnexes(annexRes.annexes || []);
    setAnnexStatuses(annexRes.statuses || []);
    setAnnexVillePositions(annexRes.ville_positions || []);
  }

  async function loadUsers() {
    const res = await api.adminListMunicipalityUsers(token, municipalityId, {
      page: usersPage,
      pageSize: usersPageSize,
    });
    setUsers(res.users);
    setUsersTotal(res.total);
  }

  function resetAnnexForm() {
    setEditingAnnexId(null);
    setAnnexName("");
    setAnnexPhones("");
    setAnnexStatus("NEW_NOT_YET_ACTIVE");
    setAnnexVillePosition("INSIDE_VILLE");
    setAnnexModalError(null);
  }

  function openAnnexCreate() {
    resetAnnexForm();
    setAnnexModalOpen(true);
  }

  function openAnnexEdit(a: any) {
    setEditingAnnexId(Number(a.id));
    setAnnexName(String(a.name || ""));
    setAnnexPhones(String(a.phone_numbers || ""));
    setAnnexStatus(String(a.status || "NEW_NOT_YET_ACTIVE"));
    setAnnexVillePosition(String(a.ville_position || "INSIDE_VILLE"));
    setAnnexModalError(null);
    setAnnexModalOpen(true);
  }

  async function saveAnnexModal() {
    const name = annexName.trim();
    if (!name) {
      setAnnexModalError(t("annexNameRequired"));
      return;
    }
    setAnnexModalError(null);
    try {
      const body = {
        name,
        phone_numbers: annexPhones.trim() || null,
        status: annexStatus,
        ville_position: annexVillePosition,
      };
      if (editingAnnexId != null) {
        await api.adminUpdateMunicipalityAnnex(token, municipalityId, editingAnnexId, body);
      } else {
        await api.adminCreateMunicipalityAnnex(token, municipalityId, body);
      }
      setAnnexModalOpen(false);
      resetAnnexForm();
      await loadCore();
      snack.show(t("snackbarSaved"), "success");
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      setAnnexModalError(formatApiErrorMessage(raw, t));
    }
  }

  async function deleteAnnex(id: number) {
    if (!window.confirm(t("annexDeleteConfirm"))) return;
    try {
      await api.adminDeleteMunicipalityAnnex(token, municipalityId, id);
      await loadCore();
      snack.show(t("snackbarSaved"), "success");
    } catch (e: unknown) {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      snack.show(formatApiErrorMessage(raw, t), "error");
    }
  }

  useEffect(() => {
    if (!municipalityId) return;
    loadCore().catch((e: unknown) => {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      const msg = formatApiErrorMessage(raw, t);
      setError(msg);
      snack.show(msg, "error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipalityId]);

  useEffect(() => {
    if (!municipalityId || activeTab !== "users") return;
    loadUsers().catch((e: unknown) => {
      const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
      snack.show(formatApiErrorMessage(raw, t), "error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipalityId, activeTab, usersPage]);

  if (!municipalityId) {
    return (
      <div className="card">
        <div className="title">{t("navMunicipalities")}</div>
        <div className="muted">{t("invalidMunicipalityId")}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="title">{municipality ? municipality.name_ar : "..."}</div>
          <div className="muted">
            {municipality ? `${municipality.name_fr} — ${municipality.code}` : ""}
          </div>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() =>
              loadCore().catch((e: unknown) => {
                const raw = e instanceof api.ApiError ? e.message : String((e as Error)?.message || "Erreur");
                const msg = formatApiErrorMessage(raw, t);
                setError(msg);
                snack.show(msg, "error");
              })
            }
          >
            {t("refresh")}
          </button>
          <BackButton fallbackTo="/municipalities" />
        </div>
      </div>

      {error ? <ErrorPopup message={error} onClose={() => setError(null)} /> : null}

      <div style={{ marginTop: 16 }}>
        <MuniDetailSectionNav sections={SECTIONS} active={activeTab} onChange={setTab} />
      </div>

      <div style={{ marginTop: 16 }} role="tabpanel">
        {activeTab === "users" ? (
          <div className="card cardSubtle">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("muniDetailTabUsers")}</div>
                <div className="muted">{t("muniDetailUsersHint")}</div>
              </div>
              <Can perm={PAGE_PERMS.communeAgents.manage}>
                <Link className="btn btnPrimary" to={`/users?municipalityId=${municipalityId}`}>
                  {t("muniDetailManageUsers")}
                </Link>
              </Can>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {users.map((u) => (
                <div key={u.id} className="card cardSubtle" style={{ padding: 10 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{u.username}</div>
                      {u.name ? <div className="muted">{u.name}</div> : null}
                    </div>
                    <span className={u.is_blocked ? "statusPill stOut" : "statusPill stUp"}>
                      {u.is_blocked ? t("blocked") : t("active")}
                    </span>
                  </div>
                </div>
              ))}
              {users.length === 0 ? <div className="muted">{t("noUsers")}</div> : null}
            </div>
            {usersTotal > usersPageSize ? (
              <div className="row" style={{ justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
                <div className="muted">
                  {t("paginationSummary", { page: usersPage, totalPages: usersTotalPages, total: usersTotal })}
                </div>
                <div className="row">
                  <button type="button" className="btn" disabled={usersPage <= 1} onClick={() => setUsersPage((p) => p - 1)}>
                    {t("prev")}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={usersPage >= usersTotalPages}
                    onClick={() => setUsersPage((p) => p + 1)}
                  >
                    {t("next")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "annexes" ? (
          <div className="card cardSubtle">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("annexesSectionTitle")}</div>
                <div className="muted">{t("annexesSectionAdminHint")}</div>
              </div>
              <Can perm={PAGE_PERMS.annexes.manage}>
                <button type="button" className="btn btnPrimary" onClick={openAnnexCreate}>
                  {t("annexAdd")}
                </button>
              </Can>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {annexes.map((a) => (
                <div key={a.id} className="card cardSubtle" style={{ padding: 10 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{a.name}</div>
                      {a.phone_numbers ? (
                        <div className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                          {t("annexPhones")}: {a.phone_numbers}
                        </div>
                      ) : null}
                      <div className="muted" style={{ marginTop: 4 }}>
                        {t("annexVillePosition")}: {t(`annexVillePosition_${String(a.ville_position || "INSIDE_VILLE")}`)}
                      </div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {t("annexStatus")}: {t(`annexStatus_${a.status}`)}
                      </div>
                    </div>
                    <div className="row" style={{ flexShrink: 0 }}>
                      <Can perm={PAGE_PERMS.annexes.manage}>
                        <button type="button" className="btn" onClick={() => openAnnexEdit(a)}>
                          {t("edit")}
                        </button>
                        <button type="button" className="btn" onClick={() => deleteAnnex(Number(a.id))}>
                          {t("delete")}
                        </button>
                      </Can>
                    </div>
                  </div>
                </div>
              ))}
              {annexes.length === 0 ? <div className="muted">{t("annexNoRows")}</div> : null}
            </div>
          </div>
        ) : null}

        {activeTab === "apps" ? (
          <>
            <div className="card cardSubtle">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ minWidth: 280 }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("municipalityProgressSummaryTitle")}</div>
                  <div className="muted">{t("municipalityProgressSummaryHint")}</div>
                </div>
                <div className="row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <div className="statusPill stNo">
                    {t("total")}: {summary.TOTAL}
                  </div>
                  <div className="statusPill stUp">
                    {t("upToDate")}: {summary.UP_TO_DATE}
                  </div>
                  <div className="statusPill stOut">
                    {t("outdated")}: {summary.OUTDATED}
                  </div>
                  <div className="statusPill stNever">
                    {t("neverDownloaded")}: {summary.NEVER_DOWNLOADED}
                  </div>
                  {summary.NO_VERSIONS > 0 ? (
                    <div className="statusPill stNo">
                      {t("noVersions")}: {summary.NO_VERSIONS}
                    </div>
                  ) : null}
                  <div
                    className="chip"
                    style={{
                      borderColor: "rgba(245, 158, 11, 0.35)",
                      background: "rgba(245, 158, 11, 0.1)",
                      color: "var(--warning)",
                    }}
                  >
                    {t("downgrade")}: {summary.DOWNGRADE}
                  </div>
                </div>
              </div>
              <div className="stackBar" style={{ marginTop: 12 }}>
                <div
                  className="seg segUp"
                  style={{ width: `${(summary.UP_TO_DATE / Math.max(1, summary.TOTAL)) * 100}%` }}
                />
                <div
                  className="seg segOut"
                  style={{ width: `${(summary.OUTDATED / Math.max(1, summary.TOTAL)) * 100}%` }}
                />
                <div
                  className="seg segNever"
                  style={{ width: `${(summary.NEVER_DOWNLOADED / Math.max(1, summary.TOTAL)) * 100}%` }}
                />
                <div
                  className="seg segNo"
                  style={{ width: `${(summary.NO_VERSIONS / Math.max(1, summary.TOTAL)) * 100}%` }}
                />
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {apps.map((a) => {
                const cls =
                  a.status === "UP_TO_DATE"
                    ? "statusPill stUp"
                    : a.status === "OUTDATED"
                      ? "statusPill stOut"
                      : a.status === "NEVER_DOWNLOADED"
                        ? "statusPill stNever"
                        : "statusPill stNo";
                const label =
                  a.status === "UP_TO_DATE"
                    ? t("upToDate")
                    : a.status === "OUTDATED"
                      ? t("outdated")
                      : a.status === "NEVER_DOWNLOADED"
                        ? t("neverDownloaded")
                        : t("noVersions");

                return (
                  <div key={a.app_id} className="card cardSubtle">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{a.app_name}</div>
                        {a.last ? (
                          <div className="muted">
                            {t("lastDownloadAt", {
                              version: a.last.version_number,
                              timestamp: new Date(a.last.timestamp).toLocaleString(),
                            })}
                          </div>
                        ) : (
                          <div className="muted">{t("lastDownloadAtEmpty")}</div>
                        )}
                        {a.downgrade ? <div className="muted">{t("downgradeDetectedNote")}</div> : null}
                      </div>
                      <div className="row">
                        {a.downgrade ? (
                          <div
                            className="chip"
                            style={{
                              borderColor: "rgba(245, 158, 11, 0.35)",
                              background: "rgba(245, 158, 11, 0.1)",
                              color: "var(--warning)",
                            }}
                          >
                            {t("downgrade")}
                          </div>
                        ) : null}
                        <div className={cls}>{label}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {apps.length === 0 ? <div className="muted">{t("noApps")}</div> : null}
            </div>
          </>
        ) : null}

        {activeTab === "etat" ? (
          <div className="card cardSubtle">
            <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("muniDetailTabEtat")}</div>
            <div className="muted" style={{ marginBottom: 12 }}>
              {t("muniDetailEtatHint")}
            </div>
            <div className="hubGrid">
              {etatTiles.map((tile) => (
                <HubTileLink key={tile.to} tile={tile} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {annexModalOpen ? (
        <Modal
          title={editingAnnexId != null ? t("annexTitleEdit") : t("annexAdd")}
          error={annexModalError}
          onClose={() => {
            setAnnexModalOpen(false);
            resetAnnexForm();
          }}
        >
          <div className="grid" style={{ gap: 10 }}>
            <label className="field">
              <div className="muted">{t("annexName")}</div>
              <input className="input" value={annexName} onChange={(e) => setAnnexName(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t("annexPhones")}</div>
              <textarea className="input" rows={2} value={annexPhones} onChange={(e) => setAnnexPhones(e.target.value)} />
            </label>
            <label className="field">
              <div className="muted">{t("annexVillePosition")}</div>
              <select className="input" value={annexVillePosition} onChange={(e) => setAnnexVillePosition(e.target.value)}>
                {(annexVillePositions.length ? annexVillePositions : ["INSIDE_VILLE", "OUTSIDE_VILLE"]).map((p) => (
                  <option key={p} value={p}>
                    {t(`annexVillePosition_${p}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <div className="muted">{t("annexStatus")}</div>
              <select className="input" value={annexStatus} onChange={(e) => setAnnexStatus(e.target.value)}>
                {(annexStatuses.length ? annexStatuses : ["NEW_NOT_YET_ACTIVE"]).map((s) => (
                  <option key={s} value={s}>
                    {t(`annexStatus_${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setAnnexModalOpen(false);
                  resetAnnexForm();
                }}
              >
                {t("cancel")}
              </button>
              <button type="button" className="btn btnPrimary" onClick={() => saveAnnexModal().catch(() => {})}>
                {t("submit")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
