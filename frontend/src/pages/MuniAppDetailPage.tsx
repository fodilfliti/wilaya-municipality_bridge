import { useEffect, useMemo, useState } from "react";
import { BackButton } from '../components/BackButton'
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { formatApiErrorMessage } from "../snackbar/formatApiErrorMessage";

export function MuniAppDetailPage({ token }: { token: string }) {
  const { t } = useTranslation();
  const snack = useSnackbar();
  const { appId } = useParams();
  const numericAppId = useMemo(() => Number(appId), [appId]);
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [app, setApp] = useState<any | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [last, setLast] = useState<any | null>(null);

  function statusLabel(st: string) {
    if (st === "UP_TO_DATE") return t("upToDate");
    if (st === "OUTDATED") return t("outdated");
    if (st === "NEVER_DOWNLOADED") return t("neverDownloaded");
    if (st === "NO_VERSIONS") return t("noVersions");
    return st;
  }

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.muniGetApp(token, numericAppId);
      setApp(res.app);
      setVersions(res.versions || []);
      setStatus(res.status || null);
      setLast(res.last || null);
    } catch (e: unknown) {
      const raw =
        e instanceof api.ApiError
          ? e.message
          : String((e as Error)?.message || "Erreur");
      const msg = formatApiErrorMessage(raw, t);
      setError(msg);
      snack.show(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!numericAppId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericAppId]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          {app?.logo_url ? (
            <img
              src={
                String(app.logo_url).startsWith("http")
                  ? app.logo_url
                  : `${apiBase}${app.logo_url}`
              }
              alt=""
              width={44}
              height={44}
              style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--logoBg)",
              }}
            />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--logoBg)",
                flex: "0 0 auto",
              }}
            />
          )}
          <div>
            <div className="title">
              {app?.app_name ? app.app_name : t("apps")}
            </div>
            <div className="muted">{app?.description || ""}</div>
          </div>
        </div>
        <div className="row">
          <button className="btn btnPrimary" onClick={refresh}>
            {t("refresh")}
          </button>
          <BackButton fallbackTo="/apps" />
        </div>
      </div>

      {error ? <div className="muted">{error}</div> : null}
      {loading ? (
        <div className="muted">...</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="card cardSubtle">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {status ? (
                  <div className="chip">{statusLabel(status)}</div>
                ) : null}
                {app?.currentVersion ? (
                  <div className="chip">
                    {t("latest")}: {app.currentVersion.version_number}
                  </div>
                ) : (
                  <div className="chip">{t("noVersions")}</div>
                )}
                {last ? (
                  <div className="chip">
                    {t("lastDownloadAt", {
                      version: last.version_number,
                      timestamp: last.timestamp
                        ? new Date(last.timestamp).toLocaleString()
                        : "",
                    })}
                  </div>
                ) : (
                  <div className="chip">{t("notDownloadedYet")}</div>
                )}
              </div>
            </div>
          </div>

          <div className="card cardSubtle">
            <div className="title" style={{ fontSize: 16 }}>
              {t("allVersions")}
            </div>
            {versions.length === 0 ? (
              <div className="muted">{t("noVersions")}</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {versions.map((v: any) => (
                  <div
                    key={v.id}
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>{v.version_number}</div>
                      {v.release_notes ? (
                        <div className="muted">{v.release_notes}</div>
                      ) : null}
                      {v.created_at ? (
                        <div className="muted">
                          {new Date(v.created_at).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                    <button
                      className="btn btnSuccess"
                      onClick={async () => {
                        try {
                          const res = await api.muniDownload(token, v.id);
                          window.open(
                            `${import.meta.env.VITE_API_URL || "http://localhost:4000"}${res.file_url}`,
                            "_blank",
                          );
                          await refresh();
                        } catch (e: any) {
                          setError(e.message);
                        }
                      }}
                    >
                      {t("download")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
