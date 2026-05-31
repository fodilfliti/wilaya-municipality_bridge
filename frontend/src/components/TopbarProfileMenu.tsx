import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type TopbarProfileMenuProps = {
  isAdmin: boolean;
  displayName: string;
  onChangeCode: () => void;
  onLogout: () => void;
};

export function TopbarProfileMenu({
  isAdmin,
  displayName,
  onChangeCode,
  onLogout,
}: TopbarProfileMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="topbarProfile" ref={wrapRef}>
      <button
        type="button"
        className="btn topbarProfileToggle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("profileMenu")}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="topbarProfileIcon" aria-hidden>
          {"\u{1F464}"}
        </span>
        <span className="topbarProfileLabel">{t("profileMenu")}</span>
        <span className="topbarProfileChevron" aria-hidden>
          {open ? "\u25BE" : "\u25B8"}
        </span>
      </button>
      {open ? (
        <div className="topbarProfilePanel" role="menu">
          <div className="topbarProfileHeader muted">{displayName}</div>
          {!isAdmin ? (
            <button
              type="button"
              className="topbarProfileItem"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onChangeCode();
              }}
            >
              {t("changeCode")}
            </button>
          ) : null}
          <button
            type="button"
            className="topbarProfileItem topbarProfileItemDanger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            {t("logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
