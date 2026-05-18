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
import { AdminWilayaAdminsPage } from "./pages/AdminWilayaAdminsPage";
import { AdminVersionDetailPage } from "./pages/AdminVersionDetailPage";
import { ErrorPopup } from "./components/ErrorPopup";
import { SnackbarProvider } from "./snackbar/SnackbarContext";
import { MuniAppDetailPage } from "./pages/MuniAppDetailPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { MuniAppsPage } from "./pages/MuniAppsPage";
import { LoginModal } from "./components/LoginModal";
import { ChangeCodeModal } from "./components/ChangeCodeModal";
import { MailInboxPage } from "./pages/MailInboxPage";
import { MailThreadPage } from "./pages/MailThreadPage";
import { MailValidationDetailPage } from "./pages/MailValidationDetailPage";
import { AdminHubPage } from "./pages/AdminHubPage";
import { MuniHubPage } from "./pages/MuniHubPage";
import { AdminOperationsListPage } from "./pages/AdminOperationsListPage";
import { AdminOperationCreatePage } from "./pages/AdminOperationCreatePage";
import { AdminOperationDetailPage } from "./pages/AdminOperationDetailPage";
import { AdminOperationResultsPage } from "./pages/AdminOperationResultsPage";
import { MuniOperationsListPage } from "./pages/MuniOperationsListPage";
import { MuniOperationSheetPage } from "./pages/MuniOperationSheetPage";
import { MuniOperationViewPage } from "./pages/MuniOperationViewPage";
import { AdminCommuneItStaffPage } from "./pages/AdminCommuneItStaffPage";
import { MuniCommuneItStaffPage } from "./pages/MuniCommuneItStaffPage";
import { AdminBackupServersPage } from "./pages/AdminBackupServersPage";
import { MuniBackupServersPage } from "./pages/MuniBackupServersPage";
import { AdminMcltWorkstationsPage } from "./pages/AdminMcltWorkstationsPage";
import { MuniMcltWorkstationsPage } from "./pages/MuniMcltWorkstationsPage";
import { AdminAnnexRncAuthorizationsPage } from "./pages/AdminAnnexRncAuthorizationsPage";
import { AdminAccessRolesPage } from "./pages/AdminAccessRolesPage";
import { MuniAnnexRncAuthorizationsPage } from "./pages/MuniAnnexRncAuthorizationsPage";
import { MuniAnnexesPage } from "./pages/MuniAnnexesPage";
import { TopbarProfileMenu } from "./components/TopbarProfileMenu";
import { PermissionsProvider } from "./permissions/PermissionsContext";
import { RequirePermission } from "./permissions/RequirePermission";

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
    const res = isAdmin
      ? await api.adminMailUnreadCount(token)
      : await api.muniMailUnreadCount(token);
    setMailUnread(Number(res.unread || 0));
  }, [isAdmin, me, token]);

  useEffect(() => {
    if (!token || !me) return;
    const handleAuthError = (e: unknown) => {
      const err = e as any;
      if (err && typeof err === "object" && err.status === 401) {
        // Token expired/invalid -> force login
        setError(null);
        setLoginNotice(t("sessionExpired"));
        setLoginOpen(true);
        logout();
        return;
      }
      setError(err?.message || "Erreur");
    };
    if (isAdmin) refreshAdmin().catch(handleAuthError);
    else refreshMuniApps().catch(handleAuthError);
    refreshMailUnread().catch(() => {});
  }, [isAdmin, me, refreshAdmin, refreshMuniApps, token]);

  useEffect(() => {
    if (!token || !me) return;
    const id = window.setInterval(
      () => refreshMailUnread().catch(() => {}),
      20000,
    );
    return () => window.clearInterval(id);
  }, [me, refreshMailUnread, token]);

  return (
    <SnackbarProvider>
      <div className="container">
        <div className={`topbar ${me ? "topbar--3" : "topbar--2"}`}>
          <div className="topbarBrand">
            <Link
              to="/"
              className="brandTitle"
              style={{ textDecoration: "none" }}
            >
              {t("appTitle")}
            </Link>
            {me ? (
              <div className="chip chipSm">
                {isAdmin ? t("roleAdmin") : t("roleMuni")}
              </div>
            ) : null}
          </div>

          {me ? (
            <nav className="topbarNav" aria-label={t("hubTitle")}>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `btn btnSmall${isActive ? " btnPrimary" : ""}`
                }
              >
                <span className="topbarNavHome" aria-hidden>
                  {"\u{1F3E0}"}
                </span>
                {t("hubTitle")}
              </NavLink>
              <NavLink
                to="/mail"
                className={({ isActive }) =>
                  `btn btnSmall${isActive ? " btnPrimary" : ""}`
                }
              >
                <span className="btnLabel">
                  {t("navMail")}
                  {mailUnread > 0 ? (
                    <span className="badge">
                      {mailUnread > 99 ? "99+" : mailUnread}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            </nav>
          ) : null}

          <div className="actions">
            <button
              type="button"
              className="btn btnSmall btnLangToggle btnPrimary"
              aria-label={t("langToggleHint")}
              title={t("langToggleHint")}
              onClick={() => {
                const next = i18n.language === "fr" ? "ar" : "fr";
                localStorage.setItem("lang", next);
                i18n.changeLanguage(next);
              }}
            >
              {lang.toUpperCase()}
            </button>
            {!me ? (
              <button
                className="btn btnPrimary"
                onClick={() => setLoginOpen(true)}
              >
                {t("login")}
              </button>
            ) : (
              <TopbarProfileMenu
                isAdmin={isAdmin}
                displayName={
                  (me.name && String(me.name).trim()) ||
                  me.username ||
                  (isAdmin ? t("roleAdmin") : t("roleMuni"))
                }
                onChangeCode={() => setChangeCodeOpen(true)}
                onLogout={() => {
                  logout();
                  navigate("/");
                }}
              />
            )}
          </div>
        </div>

        {error ? (
          <ErrorPopup message={error} onClose={() => setError(null)} />
        ) : null}

        {!me ? (
          <div className="card">
            <div className="title">{t("login")}</div>
            <div className="muted">{t("loginHint")}</div>
          </div>
        ) : (
          <PermissionsProvider me={me}>
            <Routes>
            {isAdmin ? (
              <>
                <Route
                  path="/"
                  element={
                    <RequirePermission>
                      <AdminHubPage token={token!} me={me!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <RequirePermission>
                      <AdminDashboardPage
                        progress={progress}
                        apps={apps}
                        onRefresh={() =>
                          refreshAdmin().catch((e) => setError(e.message))
                        }
                      />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/apps"
                  element={
                    <RequirePermission>
                      <AdminAppsListPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/apps/:appId"
                  element={
                    <RequirePermission>
                      <AdminAppDetailPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/versions/:versionId"
                  element={
                    <RequirePermission>
                      <AdminVersionDetailPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/municipalities"
                  element={
                    <RequirePermission>
                      <AdminMunicipalitiesListPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/municipalities/:municipalityId"
                  element={
                    <RequirePermission>
                      <AdminMunicipalityDetailPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <RequirePermission>
                      <AdminUsersPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/wilaya-admins"
                  element={
                    <RequirePermission>
                      <AdminWilayaAdminsPage token={token!} me={me!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/access-roles"
                  element={
                    <RequirePermission>
                      <AdminAccessRolesPage token={token!} me={me!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/operations"
                  element={
                    <RequirePermission>
                      <AdminOperationsListPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/operations/new"
                  element={
                    <RequirePermission>
                      <AdminOperationCreatePage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/operations/:operationId"
                  element={
                    <RequirePermission>
                      <AdminOperationDetailPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/operations/:operationId/results"
                  element={
                    <RequirePermission>
                      <AdminOperationResultsPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/commune-it-staff"
                  element={
                    <RequirePermission>
                      <AdminCommuneItStaffPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/etat-principale/backup-servers"
                  element={
                    <RequirePermission>
                      <AdminBackupServersPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/etat-principale/mclt-workstations"
                  element={
                    <RequirePermission>
                      <AdminMcltWorkstationsPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/etat-principale/annex-rnc-authorizations"
                  element={
                    <RequirePermission>
                      <AdminAnnexRncAuthorizationsPage token={token!} />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/mail"
                  element={
                    <RequirePermission>
                      <MailInboxPage token={token!} mode="admin" />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/mail/validation/:validationId"
                  element={
                    <RequirePermission>
                      <MailValidationDetailPage token={token!} mode="admin" />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/mail/:threadId"
                  element={
                    <RequirePermission>
                      <MailThreadPage token={token!} mode="admin" />
                    </RequirePermission>
                  }
                />
                <Route
                  path="*"
                  element={
                    <RequirePermission>
                      <AdminHubPage token={token!} me={me!} />
                    </RequirePermission>
                  }
                />
              </>
            ) : (
              <>
                <Route path="/" element={<MuniHubPage />} />
                <Route
                  path="/apps"
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
                <Route
                  path="/operations"
                  element={<MuniOperationsListPage token={token!} />}
                />
                <Route
                  path="/operations/:operationId/view"
                  element={<MuniOperationViewPage token={token!} />}
                />
                <Route
                  path="/operations/:operationId"
                  element={<MuniOperationSheetPage token={token!} />}
                />
                <Route
                  path="/commune-it-staff"
                  element={<MuniCommuneItStaffPage token={token!} />}
                />
                <Route
                  path="/etat-principale/backup-servers"
                  element={<MuniBackupServersPage token={token!} />}
                />
                <Route
                  path="/etat-principale/mclt-workstations"
                  element={<MuniMcltWorkstationsPage token={token!} />}
                />
                <Route
                  path="/etat-principale/annex-rnc-authorizations"
                  element={<MuniAnnexRncAuthorizationsPage token={token!} />}
                />
                <Route
                  path="/annexes"
                  element={<MuniAnnexesPage token={token!} />}
                />
                <Route
                  path="/mail"
                  element={<MailInboxPage token={token!} mode="muni" />}
                />
                <Route
                  path="/mail/validation/:validationId"
                  element={<MailValidationDetailPage token={token!} mode="muni" />}
                />
                <Route
                  path="/mail/:threadId"
                  element={<MailThreadPage token={token!} mode="muni" />}
                />
                <Route path="*" element={<MuniHubPage />} />
              </>
            )}
            </Routes>
          </PermissionsProvider>
        )}

        <LoginModal
          open={loginOpen}
          onClose={() => {
            setLoginOpen(false);
            setLoginNotice(null);
          }}
          notice={loginNotice}
          onSuccess={(res) => {
            setToken(res.token);
            setMe(res.user);
            localStorage.setItem("token", res.token);
            localStorage.setItem("me", JSON.stringify(res.user));
            setLoginOpen(false);
            setLoginNotice(null);
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
    </SnackbarProvider>
  );
}

export default App;
// (removed old AdminQuickActions UI)
