import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom'

import { AuthLayout } from './components/auth/AuthLayout'
import { LoginCard } from './components/auth/LoginCard'
import { RegisterCard } from './components/auth/RegisterCard'
import { EmailVerificationGate } from './components/auth/EmailVerificationGate'
import { ForgotPasswordCard } from './components/auth/ForgotPasswordCard'
import { LegalAcceptanceGate } from './components/auth/LegalAcceptanceGate'
import { RequiredPasswordChange } from './components/auth/RequiredPasswordChange'
import { ResetPasswordCard } from './components/auth/ResetPasswordCard'
import { JoinInvitationCard } from './components/auth/JoinInvitationCard'
import { lazyNamed } from './lib/lazyNamed'
import { recallWorkspace } from './lib/lastWorkspace'
import { VerifyEmailLink } from './components/auth/VerifyEmailLink'
import { WaitingRoom } from './components/auth/WaitingRoom'
import { AccountSettingsLayout } from './components/layout/AccountSettingsLayout'
import { AuthenticatedLayout } from './components/layout/AuthenticatedLayout'
import { PlatformLayout } from './components/layout/PlatformLayout'
import { RequireModule } from './components/layout/RequireModule'
import { RequireSection } from './components/layout/RequireSection'
import { RequireTtxParam } from './components/layout/RequireTtxParam'
import { useAuth } from './hooks/useAuth'
import { safeReturnTo } from './lib/sso'
import { RouteBoundary } from './components/common/RouteBoundary'
import { ArchivedExerciseBanner } from './components/common/ArchivedExerciseBanner'
import { SsoReturnNotice } from './components/common/SsoReturnNotice'
import { AuthProvider } from './lib/AuthContext'
import { ReauthenticationHost } from './components/common/ReauthenticationHost'
import { SessionTimeoutWatcher } from './components/common/SessionTimeoutWatcher'
import { resolveDefaultContext, routeForContext } from './lib/moduleAccess'
import { ThemeProvider } from './lib/ThemeContext'
import { ToastProvider } from './lib/ToastContext'
import { LIBRARY_SUB_KINDS } from './lib/libraryLevels'
import {
  ADMIN_SECTIONS,
  CONTROL_SECTIONS,
  CREATOR_SECTIONS,
  PLAYGROUND_SECTIONS,
  sectionsForModule,
  ttxScopedSections,
} from './lib/navSections'

// Each module is its own chunk: a Player doesn't download the Creator, and
// moving between a module's sections downloads nothing.
const loadAccount = () => import('./components/account/accountRoutes')
const loadPlatform = () => import('./components/platform/platformRoutes')
const loadAdmin = () => import('./components/admin/adminRoutes')
const loadCreator = () => import('./components/creator/creatorRoutes')
const loadPlayground = () => import('./components/playground/playerRoutes')
const loadControl = () => import('./components/playground/controlRoutes')

const AccountSettingsDefaults = lazyNamed(loadAccount, 'AccountSettingsDefaults')
const AccountSettingsGeneral = lazyNamed(loadAccount, 'AccountSettingsGeneral')
const AccountSettingsPrivacy = lazyNamed(loadAccount, 'AccountSettingsPrivacy')
const AccountSettingsAssistant = lazyNamed(loadAccount, 'AccountSettingsAssistant')
const AccountSettingsSecurity = lazyNamed(loadAccount, 'AccountSettingsSecurity')
const CreateOrganizationPage = lazyNamed(loadAccount, 'CreateOrganizationPage')
const PlatformAccountDetail = lazyNamed(loadPlatform, 'PlatformAccountDetail')
const PlatformAccountsSection = lazyNamed(loadPlatform, 'PlatformAccountsSection')
const PlatformActivitySection = lazyNamed(loadPlatform, 'PlatformActivitySection')
const PlatformEmailSection = lazyNamed(loadPlatform, 'PlatformEmailSection')
const PlatformSsoSection = lazyNamed(loadPlatform, 'PlatformSsoSection')
const PlatformAssistantSection = lazyNamed(loadPlatform, 'PlatformAssistantSection')
const PlatformLegalSection = lazyNamed(loadPlatform, 'PlatformLegalSection')
const PlatformOrganizationsSection = lazyNamed(loadPlatform, 'PlatformOrganizationsSection')
const PlatformSecuritySection = lazyNamed(loadPlatform, 'PlatformSecuritySection')
const PlatformTenancySection = lazyNamed(loadPlatform, 'PlatformTenancySection')
const AdminDomainAllowlistSection = lazyNamed(loadAdmin, 'AdminDomainAllowlistSection')
const AdminExercisesSection = lazyNamed(loadAdmin, 'AdminExercisesSection')
const AdminImprovementPlanSection = lazyNamed(loadAdmin, 'AdminImprovementPlanSection')
const AdminOrganizationProfileSection = lazyNamed(loadAdmin, 'AdminOrganizationProfileSection')
const AdminUsersAndRolesSection = lazyNamed(loadAdmin, 'AdminUsersAndRolesSection')
const CreatorAccessRequestsSection = lazyNamed(loadCreator, 'CreatorAccessRequestsSection')
const CreatorPlayersSection = lazyNamed(loadCreator, 'CreatorPlayersSection')
const CreatorDesignGate = lazyNamed(loadCreator, 'CreatorDesignGate')
const CreatorConductPrepSection = lazyNamed(loadCreator, 'CreatorConductPrepSection')
const CreatorExerciseCreateSection = lazyNamed(loadCreator, 'CreatorExerciseCreateSection')
const CreatorExerciseRequired = lazyNamed(loadCreator, 'CreatorExerciseRequired')
const CreatorExerciseSection = lazyNamed(loadCreator, 'CreatorExerciseSection')
const CreatorExercisesSection = lazyNamed(loadCreator, 'CreatorExercisesSection')
const CreatorNoExerciseSection = lazyNamed(loadCreator, 'CreatorNoExerciseSection')
const CreatorInvitationsSection = lazyNamed(loadCreator, 'CreatorInvitationsSection')
const CreatorMselSection = lazyNamed(loadCreator, 'CreatorMselSection')
const CreatorNeedsFormSection = lazyNamed(loadCreator, 'CreatorNeedsFormSection')
const EnrollmentsSection = lazyNamed(loadPlayground, 'EnrollmentsSection')
const PlayerLandingSection = lazyNamed(loadPlayground, 'PlayerLandingSection')
const ControlStoryline = lazyNamed(loadControl, 'ControlStoryline')
const ControlCenterPanel = lazyNamed(loadControl, 'ControlCenterPanel')
const NotesPanel = lazyNamed(loadControl, 'NotesPanel')
const SessionSummaryPanel = lazyNamed(loadControl, 'SessionSummaryPanel')
const PastRuns = lazyNamed(loadControl, 'PastRuns')
const TeamNotesPanel = lazyNamed(loadControl, 'TeamNotesPanel')
const PlaygroundPage = lazyNamed(loadControl, 'PlaygroundPage')
const AfterActionSection = lazyNamed(
  () => import('./components/aar/AfterActionSection'),
  'AfterActionSection',
)
const LibrarySection = lazyNamed(
  () => import('./components/templates/LibrarySection'),
  'LibrarySection',
)
const ExecutionEvaluationSection = lazyNamed(
  () => import('./components/playground/ExecutionEvaluationSection'),
  'ExecutionEvaluationSection',
)

/** Anonymous users only get redirected to /login -- used by
 * /account/settings itself, which is where a 'needs-mfa-enrollment' user
 * is supposed to land, so it must not redirect that status away again. */
function RequireAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (status === 'needs-password-change') return <Navigate to="/account/password" replace />
  if (status === 'needs-email-verification') return <Navigate to="/account/verify-email" replace />
  return <>{children}</>
}

/** Full access required -- redirects both anonymous and pending-MFA users.
 * Use this for real module routes once they exist. */
function RequireFullAccess({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (status === 'needs-password-change') return <Navigate to="/account/password" replace />
  if (status === 'needs-email-verification') return <Navigate to="/account/verify-email" replace />
  if (status === 'needs-legal-acceptance') return <Navigate to="/account/legal" replace />
  if (status === 'needs-mfa-enrollment') {
    return <Navigate to="/account/settings/security?mandatory=1" replace />
  }
  return <>{children}</>
}

/** The password change after signing in with a temporary password: only
 * while one is required (anyone else goes home). */
function RequirePasswordChange({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (status !== 'needs-password-change') return <Navigate to="/" replace />
  return <>{children}</>
}

/** The screen asking to confirm the address the account signed up with:
 * only while it's pending (anyone else goes home). */
function RequireEmailVerification({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (status !== 'needs-email-verification') return <Navigate to="/" replace />
  return <>{children}</>
}

/** The acceptance screen for new legal documents: only while there are
 * some to accept (anyone else goes home). */
function RequireLegalPending({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (status !== 'needs-legal-acceptance') return <Navigate to="/" replace />
  return <>{children}</>
}

/** Back from signing in through single sign-on: the server set the
 * session on its redirect here (a full page load, so AuthProvider reads
 * it afresh); on to where the person was going, whose own guards ask for
 * whatever is still pending (legal documents, two-factor enrollment). */
function SsoSignInReturn() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get('return_to'))
  return <Navigate to={returnTo} replace />
}

/** Platform is the instance administrator's alone; anyone else lands home. */
function RequireInstanceAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user?.is_instance_admin) return <Navigate to="/" replace />
  return <>{children}</>
}

function SectionPlaceholder({ sections }: { sections: ReturnType<typeof sectionsForModule> }) {
  const { t } = useTranslation()
  const { section } = useParams<{ section?: string }>()
  const active = sections.find((s) => s.path === section)
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {active ? t(active.titleKey) : null}
      </h1>
    </div>
  )
}

function AdminSectionOutlet() {
  const { section } = useParams<{ section?: string }>()
  const { activeOrganizationId } = useAuth()
  if (section === 'organization') {
    // Keyed by the active org so a ContextBar switch discards any open
    // edit form / delete modal from the previous organization.
    return (
      <div className="p-6">
        <AdminOrganizationProfileSection key={activeOrganizationId ?? 'none'} />
      </div>
    )
  }
  if (section === 'users-and-roles') {
    return (
      <div className="p-6">
        <AdminUsersAndRolesSection key={activeOrganizationId ?? 'none'} />
      </div>
    )
  }
  if (section === 'exercises') {
    return (
      <div className="p-6">
        <AdminExercisesSection key={activeOrganizationId ?? 'none'} />
      </div>
    )
  }
  if (section === 'settings') {
    return (
      <div className="p-6">
        <AdminDomainAllowlistSection />
      </div>
    )
  }
  if (section === 'improvement-plan') {
    return (
      <div className="p-6">
        <AdminImprovementPlanSection key={activeOrganizationId ?? 'none'} />
      </div>
    )
  }
  if (section === 'library') {
    return (
      <div className="p-6">
        <LibrarySection withExercise={false} />
      </div>
    )
  }
  return <SectionPlaceholder sections={ADMIN_SECTIONS} />
}

function CreatorSectionOutlet() {
  const { ttxId, section } = useParams<{ ttxId?: string; section?: string }>()
  if (section === 'exercise') {
    // Keyed by the exercise so a ContextBar switch discards an open edit form.
    return (
      <div className="p-6">
        <CreatorExerciseSection key={ttxId} />
      </div>
    )
  }
  if (section === 'needs') {
    return (
      <div className="p-6">
        <CreatorNeedsFormSection key={ttxId} />
      </div>
    )
  }
  if (section === 'library') {
    return (
      <div className="p-6">
        <LibrarySection withExercise />
      </div>
    )
  }
  if (section === 'msel') {
    return (
      <CreatorDesignGate>
        <div className="p-6">
          <CreatorMselSection key={ttxId} />
        </div>
      </CreatorDesignGate>
    )
  }
  if (section === 'after-action' && ttxId) {
    return (
      <div className="p-6">
        <AfterActionSection key={ttxId} ttxId={ttxId} />
      </div>
    )
  }
  if (section === 'conduct-prep') {
    return (
      <CreatorDesignGate>
        <div className="p-6">
          <CreatorConductPrepSection key={ttxId} />
        </div>
      </CreatorDesignGate>
    )
  }
  return <SectionPlaceholder sections={CREATOR_SECTIONS} />
}

/** The Controllers' workspace: the control center (the Playground with
 * the control panel) and the EEG. */
function ControlSectionOutlet() {
  const { t } = useTranslation()
  const { ttxList } = useAuth()
  const { ttxId, section } = useParams<{ ttxId?: string; section?: string }>()
  if (section === 'dashboard' && ttxId) {
    return (
      <div className="p-6">
        <PlaygroundPage
          key={ttxId}
          ttxId={ttxId}
          role="controller"
          wideDock
          top={(run) =>
            run.control && run.state !== 'not_started' ? (
              <ControlStoryline run={run} control={run.control} />
            ) : null
          }
          dock={(run, apply) => (
            <div className="space-y-4">
              <ControlCenterPanel
                ttxId={ttxId}
                run={run}
                onChange={apply}
                contentLanguage={ttxList.find((ttx) => ttx.id === ttxId)?.content_language}
                archived={!!ttxList.find((ttx) => ttx.id === ttxId)?.archived_at}
              />
              {run.state !== 'not_started' && <SessionSummaryPanel ttxId={ttxId} seq={run.seq} />}
              <PastRuns ttxId={ttxId} reload={`${run.run_number ?? 0}-${run.state}`} />
              <NotesPanel
                ttxId={ttxId}
                role="controller"
                run={run}
                title={t('playground.notes.title')}
                description={t('playground.notes.teamHint')}
              />
              <TeamNotesPanel ttxId={ttxId} />
            </div>
          )}
        />
      </div>
    )
  }
  if (section === 'after-action' && ttxId) {
    return (
      <div className="p-6">
        <AfterActionSection key={ttxId} ttxId={ttxId} />
      </div>
    )
  }
  if (section === 'evaluation') {
    return (
      <div className="p-6">
        <ExecutionEvaluationSection key={ttxId} />
      </div>
    )
  }
  return <SectionPlaceholder sections={CONTROL_SECTIONS} />
}

/** The Playground, shared by Players, Facilitators, Observers and Evaluators. */
function ExecutionSectionOutlet() {
  const { ttxId, section } = useParams<{ ttxId?: string; section?: string }>()
  if (section === 'dashboard') {
    return (
      <div className="p-6">
        <PlayerLandingSection key={ttxId} />
      </div>
    )
  }
  if (section === 'evaluation') {
    return (
      <div className="p-6">
        <ExecutionEvaluationSection key={ttxId} />
      </div>
    )
  }
  if (section === 'after-action' && ttxId) {
    return (
      <div className="p-6">
        <AfterActionSection key={ttxId} ttxId={ttxId} />
      </div>
    )
  }
  return <SectionPlaceholder sections={PLAYGROUND_SECTIONS} />
}

function Home() {
  const { status, user, activeOrganization, allTtxList } = useAuth()

  if (status === 'loading') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (status === 'needs-password-change') return <Navigate to="/account/password" replace />
  if (status === 'needs-email-verification') return <Navigate to="/account/verify-email" replace />
  if (status === 'needs-legal-acceptance') return <Navigate to="/account/legal" replace />
  if (status === 'needs-mfa-enrollment') {
    return <Navigate to="/account/settings/security?mandatory=1" replace />
  }
  // Coming back mid-session (the logo from Preferences): where the user
  // was working, not the default workspace -- that one starts a session.
  // Never Platform: the logo is its way back to the organization's work
  // (an entry left by a build that still remembered it is skipped too).
  const resume = user ? recallWorkspace(user.id) : null
  if (resume && !resume.startsWith('/platform')) return <Navigate to={resume} replace />
  // Lands on the saved default role/exercise when the active org is the
  // default one (Preferences -> Workspace), otherwise the first
  // role held there (heldRoles' order) -- the same
  // resolution AuthContext uses to pick the active exercise. A brand-new
  // Planner with no exercise yet lands on /creator/exercise, the
  // organization-wide overview. Only a
  // user who holds no role in the active org (a freshly invited
  // Player still awaiting approval) sees the Waiting Room.
  const route = routeForContext(
    resolveDefaultContext(activeOrganization ? [activeOrganization] : [], allTtxList, {
      organizationId: user?.default_organization_id ?? null,
      role: user?.default_role ?? null,
      ttxId: user?.default_ttx_id ?? null,
    }),
  )
  if (route) return <Navigate to={route} replace />
  // The deployment's operator with no role in any organization (a fresh
  // install's first account): Platform is where their work is.
  if (user?.is_instance_admin) return <Navigate to="/platform" replace />
  return (
    <AuthLayout>
      <WaitingRoom />
    </AuthLayout>
  )
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Router>
          <AuthProvider>
            <SessionTimeoutWatcher />
            <ReauthenticationHost />
            <SsoReturnNotice />
            <RouteBoundary>
              <Routes>
                <Route path="/auth/sso" element={<SsoSignInReturn />} />
                <Route
                  path="/login"
                  element={
                    <AuthLayout>
                      <LoginCard />
                    </AuthLayout>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <AuthLayout>
                      <RegisterCard />
                    </AuthLayout>
                  }
                />
                <Route
                  path="/account/password"
                  element={
                    <RequirePasswordChange>
                      <AuthLayout>
                        <RequiredPasswordChange />
                      </AuthLayout>
                    </RequirePasswordChange>
                  }
                />
                <Route
                  path="/account/verify-email"
                  element={
                    <RequireEmailVerification>
                      <AuthLayout>
                        <EmailVerificationGate />
                      </AuthLayout>
                    </RequireEmailVerification>
                  }
                />
                {/* Links sent by email: they open signed in or not. */}
                <Route
                  path="/verify-email"
                  element={
                    <AuthLayout>
                      <VerifyEmailLink />
                    </AuthLayout>
                  }
                />
                <Route
                  path="/join"
                  element={
                    <AuthLayout>
                      <JoinInvitationCard />
                    </AuthLayout>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <AuthLayout>
                      <ForgotPasswordCard />
                    </AuthLayout>
                  }
                />
                <Route
                  path="/reset-password"
                  element={
                    <AuthLayout>
                      <ResetPasswordCard />
                    </AuthLayout>
                  }
                />
                <Route
                  path="/account/legal"
                  element={
                    <RequireLegalPending>
                      <AuthLayout>
                        <LegalAcceptanceGate />
                      </AuthLayout>
                    </RequireLegalPending>
                  }
                />
                <Route
                  path="/account/settings"
                  element={
                    <RequireAuthenticated>
                      <AccountSettingsLayout />
                    </RequireAuthenticated>
                  }
                >
                  <Route index element={<Navigate to="general" replace />} />
                  <Route path="general" element={<AccountSettingsGeneral />} />
                  <Route path="defaults" element={<AccountSettingsDefaults />} />
                  <Route path="security" element={<AccountSettingsSecurity />} />
                  <Route path="privacy" element={<AccountSettingsPrivacy />} />
                  <Route path="assistant" element={<AccountSettingsAssistant />} />
                </Route>
                {/* Founding an organization: from the avatar menu or the Waiting
                  Room. Past the mandatory-TOTP gate (an account held there
                  finishes enrolling first), but outside RequireModule -- an
                  account with no role anywhere must reach it. */}
                <Route
                  path="/account/organizations/new"
                  element={
                    <RequireFullAccess>
                      <CreateOrganizationPage />
                    </RequireFullAccess>
                  }
                />
                {/* Platform: the deployment's operator (organizations,
                  accounts, legal documents, tenancy rule). A workspace of
                  its own, above any organization -- not one of the
                  modules RequireModule gates by role in the active org. */}
                <Route
                  path="/platform"
                  element={
                    <RequireFullAccess>
                      <RequireInstanceAdmin>
                        <PlatformLayout />
                      </RequireInstanceAdmin>
                    </RequireFullAccess>
                  }
                >
                  <Route index element={<Navigate to="organizations" replace />} />
                  <Route path="organizations" element={<PlatformOrganizationsSection />} />
                  <Route path="accounts" element={<PlatformAccountsSection />} />
                  <Route path="accounts/:userId" element={<PlatformAccountDetail />} />
                  <Route path="legal" element={<PlatformLegalSection />} />
                  <Route path="tenancy" element={<PlatformTenancySection />} />
                  <Route path="security" element={<PlatformSecuritySection />} />
                  <Route path="email" element={<PlatformEmailSection />} />
                  <Route path="sso" element={<PlatformSsoSection />} />
                  <Route path="assistant" element={<PlatformAssistantSection />} />
                  <Route path="activity" element={<PlatformActivitySection />} />
                  <Route path="*" element={<Navigate to="/platform/organizations" replace />} />
                </Route>
                <Route
                  element={
                    <RequireFullAccess>
                      <RequireModule>
                        <AuthenticatedLayout />
                      </RequireModule>
                    </RequireFullAccess>
                  }
                >
                  {LIBRARY_SUB_KINDS.map((kind) => (
                    <Route
                      key={kind}
                      path={`/admin/library/${kind}`}
                      element={
                        <div className="p-6">
                          <LibrarySection withExercise={false} kind={kind} />
                        </div>
                      }
                    />
                  ))}
                  <Route
                    path="/admin/:section?"
                    element={
                      <RequireSection module="admin" sections={ADMIN_SECTIONS}>
                        <AdminSectionOutlet />
                      </RequireSection>
                    }
                  />
                  <Route
                    path="/creator/exercises"
                    element={
                      <div className="p-6">
                        <CreatorExercisesSection />
                      </div>
                    }
                  />
                  <Route
                    path="/creator/exercise"
                    element={
                      <div className="p-6">
                        <CreatorNoExerciseSection />
                      </div>
                    }
                  />
                  {(['needs', 'msel', 'conduct-prep'] as const).map((section) => (
                    <Route
                      key={section}
                      path={`/creator/${section}`}
                      element={
                        <div className="p-6">
                          <CreatorExerciseRequired section={section} />
                        </div>
                      }
                    />
                  ))}
                  <Route
                    path="/creator/exercises/new"
                    element={
                      <div className="p-6">
                        <CreatorExerciseCreateSection />
                      </div>
                    }
                  />
                  <Route
                    path="/creator/library"
                    element={
                      <div className="p-6">
                        <LibrarySection withExercise />
                      </div>
                    }
                  />
                  {LIBRARY_SUB_KINDS.map((kind) => (
                    <Route
                      key={kind}
                      path={`/creator/library/${kind}`}
                      element={
                        <div className="p-6">
                          <LibrarySection withExercise kind={kind} />
                        </div>
                      }
                    />
                  ))}
                  {/* Library is an organization-level section now; an exercise's
                   * library URL (bookmarks, the ContextBar keeping the section)
                   * still opens it with that exercise in context. */}
                  <Route
                    path="/creator/:ttxId/library"
                    element={
                      <RequireTtxParam module="creator">
                        <div className="p-6">
                          <LibrarySection withExercise />
                        </div>
                      </RequireTtxParam>
                    }
                  />
                  {LIBRARY_SUB_KINDS.map((kind) => (
                    <Route
                      key={kind}
                      path={`/creator/:ttxId/library/${kind}`}
                      element={
                        <RequireTtxParam module="creator">
                          <div className="p-6">
                            <LibrarySection withExercise kind={kind} />
                          </div>
                        </RequireTtxParam>
                      }
                    />
                  ))}
                  <Route
                    path="/creator/players"
                    element={
                      <div className="p-6">
                        <CreatorPlayersSection />
                      </div>
                    }
                  />
                  <Route
                    path="/creator/players/pending"
                    element={
                      <div className="p-6">
                        <CreatorAccessRequestsSection />
                      </div>
                    }
                  />
                  <Route
                    path="/creator/players/invitations"
                    element={
                      <div className="p-6">
                        <CreatorInvitationsSection />
                      </div>
                    }
                  />
                  <Route
                    path="/creator/:ttxId?/:section?"
                    element={
                      <RequireTtxParam module="creator">
                        <RequireSection
                          module="creator"
                          sections={ttxScopedSections(CREATOR_SECTIONS)}
                        >
                          <>
                            <ArchivedExerciseBanner />
                            <CreatorSectionOutlet />
                          </>
                        </RequireSection>
                      </RequireTtxParam>
                    }
                  />
                  <Route
                    path="/control/:ttxId?/:section?"
                    element={
                      <RequireTtxParam module="control">
                        <RequireSection module="control" sections={CONTROL_SECTIONS}>
                          <>
                            <ArchivedExerciseBanner />
                            <ControlSectionOutlet />
                          </>
                        </RequireSection>
                      </RequireTtxParam>
                    }
                  />
                  <Route
                    path="/playground/enrollments"
                    element={
                      <div className="p-6">
                        <EnrollmentsSection />
                      </div>
                    }
                  />
                  <Route
                    path="/playground/:ttxId?/:section?"
                    element={
                      <RequireTtxParam module="playground">
                        <RequireSection
                          module="playground"
                          sections={ttxScopedSections(PLAYGROUND_SECTIONS)}
                        >
                          <>
                            <ArchivedExerciseBanner />
                            <ExecutionSectionOutlet />
                          </>
                        </RequireSection>
                      </RequireTtxParam>
                    }
                  />
                </Route>
                <Route path="/" element={<Home />} />
              </Routes>
            </RouteBoundary>
          </AuthProvider>
        </Router>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
