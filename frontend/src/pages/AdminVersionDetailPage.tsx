import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BackButton } from "../components/BackButton";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { ErrorPopup } from "../components/ErrorPopup";
import { DonutChart } from "../components/DonutChart";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { formatApiErrorMessage } from "../snackbar/formatApiErrorMessage";

type VersionSummary = {
  id: number;
  version_number: string;
  app: { id: number; app_name: string } | null;
  release_notes?: string | null;
};

type MunicipalitySummary = {
  id: number;
  code: string;
  name_ar: string;
  name_fr: string;
};

type VersionMunicipalityRow = {
  municipality: MunicipalitySummary;
  has_downloaded?: boolean;
  last_download_at: string | null;
  downloads_count: number;
};

export function AdminVersionDetailPage({ token }: { token: string }) {
  const { i18n, t } = useTranslation();
  const snack = useSnackbar();
  const params = useParams();
  const versionId = Number(params.versionId);

  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<VersionSummary | null>(null);
  const [rows, setRows] = useState<VersionMunicipalityRow[]>([]);
  const [summary, setSummary] = useState<{
    total_municipalities: number;
    downloaded_municipalities: number;
    not_downloaded_municipalities: number;
  } | null>(null);
  const [selectedMuniId, setSelectedMuniId] = useState<number | "">("");
  const [municipalities, setMunicipalities] = useState<MunicipalitySummary[]>(
    [],
  );
  const [status, setStatus] = useState<"ALL" | "DOWNLOADED" | "NOT_DOWNLOADED">(
    "ALL",
  );

  async function load(next?: { search?: string }) {
    setError(null);
    const s =
      next?.search ??
      (selectedMuniId
        ? String(
            municipalities.find((m) => String(m.id) === String(selectedMuniId))
              ?.code || selectedMuniId,
          )
        : "");
    // Fetch all rows in one request (typical municipalities <= 100)
    const res = await api.adminVersionProgress(token, versionId, {
      status,
      page: 1,
      pageSize: 10000,
      search: s,
    });
    setVersion(res.version as VersionSummary);
    setRows(res.municipalities as VersionMunicipalityRow[]);
    setSummary(res.summary);
  }

  async function loadMunicipalities() {
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
    if (!versionId) return;
    const report = (e: unknown) => {
      const raw =
        e instanceof api.ApiError
          ? e.message
          : String((e as Error)?.message || "VALIDATION_ERROR");
      const msg = formatApiErrorMessage(raw, t);
      setError(msg);
      snack.show(msg, "error");
    };
    loadMunicipalities().catch(report);
    load().catch(report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, status]);

  if (!versionId) {
    return (
      <div className="card">
        <div className="title">{t("version")}</div>
        <div className="muted">{t("invalidVersionId")}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div className="title" style={{ margin: 0 }}>
          {version
            ? `${version.app?.app_name || "App"} — ${version.version_number}`
            : "..."}
        </div>
        <div className="row">
          <button
            className="btn btnPrimary"
            onClick={async () => {
              try {
                setError(null);
                const lang = i18n.language === "fr" ? "fr" : "ar";
                const res = await api.adminVersionProgressPdf(
                  token,
                  versionId,
                  { lang },
                );
                window.open(
                  `${import.meta.env.VITE_API_URL || "http://localhost:4000"}${res.pdf_url}`,
                  "_blank",
                );
              } catch (e: unknown) {
                const raw =
                  e instanceof api.ApiError
                    ? e.message
                    : String((e as Error)?.message || "VALIDATION_ERROR");
                const msg = formatApiErrorMessage(raw, t);
                setError(msg);
                snack.show(msg, "error");
              }
            }}
          >
            {t("pdfReport")}
          </button>
          <button
            className="btn"
            onClick={() =>
              load().catch((e: unknown) => {
                const raw =
                  e instanceof api.ApiError
                    ? e.message
                    : String((e as Error)?.message || "VALIDATION_ERROR");
                const msg = formatApiErrorMessage(raw, t);
                setError(msg);
                snack.show(msg, "error");
              })
            }
          >
            {t("refresh")}
          </button>
          <BackButton fallbackTo={version?.app?.id ? `/apps/${version.app.id}` : "/apps"} />
        </div>
      </div>

      {error ? (
        <ErrorPopup message={error} onClose={() => setError(null)} />
      ) : null}

      {version?.release_notes ? (
        <div className="card cardSubtle" style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 900 }}>{t("releaseNotesTitle")}</div>
          <div
            className="muted"
            style={{ marginTop: 8, whiteSpace: "pre-wrap" }}
          >
            {version.release_notes}
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="card cardSubtle" style={{ marginTop: 10 }}>
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <div className="row">
              <DonutChart
                value={summary.downloaded_municipalities}
                total={summary.total_municipalities}
                progressColor="var(--success)"
                label={t("downloadRate")}
              />
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <div className="statusPill stNo">
                {t("total")}: {summary.total_municipalities}
              </div>
              <div className="statusPill stUp">
                {t("downloaded")}: {summary.downloaded_municipalities}
              </div>
              <div className="statusPill stNever">
                {t("notDownloaded")}: {summary.not_downloaded_municipalities}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 10 }}>
          ...
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "baseline" }}
        >
          <div style={{ fontWeight: 900 }}>{t("filtersAndResults")}</div>
          <div className="chip">{t("filtersLiveHint")}</div>
        </div>

        <div className="card cardSubtle" style={{ marginTop: 12 }}>
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "flex-end" }}
          >
            <label className="field" style={{ minWidth: 280 }}>
              <div className="muted">{t("selectMunicipalityFilter")}</div>
              <select
                className="input"
                value={selectedMuniId === "" ? "" : String(selectedMuniId)}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : "";
                  setSelectedMuniId(id);
                  const muni = id
                    ? municipalities.find((m) => String(m.id) === String(id))
                    : null;
                  load({ search: muni?.code || "" }).catch((err) =>
                    setError(err.message),
                  );
                }}
              >
                <option value="">{t("allMunicipalities")}</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name_ar} — {m.code}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" style={{ minWidth: 240 }}>
              <div className="muted">{t("status")}</div>
              <select
                className="input"
                value={status}
                onChange={(e) => {
                  const v = e.target.value;
                  const st: "ALL" | "DOWNLOADED" | "NOT_DOWNLOADED" =
                    v === "DOWNLOADED"
                      ? "DOWNLOADED"
                      : v === "NOT_DOWNLOADED"
                        ? "NOT_DOWNLOADED"
                        : "ALL";
                  setStatus(st);
                }}
              >
                <option value="ALL">{t("all")}</option>
                <option value="DOWNLOADED">{t("downloaded")}</option>
                <option value="NOT_DOWNLOADED">{t("notDownloadedYet")}</option>
              </select>
            </label>

            <div className="row" style={{ justifyContent: "flex-end" }} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {rows.map((r) => (
            <div key={r.municipality.id} className="card cardSubtle">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>
                    {r.municipality.name_ar}
                  </div>
                  <div className="muted">
                    {r.municipality.name_fr} — {r.municipality.code}
                  </div>
                  <div className="muted">
                    {t("rowStatusLastDownload", {
                      status: r.has_downloaded
                        ? t("downloaded")
                        : t("notDownloaded"),
                      timestamp: r.last_download_at
                        ? new Date(r.last_download_at).toLocaleString()
                        : "—",
                    })}
                  </div>
                </div>
                <div className="row">
                  <div
                    className={
                      r.has_downloaded
                        ? "statusPill stUp"
                        : "statusPill stNever"
                    }
                  >
                    {t("downloadsCount", { count: r.downloads_count })}
                  </div>
                  <Link
                    className="btn btnPrimary"
                    to={`/municipalities/${r.municipality.id}`}
                  >
                    {t("details")}
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="muted">{t("noResults")}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
