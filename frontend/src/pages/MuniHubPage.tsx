import { useTranslation } from "react-i18next";
import { HubTileLink, type HubTile } from "../components/HubTileLink";
import { AnnouncementBannerStack } from "../components/AnnouncementBannerStack";

export function MuniHubPage() {
  const { t } = useTranslation();

  const appsTiles: HubTile[] = [
    {
      to: "/apps",
      titleKey: "tileApps",
      descKey: "tileAppsDescMuni",
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
      to: "/commune-it-staff",
      titleKey: "tileItStaffTitle",
      descKey: "tileItStaffDesc",
      icon: "\u{1F4BB}",
    },
    {
      to: "/annexes",
      titleKey: "tileAnnexesTitle",
      descKey: "tileAnnexesDesc",
      icon: "\u{1F4DE}",
    },
  ];

  const quickTiles: HubTile[] = [
    {
      to: "/mail",
      titleKey: "navMail",
      descKey: "hubQuickMailDesc",
      icon: "\u{2709}\u{FE0F}",
    },
  ];

  return (
    <div className="hubPage">
      <div>
        <div className="title" style={{ marginBottom: 4 }}>
          {t("hubTitle")}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {t("hubSubtitleMuni")}
        </div>
      </div>

      <AnnouncementBannerStack />

      <div className="card cardSubtle">
        <h2 className="hubSectionTitle">{t("hubEtatPrincipaleSection")}</h2>
        <div className="hubGrid">
          {etatTiles.map((m) => (
            <HubTileLink key={m.to + m.titleKey} tile={m} />
          ))}
        </div>
      </div>

      <div className="card cardSubtle">
        <h2 className="hubSectionTitle">{t("hubCommuneSection")}</h2>
        <div className="hubGrid">
          {communeTiles.map((m) => (
            <HubTileLink key={m.to + m.titleKey} tile={m} />
          ))}
        </div>
      </div>

      <div className="card cardSubtle">
        <h2 className="hubSectionTitle">{t("hubAppsSection")}</h2>
        <div className="hubGrid">
          {appsTiles.map((m) => (
            <HubTileLink key={m.to + m.titleKey} tile={m} />
          ))}
        </div>
      </div>

      <div className="card cardSubtle">
        <h2 className="hubSectionTitle">{t("hubQuickSection")}</h2>
        <div className="hubGrid hubGridCompact">
          {quickTiles.map((m) => (
            <HubTileLink key={m.to + m.titleKey} tile={m} />
          ))}
        </div>
      </div>
    </div>
  );
}
