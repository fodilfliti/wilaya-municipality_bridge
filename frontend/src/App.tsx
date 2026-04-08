import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "./api";

import "./App.css";
import { AdminAppsListPage } from "./pages/AdminAppsListPage";
import { AdminAppDetailPage } from "./pages/AdminAppDetailPage";
import { AdminMunicipalitiesListPage } from "./pages/AdminMunicipalitiesListPage";
import { AdminMunicipalityDetailPage } from "./pages/AdminMunicipalityDetailPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminVersionDetailPage } from "./pages/AdminVersionDetailPage";
import { ErrorPopup } from "./components/ErrorPopup";
import { MuniAppDetailPage } from "./pages/MuniAppDetailPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { MuniAppsPage } from "./pages/MuniAppsPage";
import { LoginModal } from "./components/LoginModal";
import { ChangeCodeModal } from "./components/ChangeCodeModal";
import { MailInboxPage } from "./pages/MailInboxPage";
import { MailThreadPage } from "./pages/MailThreadPage";

function App() {
  const { t, i18n } = useTranslation();
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );
  const [me, setMe] = useState<api.LoginResponse["user"] | null>(() => {
    const raw = localStorage.getItem("me");
    return raw ? (JSON.parse(raw) as any) : null;
  });

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [progress, setProgress] = useState<any[] | null>(null);
  const [apps, setApps] = useState<any[] | null>(null);
  const [mailUnread, setMailUnread] = useState<number>(0);

  const [changeCodeOpen, setChangeCodeOpen] = useState(false);

  const navigate = useNavigate();
  const isAdmin = me?.role === "SUPER_ADMIN";

  const dir = useMemo(
    () => (i18n.language === "fr" ? "ltr" : "rtl"),
    [i18n.language],
  );
  const lang = useMemo(
    () => (i18n.language === "fr" ? "fr" : "ar"),
    [i18n.language],
  );

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [dir, lang]);

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
    setProgress(null);
    setApps(null);
    setChangeCodeOpen(false);
    localStorage.removeItem("token");
    localStorage.removeItem("me");
  }, []);

  const refreshAdmin = useCallback(async () => {
    if (!token) return;
    const progPromise = api.adminProgress(token);
    const appsAllPromise = (async () => {
      const out: any[] = [];
      let page = 1;
      const pageSize = 50;
      while (true) {
        const res = await api.adminListApps(token, { page, pageSize });
        out.push(...res.apps);
        if (out.length >= res.total) break;
        page += 1;
        if (page > 20) break;
      }
      return out;
    })();
    const [prog, appsAll] = await Promise.all([progPromise, appsAllPromise]);
    setProgress(prog.municipalities);
    setApps(appsAll);
  }, [token]);

  const refreshMuniApps = useCallback(async () => {
    if (!token) return;
    const res = await api.muniApps(token);
    setApps(res.apps);
  }, [token]);

  const refreshMailUnread = useCallback(async () => {
    if (!token || !me) return;
    const res = isAdmin ? await api.adminMailUnreadCount(token) : await api.muniMailUnreadCount(token);
    setMailUnread(Number(res.unread || 0));
  }, [isAdmin, me, token]);

  useEffect(() => {
    if (!token || !me) return;
    const handleAuthError = (e: unknown) => {
      const err = e as any
      if (err && typeof err === 'object' && err.status === 401) {
        // Token expired/invalid -> force login
        setError(null)
        setLoginNotice(t('sessionExpired'))
        setLoginOpen(true)
        logout()
        return
      }
      setError(err?.message || 'Erreur')
    }
    if (isAdmin) refreshAdmin().catch(handleAuthError);
    else refreshMuniApps().catch(handleAuthError);
    refreshMailUnread().catch(() => {});
  }, [isAdmin, me, refreshAdmin, refreshMuniApps, token]);

  useEffect(() => {
    if (!token || !me) return;
    const id = window.setInterval(() => refreshMailUnread().catch(() => {}), 20000);
    return () => window.clearInterval(id);
  }, [me, refreshMailUnread, token]);

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <Link
            to="/"
            className="brandTitle"
            style={{ textDecoration: "none" }}
          >
            {t("appTitle")}
          </Link>
          {me ? (
            <div className="chip">
              {isAdmin ? t("roleAdmin") : t("roleMuni")}
            </div>
          ) : (
            <div className="chip">{t("login")}</div>
          )}
        </div>

        <div className="actions">
          <button
            className="btn"
            onClick={() => {
              const next = i18n.language === "fr" ? "ar" : "fr"
              localStorage.setItem("lang", next)
              i18n.changeLanguage(next)
            }}
          >
            {i18n.language === "fr" ? t("langArabic") : t("langFrench")}
          </button>
          {!me ? (
            <button
              className="btn btnPrimary"
              onClick={() => setLoginOpen(true)}
            >
              {t("login")}
            </button>
          ) : (
            <>
              {!isAdmin ? (
                <button className="btn" onClick={() => setChangeCodeOpen(true)}>
                  {t("changeCode")}
                </button>
              ) : null}
              <button
                className="btn"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                {t("logout")}
              </button>
            </>
          )}
        </div>
      </div>

      {me && isAdmin && (
        <div className="row" style={{ marginBottom: 12 }}>
          <NavLink to="/" end className="btn">
            {t("adminDashboard")}
          </NavLink>
          <NavLink to="/apps" className="btn">
            {t("navApps")}
          </NavLink>
          <NavLink to="/municipalities" className="btn">
            {t("navMunicipalities")}
          </NavLink>
          <NavLink to="/users" className="btn">
            {t("navUsers")}
          </NavLink>
          <NavLink to="/mail" className="btn">
            <span className="btnLabel">
              {t("navMail")}
              {mailUnread > 0 ? <span className="badge">{mailUnread > 99 ? '99+' : mailUnread}</span> : null}
            </span>
          </NavLink>
        </div>
      )}

      {me && !isAdmin && (
        <div className="row" style={{ marginBottom: 12 }}>
          <NavLink to="/" end className="btn">
            {t("apps")}
          </NavLink>
          <NavLink to="/mail" className="btn">
            <span className="btnLabel">
              {t("navMail")}
              {mailUnread > 0 ? <span className="badge">{mailUnread > 99 ? '99+' : mailUnread}</span> : null}
            </span>
          </NavLink>
        </div>
      )}

      {error ? (
        <ErrorPopup message={error} onClose={() => setError(null)} />
      ) : null}

      {!me ? (
        <div className="card">
          <div className="title">{t("login")}</div>
          <div className="muted">
            {t("loginHint")}
          </div>
        </div>
      ) : (
        <Routes>
          {isAdmin ? (
            <>
              <Route
                path="/"
                element={
                  <AdminDashboardPage
                    progress={progress}
                    apps={apps}
                    onRefresh={() =>
                      refreshAdmin().catch((e) => setError(e.message))
                    }
                  />
                }
              />
              <Route
                path="/apps"
                element={<AdminAppsListPage token={token!} />}
              />
              <Route
                path="/apps/:appId"
                element={<AdminAppDetailPage token={token!} />}
              />
              <Route
                path="/versions/:versionId"
                element={<AdminVersionDetailPage token={token!} />}
              />
              <Route
                path="/municipalities"
                element={<AdminMunicipalitiesListPage token={token!} />}
              />
              <Route
                path="/municipalities/:municipalityId"
                element={<AdminMunicipalityDetailPage token={token!} />}
              />
              <Route
                path="/users"
                element={<AdminUsersPage token={token!} me={me} />}
              />
              <Route path="/mail" element={<MailInboxPage token={token!} mode="admin" />} />
              <Route path="/mail/:threadId" element={<MailThreadPage token={token!} mode="admin" />} />
            </>
          ) : (
            <>
              <Route
                path="/"
                element={
                  <MuniAppsPage
                    apps={apps}
                    token={token!}
                    onGoToApp={(appId) => navigate(`/apps/${appId}`)}
                    onRefresh={() =>
                      refreshMuniApps().catch((e) => setError(e.message))
                    }
                  />
                }
              />
              <Route
                path="/apps/:appId"
                element={<MuniAppDetailPage token={token!} />}
              />
              <Route path="/mail" element={<MailInboxPage token={token!} mode="muni" />} />
              <Route path="/mail/:threadId" element={<MailThreadPage token={token!} mode="muni" />} />
              <Route
                path="*"
                element={
                  <MuniAppsPage
                    apps={apps}
                    token={token!}
                    onGoToApp={(appId) => navigate(`/apps/${appId}`)}
                    onRefresh={() =>
                      refreshMuniApps().catch((e) => setError(e.message))
                    }
                  />
                }
              />
            </>
          )}
        </Routes>
      )}

      <LoginModal
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false)
          setLoginNotice(null)
        }}
        notice={loginNotice}
        onSuccess={(res) => {
          setToken(res.token);
          setMe(res.user);
          localStorage.setItem("token", res.token);
          localStorage.setItem("me", JSON.stringify(res.user));
          setLoginOpen(false);
          setLoginNotice(null)
        }}
      />

      {me && !isAdmin && token ? (
        <ChangeCodeModal
          token={token}
          open={changeCodeOpen}
          onClose={() => setChangeCodeOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default App;
// (removed old AdminQuickActions UI)
