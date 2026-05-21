import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { HubTileLink, type HubTile } from "../components/HubTileLink";
import { usePerm } from "../permissions/PermissionsContext";

function filterTiles(tiles: HubTile[], can: (key: string, min?: "view" | "manage") => boolean) {
  return tiles.filter((tile) => {
    if (!tile.permissionKey) return true;
    return can(tile.permissionKey, tile.permissionMin || "view");
  });
}

export function AdminHubPage({
  token: _token,
  me: _me,
}: {
  token: string;
  me: api.LoginResponse["user"];
}) {
  void _token;
  void _me;
  const { t } = useTranslation();
  const { can } = usePerm();

  const appsTiles = useMemo(
    () =>
      filterTiles(
        [
          {
            to: "/dashboard",
            titleKey: "tileDashboard",
            descKey: "tileDashboardDesc",
            icon: "\u{1F4CA}",
            permissionKey: "apps.view",
          },
          {
            to: "/apps",
            titleKey: "tileApps",
            descKey: "tileAppsDesc",
            icon: "\u{1F4E6}",
            permissionKey: "apps.view",
          },
        ],
        can,
      ),
    [can],
  );

  const etatTiles = useMemo(
    () =>
      filterTiles(
        [
          {
            to: "/etat-principale/backup-servers",
            titleKey: "tileBackupServersTitle",
            descKey: "tileBackupServersDesc",
            icon: "\u{1F5A5}",
            permissionKey: "etat.backup_servers.view",
          },
          {
            to: "/etat-principale/mclt-workstations",
            titleKey: "tileMcltTitle",
            descKey: "tileMcltDesc",
            icon: "\u{1F4BB}",
            permissionKey: "etat.mclt.view",
          },
          {
            to: "/etat-principale/annex-rnc-authorizations",
            titleKey: "tileAnnexRncTitle",
            descKey: "tileAnnexRncDesc",
            icon: "\u{1F310}",
            permissionKey: "etat.annex_rnc.view",
          },
        ],
        can,
      ),
    [can],
  );

  const wilayaOrgTiles = useMemo(
    () =>
      filterTiles(
        [
          {
            to: "/wilaya-admins",
            titleKey: "tileWilayaAdmins",
            descKey: "tileWilayaAdminsDesc",
            icon: "\u{1F3E2}",
            permissionKey: "organization.wilaya_admins.view",
          },
          {
            to: "/users",
            titleKey: "tileUsers",
            descKey: "tileUsersDesc",
            icon: "\u{1F465}",
            permissionKey: "organization.commune_agents.view",
          },
          {
            to: "/access-roles",
            titleKey: "tileAccessRoles",
            descKey: "tileAccessRolesDesc",
            icon: "\u{1F510}",
            permissionKey: "organization.access_roles.manage",
            permissionMin: "manage",
          },
        ],
        can,
      ),
    [can],
  );

  const communeTiles = useMemo(
    () =>
      filterTiles(
        [
          {
            to: "/operations",
            titleKey: "tileOperations",
            descKey: "tileOperationsDesc",
            icon: "\u{1F4C8}",
            permissionKey: "operations.view",
          },
          {
            to: "/municipalities",
            titleKey: "tileMunicipalities",
            descKey: "tileMunicipalitiesDesc",
            icon: "\u{1F3DB}",
            permissionKey: "organization.municipalities.view",
          },
          {
            to: "/municipalities",
            titleKey: "tileAnnexesManageTitle",
            descKey: "tileAnnexesManageDesc",
            icon: "\u{1F4DE}",
            permissionKey: "annexes.view",
          },
          {
            to: "/commune-it-staff",
            titleKey: "tileItStaffTitle",
            descKey: "tileItStaffDesc",
            icon: "\u{1F4BB}",
            permissionKey: "commune_it_staff.view",
          },
          {
            to: "/announcements",
            titleKey: "tileAnnouncementsTitle",
            descKey: "tileAnnouncementsDesc",
            icon: "\u{1F4E2}",
            permissionKey: "announcements.view",
          },
        ],
        can,
      ),
    [can],
  );

  const quick = useMemo(
    () =>
      filterTiles(
        [
          {
            to: "/municipalities",
            titleKey: "quickAddCommune",
            descKey: "quickAddCommuneDesc",
            icon: "\u2795",
            permissionKey: "organization.municipalities.manage",
            permissionMin: "manage",
          },
          {
            to: "/wilaya-admins",
            titleKey: "quickCreateWilayaAdmin",
            descKey: "quickCreateWilayaAdminDesc",
            icon: "\u{1F3E2}",
            permissionKey: "organization.wilaya_admins.manage",
            permissionMin: "manage",
          },
          {
            to: "/users",
            titleKey: "quickAddAgent",
            descKey: "quickAddAgentDesc",
            icon: "\u{1F464}",
            permissionKey: "organization.commune_agents.manage",
            permissionMin: "manage",
          },
        ],
        can,
      ),
    [can],
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <div className="title" style={{ marginBottom: 6 }}>
          {t("hubTitle")}
        </div>
        <div className="muted">{t("hubSubtitleAdmin")}</div>
      </div>

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
        <div style={{ fontWeight: 800, marginBottom: 12 }}>{t("hubWilayaOrgSection")}</div>
        <div className="hubGrid hubGridPair">
          {wilayaOrgTiles.map((m) => (
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
        </div>
      </div>
    </div>
  );
}
