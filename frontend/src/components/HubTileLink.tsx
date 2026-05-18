import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export type HubTile = {
  to: string;
  titleKey: string;
  descKey: string;
  icon: string;
};

export function HubTileLink({ tile }: { tile: HubTile }) {
  const { t } = useTranslation();
  return (
    <Link to={tile.to} className="hubTile">
      <div className="hubTileIcon" aria-hidden>
        {tile.icon}
      </div>
      <div className="hubTileBody">
        <div className="hubTileTitle">{t(tile.titleKey)}</div>
        <div className="hubTileDesc muted">{t(tile.descKey)}</div>
      </div>
    </Link>
  );
}
