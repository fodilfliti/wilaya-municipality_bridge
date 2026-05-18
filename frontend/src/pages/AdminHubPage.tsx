import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { Modal } from "../components/Modal";
import { HubTileLink, type HubTile } from "../components/HubTileLink";

export function AdminHubPage({
  token,
  me,
}: {
  token: string;
  me: api.LoginResponse["user"];
}) {
  const { t } = useTranslation();

  const [createWilayaOpen, setCreateWilayaOpen] = useState(false);
  const [wilayaModalError, setWilayaModalError] = useState<string | null>(null);
  const [wilayaUsername, setWilayaUsername] = useState("");
  const [wilayaName, setWilayaName] = useState("");
  const [createdWilayaCreds, setCreatedWilayaCreds] = useState<{
    code8: string;
    pdf_url: string;
  } | null>(null);

  const appsTiles: HubTile[] = [
    {
      to: "/dashboard",
      titleKey: "tileDashboard",
      descKey: "tileDashboardDesc",
      icon: "\u{1F4CA}",
    },
    {
      to: "/apps",
      titleKey: "tileApps",
      descKey: "tileAppsDesc",
      icon: "\u{1F4E6}",
    },
  ];

  const etatTiles: HubTile[] = [
    {
      to: "/etat-principale/backup-servers",
      titleKey: "tileBackupServersTitle",
      descKey: "tileBackupServersDesc",
      icon: "\u{1F5A5}",
    },
    {
      to: "/etat-principale/mclt-workstations",
      titleKey: "tileMcltTitle",
      descKey: "tileMcltDesc",
      icon: "\u{1F4BB}",
    },
    {
      to: "/etat-principale/annex-rnc-authorizations",
      titleKey: "tileAnnexRncTitle",
      descKey: "tileAnnexRncDesc",
      icon: "\u{1F310}",
    },
  ];

  const communeTiles: HubTile[] = [
    {
      to: "/operations",
      titleKey: "tileOperations",
      descKey: "tileOperationsDesc",
      icon: "\u{1F4C8}",
    },
    {
      to: "/municipalities",
      titleKey: "tileMunicipalities",
      descKey: "tileMunicipalitiesDesc",
      icon: "\u{1F3DB}",
    },
    {
      to: "/municipalities",
      titleKey: "tileAnnexesManageTitle",
      descKey: "tileAnnexesManageDesc",
      icon: "\u{1F4DE}",
    },
    {
      to: "/users",
      titleKey: "tileUsers",
      descKey: "tileUsersDesc",
      icon: "\u{1F465}",
    },
    {
      to: "/commune-it-staff",
      titleKey: "tileItStaffTitle",
      descKey: "tileItStaffDesc",
      icon: "\u{1F4BB}",
    },
  ];

  const quick: HubTile[] = [
    {
      to: "/municipalities",
      titleKey: "quickAddCommune",
      descKey: "quickAddCommuneDesc",
      icon: "\u2795",
    },
    {
      to: "/users",
      titleKey: "quickAddAgent",
      descKey: "quickAddAgentDesc",
      icon: "\u{1F464}",
    },
  ];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <div className="title" style={{ marginBottom: 6 }}>
          {t("hubTitle")}
        </div>
        <div className="muted">{t("hubSubtitleAdmin")}</div>
      </div>

      {createdWilayaCreds ? (
        <Modal
          title={t("userCreatedTitle")}
          onClose={() => setCreatedWilayaCreds(null)}
        >
          <div className="grid">
            <div className="muted">
              {t("codeLabel", { code: createdWilayaCreds.code8 })}
            </div>
            <a
              className="btn"
              href={`${import.meta.env.VITE_API_URL || "http://localhost:4000"}${createdWilayaCreds.pdf_url}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("downloadPdf")}
            </a>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setCreatedWilayaCreds(null)}
              >
                {t("close")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {createWilayaOpen ? (
        <Modal
          title={t("createWilayaAdmin")}
          onClose={() => {
            setCreateWilayaOpen(false);
            setWilayaModalError(null);
            setWilayaUsername("");
            setWilayaName("");
          }}
          error={wilayaModalError}
        >
          <div className="grid">
            <div className="muted">{t("createUserAutoHint")}</div>
            <label className="field">
              <div className="muted">{t("username")}</div>
              <input
                className="input"
                value={wilayaUsername}
                onChange={(e) => setWilayaUsername(e.target.value)}
              />
            </label>
            <label className="field">
              <div className="muted">{t("fullNameOptional")}</div>
              <input
                className="input"
                value={wilayaName}
                onChange={(e) => setWilayaName(e.target.value)}
              />
            </label>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btnPrimary"
                onClick={async () => {
                  try {
                    setWilayaModalError(null);
                    const u = wilayaUsername.trim();
                    if (!u) throw new Error(t("usernameRequired"));
                    if (!/^[A-Za-z0-9_]+$/.test(u))
                      throw new Error(t("errorUsernameFormat"));
                    const res = await api.adminCreateWilayaAdmin(token, {
                      username: u,
                      name: wilayaName.trim() || undefined,
                    });
                    setCreatedWilayaCreds(res.credentials);
                    setCreateWilayaOpen(false);
                    setWilayaUsername("");
                    setWilayaName("");
                    setWilayaModalError(null);
                  } catch (e: unknown) {
                    setWilayaModalError(
                      e instanceof Error ? e.message : String(e),
                    );
                  }
                }}
              >
                {t("create")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <div className="card cardSubtle">
        <div style={{ fontWeight: 800, marginBottom: 12 }}>
          {t("hubEtatPrincipaleSection")}
        </div>
        <div className="hubGrid">
          {etatTiles.map((m) => (
            <HubTileLink key={m.to + m.titleKey} tile={m} />
          ))}
        </div>
      </div>

      <div className="card cardSubtle">
        <div style={{ fontWeight: 800, marginBottom: 12 }}>
          {t("hubCommuneSection")}
        </div>
        <div className="hubGrid">
          {communeTiles.map((m) => (
            <HubTileLink key={m.to + m.titleKey} tile={m} />
          ))}
        </div>
      </div>

      <div className="card cardSubtle">
        <div style={{ fontWeight: 800, marginBottom: 12 }}>
          {t("hubAppsSection")}
        </div>
        <div className="hubGrid hubGridPair">
          {appsTiles.map((m) => (
            <HubTileLink key={m.to + m.titleKey} tile={m} />
          ))}
        </div>
      </div>

      <div className="card cardSubtle">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>
          {t("hubQuickSection")}
        </div>
        <div className="hubGrid hubGridCompact">
          {quick.map((m) => (
            <Link
              key={m.to + m.titleKey}
              to={m.to}
              className="hubTile hubTileCompact"
            >
              <div className="hubTileIcon hubTileIconSm" aria-hidden>
                {m.icon}
              </div>
              <div className="hubTileBody">
                <div className="hubTileTitle">{t(m.titleKey)}</div>
                <div className="hubTileDesc muted">{t(m.descKey)}</div>
              </div>
            </Link>
          ))}
          {me.can_create_wilaya_admins ? (
            <button
              type="button"
              className="hubTile hubTileCompact"
              onClick={() => setCreateWilayaOpen(true)}
            >
              <div className="hubTileIcon hubTileIconSm" aria-hidden>
                {"\u{1F3E2}"}
              </div>
              <div className="hubTileBody">
                <div className="hubTileTitle">
                  {t("quickCreateWilayaAdmin")}
                </div>
                <div className="hubTileDesc muted">
                  {t("quickCreateWilayaAdminDesc")}
                </div>
              </div>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
