import type { ContextRole } from './moduleAccess'
import type { TagColor } from './tagColors'

export type AvatarKind = 'preset' | 'upload'

export type SortDir = 'asc' | 'desc'
export type SortBy = 'created_at' | 'name' | 'last_login'

/** How a second-factor challenge (sign-in, step-up) can be answered. */
export type MfaMethod = 'totp' | 'email' | 'backup_code'
/** A method an account can prefer (backup codes only recover a lost app). */
export type PreferredMfaMethod = 'totp' | 'email'

export interface AuthMeResponse {
  id: string
  email: string
  full_name: string
  totp_enabled: boolean
  backup_codes_remaining: number
  /** A code by email as a second factor: turned on, and whether the
   * deployment can send one at all. */
  email_mfa_enabled: boolean
  email_mfa_available: boolean
  /** How a challenge can be answered now, and the one it opens on. */
  mfa_methods: MfaMethod[]
  mfa_preferred: PreferredMfaMethod | null
  is_program_manager: boolean
  is_planner: boolean
  /** Signed in with a temporary password (reset from Platform), or one
   * past the deployment's maximum age: only the password change is open
   * until a new one is chosen. The reason picks the screen's copy. */
  password_change_required: boolean
  password_change_reason?: 'reset' | 'expired' | null
  /** Holds a role whose second factor is mandatory (Platform -> Sign-in security),
   * or runs the deployment: the enrollment screen until it has one. */
  mfa_mandated?: boolean
  /** The deployment's minimum password length (Platform -> Sign-in security). */
  password_min_length?: number
  /** Signed up while the deployment sends email and the address isn't
   * confirmed yet: only the confirmation screen is open until it is. */
  email_verification_pending: boolean
  /** Asked to confirm the address again (periodic reconfirmation): until
   * when the account keeps working, and whether that's past -- then only
   * the confirmation screen is open. */
  email_reconfirm_deadline: string | null
  email_reconfirmation_overdue: boolean
  /** Runs the deployment (Platform); TOTP mandatory. */
  is_instance_admin: boolean
  /** The only active instance administrator (Preferences warns before
   * deleting the account). */
  is_last_instance_admin: boolean
  /** The deployment's tenancy rules let this account found an
   * organization on its own (avatar menu, Waiting Room). */
  can_found_organization: boolean
  /** Legal documents to accept before anything but the account itself;
   * empty when up to date. */
  legal_acceptance_pending: LegalPending[]
  default_organization_id: string | null
  default_role: ContextRole | null
  default_ttx_id: string | null
  avatar_kind: AvatarKind | null
  avatar_value: string | null
  /** False: signs in only through single sign-on (may set a password). */
  has_password: boolean
  /** Linked to the single sign-on provider (Preferences -> Security). */
  sso_linked: boolean
  /** The single sign-on provider's name when the deployment offers it. */
  sso_provider: string | null
  session: SessionInfo
}

/** The current session's timeouts (session policy): the soft timeout
 * (inactivity) and the hard one (absolute, since sign-in). */
export interface SessionInfo {
  idle_timeout_minutes: number
  idle_expires_at: string
  absolute_expires_at: string
  authenticated_at: string
  step_up_minutes: number
  /** 'provider': opened through single sign-on with the provider's second
   * factor, which counts for the roles where TOTP is mandatory. */
  mfa_source?: 'provider' | null
}

/** What the sign-in page needs to offer single sign-on
 * (GET /auth/oidc/config). */
export interface OidcPublicConfig {
  enabled: boolean
  display_name: string | null
  provider_kind: 'entra' | 'generic' | null
}

export interface OidcRedirectResponse {
  /** The provider's sign-in page, to send the browser to. */
  authorize_url: string
}

/** Platform -> Single sign-on. Never carries the client secret. */
export interface OidcSettingsRead {
  active: boolean
  pinned_by_env: boolean
  /** The callback to register with the provider; null without PUBLIC_BASE_URL. */
  redirect_uri: string | null
  configured: boolean
  enabled: boolean
  provider_kind: 'entra' | 'generic' | null
  display_name: string | null
  entra_tenant_id: string | null
  issuer_url: string | null
  client_id: string | null
  allow_jit: boolean
  trust_provider_mfa: boolean
  has_client_secret: boolean
  client_secret_readable: boolean
  linked_accounts: number
  updated_at: string | null
}

export interface OidcTestRead {
  ok: boolean
  error: string | null
  detail: string | null
}

export interface UserSessionRead {
  id: string
  created_at: string
  last_seen_at: string
  user_agent: string | null
  ip_address: string | null
  current: boolean
}

export interface UserSessionListResponse {
  items: UserSessionRead[]
}

export interface BackupCodesResponse {
  backup_codes: string[]
}

export interface OrganizationSummary {
  organization_id: string
  organization_name: string
  domain: string | null
  alias: string | null
  logo_url: string | null
  is_program_manager: boolean
  is_planner: boolean
  /** The organization grants an exercise's team assigns from. */
  is_observer: boolean
  is_evaluator: boolean
}

/** A member who could take over a role from someone leaving. */
export interface LeaveCandidate {
  user_id: string
  full_name: string
  email: string
}

/** GET /organizations/{id}/leave-preview: what leaving would take. */
export interface OrganizationLeavePreview {
  organization_name: string
  is_program_manager: boolean
  is_last_program_manager: boolean
  program_manager_candidates: LeaveCandidate[]
  exercises: {
    ttx_id: string
    ttx_code: string
    ttx_name: string
    /** The roles held there (context roles). */
    seats: string[]
    /** The only Planner / Controller there: leaving waits. */
    blocked: 'planner' | 'controller' | null
    /** Leads it with others who plan: one of them takes over. */
    lead_candidates: LeaveCandidate[]
  }[]
}

export interface OrganizationSummaryListResponse {
  items: OrganizationSummary[]
}

export interface TTXRead {
  id: string
  /** "TTX-YYYY-NN", sequential per organization and year. */
  code: string
  name: string
  description: string | null
  organization_id: string
  created_by_id: string
  created_at: string
  /** The language its content (injects, briefings) is written in; null
   * while unknown. Defaults written for the table (ENDEX) follow it. */
  content_language: string | null
  role: string
  /** The caller's planning and control team functions on it (role
   * 'planner' only): designs it, runs it, moderates it with the Players --
   * and, when also assigned so, evaluates and observes it. */
  plans: boolean
  controls: boolean
  facilitates: boolean
  evaluates: boolean
  observes: boolean
  image_url: string | null
  tags: TTXTag[]
  needs_form_status: NeedsFormStatus
  tlp: Tlp
  /** null until the MSEL is first opened. */
  msel_status?: MselStatus | null
  /** The caller may delete it: its Lead Planner, or a Program Manager of
   * its organization. */
  can_delete?: boolean
  /** Archived: read-only and out of the default lists; whoever may
   * delete it archives and unarchives it. */
  archived_at?: string | null
  /** The planning team member who coordinates it (null only while it
   * has no Planner). */
  lead_planner?: { user_id: string; full_name: string } | null
}

/** POST /ttx/{id}/duplicate: the copy, and the team members left off it
 * (their organization grant is gone). */
export interface TTXDuplicateResponse {
  ttx: TTXRead
  skipped_members: string[]
}

export interface TTXListResponse {
  items: TTXRead[]
  total: number
  limit: number
  offset: number
}

/** What a tag was copied from (the tag library's levels), if anything. */
export interface TagOrigin {
  origin: ActorOrigin | null
  origin_id: string | null
  /** The original's name at copy time ("Copied from"). */
  origin_name: string | null
}

/** An exercise's own tag (the exercise level of the tag library). */
export interface TTXTag extends TagOrigin {
  id: string
  name: string
  color: TagColor
  custom_hex: string | null
  created_at: string
}

/** Structural shape shared by every tag pool in the app (TTXTag,
 * OrganizationTag, ...) -- lets TagAssignmentField accept any of them
 * without a union that has to grow each time a new pool appears. */
export interface AssignableTag {
  id: string
  name: string
  color: TagColor
  custom_hex: string | null
  created_at: string
  /** An organization tag deleted while still in use (LibraryItemState). */
  disabled_at?: string | null
}

export interface TTXTagListResponse {
  items: TTXTag[]
  total: number
  limit: number
  offset: number
}

export interface InvitationTokenAuditRead {
  id: string
  ttx_id: string
  role: string
  description: string | null
  token: string
  expires_at: string
  max_uses: number | null
  redemption_count: number
  revoked_at: string | null
  created_at: string
  created_by_id: string
  tags: TTXTag[]
}

export interface InvitationTokenAuditListResponse {
  items: InvitationTokenAuditRead[]
  total: number
  limit: number
  offset: number
}

export interface InvitationTokenCreateResponse {
  id: string
  ttx_id: string
  role: string
  description: string | null
  expires_at: string
  max_uses: number | null
  created_at: string
  token: string
}

export interface InvitationTokenRevokeResponse {
  id: string
  revoked_at: string | null
}

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected'

export interface TTXAccessRequestRead {
  id: string
  ttx_id: string
  role: string
  token_description: string | null
  status: AccessRequestStatus
  user: { id: string; email: string; full_name: string }
  created_at: string
  is_allowed_domain: boolean
}

export interface TTXAccessRequestListResponse {
  items: TTXAccessRequestRead[]
  total: number
  limit: number
  offset: number
}

export interface LoginResponse {
  mfa_required: boolean
  mfa_pending_token: string | null
  mfa_methods: MfaMethod[]
  mfa_preferred: PreferredMfaMethod | null
  user: { id: string; email: string; full_name: string } | null
}

/** POST /auth/login/challenge: a pending sign-in challenge's methods. */
export interface MfaChallengeResponse {
  mfa_methods: MfaMethod[]
  mfa_preferred: PreferredMfaMethod | null
}

/** A code sent by email, to this masked address ("p•••@acme.com"). */
export interface EmailCodeSentResponse {
  sent_to: string
}

export interface InvitationTokenRedeemResponse {
  ttx_id: string
  ttx_name: string
  organization_name: string
  organization_domain: string | null
  role: string
  status: 'pending'
  user: { id: string; email: string; full_name: string }
}

export interface MyAccessRequestRead {
  id: string
  ttx_id: string
  ttx_name: string
  organization_name: string
  organization_domain: string | null
  role: string
  status: AccessRequestStatus
  created_at: string
}

/** A Player's own pending request to leave an exercise. */
export interface MyLeaveRequest {
  id: string
  ttx_id: string
  ttx_name: string
  organization_name: string
  reason: string
  created_at: string
}

/** Creator -> Players -> Pending requests: a Player asking to leave. */
export interface TTXLeaveRequest {
  id: string
  ttx_id: string
  user_id: string
  email: string
  full_name: string
  reason: string
  status: AccessRequestStatus
  created_at: string
}

export interface MyAccessRequestListResponse {
  items: MyAccessRequestRead[]
  total: number
  limit: number
  offset: number
}

export interface PlannerRead {
  user_id: string
  email: string
  full_name: string
  granted_at: string
  last_login_at: string | null
  tags: OrganizationTag[]
}

export interface PlannerListResponse {
  items: PlannerRead[]
  total: number
  limit: number
  offset: number
}

export interface OrganizationProfile {
  id: string
  name: string
  domain: string | null
  alias: string | null
  tax_id: string | null
  subscription_tier: string
  description: string | null
  logo_url: string | null
  created_at: string
}

export interface OrganizationAllowedDomain {
  id: number
  domain: string
  /** Which grants the domain is allowlisted for (at least one is true). */
  allows_program_manager: boolean
  allows_planner: boolean
  tags: OrganizationTag[]
  created_at: string
}

export interface OrganizationAllowedDomainListResponse {
  items: OrganizationAllowedDomain[]
  total: number
  limit: number
  offset: number
}

/** An organization library item's disable state: set when it was deleted
 * while still in use (exercise copies, library links, tag assignments).
 * `usage_count` is filled on library lists only. */
export interface LibraryItemState {
  disabled_at?: string | null
  usage_count?: number
}

/** What uses a library item -- asked before deleting it. */
export interface LibraryUsage {
  exercises: { ttx_id: string; name: string; copies: number }[]
  injects: { id: string; title: string }[]
  memberships: number
  allowed_domains: number
  applied_to_organization: boolean
  total: number
}

export interface LibraryDeleteResult {
  result: 'deleted' | 'disabled'
  usage: LibraryUsage
}

export interface OrganizationTag extends TagOrigin, LibraryItemState {
  id: string
  name: string
  color: TagColor
  custom_hex: string | null
  applied: boolean
  created_at: string
}

export interface OrganizationTagListResponse {
  items: OrganizationTag[]
  total: number
  limit: number
  offset: number
}

/** GET /organizations/{organization_id}/dashboard -- mirrors
 * backend/app/schemas/dashboard.py. */
export interface OrganizationDashboard {
  organization_id: string
  organization_name: string
  generated_at: string
  kpis: {
    planners: number
    exercise_only_planners: number
    exercises: number
    exercises_last_30_days: number
    unique_players: number
    pending_requests: number
    oldest_pending_request_at: string | null
    /** The improvement plan: actions still to do, and those overdue. */
    improvement_open: number
    improvement_overdue: number
  }
  exercises: {
    ttx_id: string
    name: string
    created_at: string
    players: number
    planners: number
    injects: number
    pending_requests: number
  }[]
  access_requests: { approved: number; pending: number; rejected: number }
  invitations: { active: number; revoked: number; expired: number; redemptions: number }
  /** Always 12 entries, oldest first, zero-filled; `week_start` is a
   * Monday as "YYYY-MM-DD". Access granted to Players and to the exercise
   * team (an exercise's creator isn't counted). */
  weekly_joins: { week_start: string; players: number; team: number }[]
}

/** GET /ttx/{ttx_id}/dashboard -- Creator's per-exercise aggregates; the
 * access-request/invitation/weekly-join blocks share the organization
 * dashboard's shape. */
export interface TTXDashboard {
  ttx_id: string
  ttx_name: string
  generated_at: string
  kpis: {
    players: number
    planners: number
    injects: number
    pending_requests: number
    oldest_pending_request_at: string | null
  }
  /** Newest token first. `expired` also covers a used-up token. */
  invitation_breakdown: {
    token_id: string
    description: string | null
    role: 'planner' | 'player'
    status: 'active' | 'revoked' | 'expired'
    created_at: string
    redemptions: number
    approved: number
    pending: number
    rejected: number
  }[]
  access_requests: OrganizationDashboard['access_requests']
  invitations: OrganizationDashboard['invitations']
  weekly_joins: OrganizationDashboard['weekly_joins']
}

/** GET /organizations/{organization_id}/planner-overview -- Creator ->
 * Exercises for a Planner: organization-wide counts, and the Program
 * Manager's panels over the Planner's own exercises only. */
export interface PlannerOverview {
  organization_id: string
  organization_name: string
  generated_at: string
  exercises: number
  exercises_last_30_days: number
  owned_by_you: number
  co_planned_by_you: number
  planners: number
  unique_players: number
  my_exercises: OrganizationDashboard['exercises']
  access_requests: OrganizationDashboard['access_requests']
  invitations: OrganizationDashboard['invitations']
  weekly_joins: OrganizationDashboard['weekly_joins']
}

/** GET/POST /organizations/{organization_id}/program-managers -- same shape as
 * a Planner grant. */
export type ProgramManagerRead = PlannerRead

export interface ProgramManagerListResponse {
  items: ProgramManagerRead[]
}

/** An exercise role besides Player (Creator -> Exercise team). */
export type PeopleRole = 'planner' | 'observer' | 'evaluator'

/** GET /ttx/{id}/people -- one row of the exercise team matrix. */
export interface ExercisePersonRead {
  user_id: string
  email: string
  full_name: string
  added_at: string
  last_login_at: string | null
  role: PeopleRole
  plans: boolean
  controls: boolean
  facilitates: boolean
  /** A team member who is also the exercise's Evaluator / Observer. */
  evaluates: boolean
  observes: boolean
  is_lead: boolean
  /** Lead Evaluator (Evaluators only, team members who evaluate included). */
  leads: boolean
  /** What their organization grants let them be here. */
  grants: PeopleRole[]
  /** The organization's tags on them (shown first), then the exercise's. */
  org_tags: OrganizationTag[]
  tags: TTXTag[]
}

export interface ExercisePeopleListResponse {
  items: ExercisePersonRead[]
}

export interface ExercisePersonCandidateListResponse {
  items: { user_id: string; email: string; full_name: string; grants: PeopleRole[] }[]
}

/** An organization-level grant (Admin -> Users and roles). */
export type OrgRole = 'program_manager' | 'planner' | 'observer' | 'evaluator'

/** GET /organizations/{id}/members -- one person, every grant they hold. */
export interface OrgMemberRead {
  user_id: string
  email: string
  full_name: string
  granted_at: string
  last_login_at: string | null
  roles: OrgRole[]
  /** Per person: the same set on each of their grants. */
  tags: OrganizationTag[]
  /** Removed while still on exercises: nothing counts until they're off
   * those (then removable) or re-enabled. */
  disabled: boolean
}

/** GET /organizations/{id}/members/{user_id}/exercises -- what revoking a
 * role or removing the person touches. */
export interface OrgMemberExerciseListResponse {
  items: {
    ttx_id: string
    code: string
    name: string
    role: string
    plans: boolean
    controls: boolean
    facilitates: boolean
    evaluates: boolean
    observes: boolean
    is_lead: boolean
  }[]
}

export interface OrgMemberListResponse {
  items: OrgMemberRead[]
  total: number
  limit: number
  offset: number
  /** Holders per role in the whole organization. */
  role_counts: Partial<Record<OrgRole, number>>
}

/** GET /ttx/{ttx_id}/planning-team -- the exercise's Planners. */
export interface PlanningTeamMemberRead {
  user_id: string
  email: string
  full_name: string
  added_at: string
  last_login_at: string | null
  tags: TTXTag[]
  /** The Lead Planner: coordinates the team, owns the calendar and the
   * deliverables. Exactly one member. */
  is_lead: boolean
  /** What they do on the exercise: plan it, control it (run it), and --
   * Controllers only -- facilitate it. */
  plans: boolean
  controls: boolean
  facilitates: boolean
}

export interface PlanningTeamListResponse {
  items: PlanningTeamMemberRead[]
}

/** GET /ttx/{ttx_id}/planning-team/candidates -- org Planners not yet
 * on the exercise in any role. */
export interface PlanningTeamCandidateListResponse {
  items: { user_id: string; email: string; full_name: string }[]
}

// -- Needs & objectives form (Creator -> Needs) ----------------------------

export type NeedsFormStatus = 'draft' | 'ready_for_approval' | 'approved'
/** FIRST Traffic Light Protocol 2.0. */
export type Tlp = 'clear' | 'green' | 'amber' | 'amber_strict' | 'red'
export type Capability =
  | 'detection_triage_escalation'
  | 'incident_classification'
  | 'crisis_decision_making'
  | 'regulatory_notification'
  | 'internal_external_comms'
  | 'cross_unit_coordination'
  | 'third_party_supply_chain'
  | 'continuity_recovery'
  | 'legal_forensics'
export type NeedsTrigger =
  | 'regulatory'
  | 'annual_program'
  | 'new_or_revised_plan'
  | 'recent_incident'
  | 'pending_aar_actions'
  | 'new_threat'
  | 'audit_finding'
  | 'org_or_tech_change'
  | 'other'
export type ExerciseLevel = 'strategic' | 'tactical' | 'operational'
export type AarRecipient = 'executive_committee' | 'crisis_committee' | 'board' | 'other'
export type NeedSource =
  | 'risk_analysis'
  | 'incident_history'
  | 'previous_aar'
  | 'recent_changes'
  | 'threat_intel'
  | 'regulatory'
  | 'other'
export type NeedPriority = 'high' | 'medium' | 'low'
export type ApproverKind = 'sponsor' | 'design_lead' | 'compliance'

export interface NeedRead {
  id: string
  code: string
  source: NeedSource
  /** A short name: how tables, links and messages refer to the need. */
  title: string
  finding: string
  affected_capability: Capability
  priority: NeedPriority
}

export interface ObjectiveRead {
  id: string
  code: string
  /** A short name: how lists, references and headings name it. */
  title: string
  statement: string
  capability: Capability
  linked_need_ids: string[]
  /** One observable condition per line (one EEG point each). */
  success_criterion: string
  /** Achieved with at least this many conditions; null: all of them. */
  achieve_at_least: number | null
  /** Minutes from the inject that triggers it. */
  time_box_minutes: number | null
  /** What each outcome means here, read with the common rating scale:
   * achieved (P or S; a note on the rule its conditions make), partially
   * (M), not (U). Never EEG points. */
  achieved_note: string
  partially_achieved: string
  not_achieved: string
  /** One item to collect per line. */
  evidence: string
  regulatory_requirement_ids: string[]
}

export interface RiskRead {
  id: string
  risk: string
  mitigation: string
  owner: string
}

export interface EvidenceRead {
  id: string
  filename: string
  content_type: string
  size_bytes: number
  uploaded_by_name: string
  uploaded_at: string
}

export interface ApprovalRead {
  id: string
  version: number
  approver_kind: ApproverKind
  approver_name: string
  approver_role: string
  approved_on: string
  recorded_by_name: string
  recorded_at: string
  /** Files backing the approval (signed PDF, approval email...). */
  evidence: EvidenceRead[]
}

/** One rule the form breaks: `section` (0-9) to send the user to, the
 * `field` there, and the row (need/objective id) or value (capability,
 * approver kind) concerned. */
export interface ValidationIssue {
  code: string
  section: number
  field: string | null
  item_id: string | null
}

export interface ValidationReport {
  /** Blocks draft -> ready_for_approval. */
  ready: ValidationIssue[]
  /** Additionally blocks ready_for_approval -> approved. */
  approved: ValidationIssue[]
  /** Never blocks. */
  warnings: ValidationIssue[]
}

/** GET /ttx/{ttx_id}/needs-form */
export interface NeedsForm {
  id: string
  ttx_id: string
  exercise_code: string
  status: NeedsFormStatus
  version: number
  revision: number
  tlp: Tlp
  document_date: string
  design_lead: string
  sponsor_name: string
  sponsor_role: string
  sponsor_motivation: string
  findings_closure_commitment: boolean
  findings_owner: string
  aar_recipient: AarRecipient | null
  aar_recipient_other: string
  triggers: NeedsTrigger[]
  regulatory_frameworks: string[]
  regulatory_framework_other: string
  trigger_other: string
  capabilities: Capability[]
  levels: ExerciseLevel[]
  participating_areas: string[]
  third_parties: string[]
  perimeter: string
  out_of_scope: string
  date_window_start: string | null
  date_window_end: string | null
  max_duration_hours: number | null
  key_participants_availability: string
  confidentiality_restrictions: string
  budget_and_external_support: string
  stop_exercise_keyword: string
  needs: NeedRead[]
  objectives: ObjectiveRead[]
  risks: RiskRead[]
  approvals: ApprovalRead[]
  updated_at: string
  validation: ValidationReport
  /** Kinds of row whose codes don't follow the list's order and can still
   * be renumbered (a first draft, before any MSEL). */
  renumberable: NeedsRenumberKind[]
}

export type NeedsRenumberKind = 'needs' | 'objectives'

/** POST /ttx/{ttx_id}/needs-form/renumber: `previous` (row id -> code) undoes it. */
export interface NeedsFormRenumberResult {
  form: NeedsForm
  previous: Record<string, string>
}

/** One report a notification requirement demands: to whom, by when and
 * from what moment the clock runs. */
export interface NotificationMilestone {
  recipient_en: string
  recipient_es: string
  stage_en: string
  stage_es: string
  deadline_en: string
  deadline_es: string
  clock_en: string
  clock_es: string
}

/** GET /regulatory-requirements */
export interface RegulatoryRequirement {
  id: string
  framework: string
  reference: string
  description_en: string
  description_es: string
  /** The reports a notification requirement demands; empty for the rest. */
  notifications: NotificationMilestone[]
}

export type Jurisdiction = 'EU' | 'ES' | 'UK' | 'US' | 'GLOBAL'

/** A framework a regulatory trigger can name. "Other" isn't one: it's
 * implied, always offered last, with free text. */
export interface RegulatoryFramework {
  id: string
  label_en: string
  label_es: string
  jurisdiction: Jurisdiction
  name_en: string
  name_es: string
  scope_en: string
  scope_es: string
  /** Explicitly demands exercises or tests: a tabletop evidences it. */
  requires_exercises: boolean
  /** False for a contractual industry standard (PCI DSS). */
  binding: boolean
  rationale_en: string
  rationale_es: string
  rationale_reference: string
}

export interface RegulatoryCatalog {
  items: RegulatoryRequirement[]
  frameworks: RegulatoryFramework[]
}

/** GET /objective-catalog -- TTX-Zone's SMART objective templates. */
export interface ObjectiveTemplate {
  id: string
  capability: Capability
  title_en: string
  title_es: string
  statement_en: string
  statement_es: string
  criterion_en: string[]
  criterion_es: string[]
  evidence_en: string[]
  evidence_es: string[]
  regulatory_requirement_ids: string[]
  time_box_minutes: number | null
}

export interface ObjectiveCatalog {
  items: ObjectiveTemplate[]
}

export type RiskCategory = 'confidentiality' | 'people' | 'operations' | 'logistics' | 'conduct'

/** GET /risk-catalog -- TTX-Zone's exercise risk library. */
export interface RiskTemplate {
  id: string
  category: RiskCategory
  risk_en: string
  risk_es: string
  mitigation_en: string
  mitigation_es: string
  default: boolean
}

export interface RiskCatalog {
  items: RiskTemplate[]
}

// -- Evaluation ----------------------------------------------------------

/** GET /ttx/{ttx_id}/eeg -- what evaluators observe and rate; never the design. */
/** An MSEL expected action, listed under each objective its inject
 * evaluates. */
export interface EEGExpectedAction {
  code: string
  inject_code: string
  inject_title: string
  description: string
  responsible_role: string
  expected_within_minutes: number | null
}

/** An observation point of a definitive EEG (source "plan"). */
export interface EEGPoint {
  id: string
  kind: string
  text: string
  criteria: Record<'P' | 'S' | 'M' | 'U', string>
  action_code: string
  inject_code: string
  inject_title: string
  responsible_role: string
  expected_within_minutes: number | null
}

export interface EEGDuePhase {
  code: string
  name: string
  end_offset: number
}

export interface EEGObjective {
  id: string
  code: string
  title?: string
  capability: Capability
  statement: string
  observation_points: string[]
  evidence: string
  evidence_items?: string[]
  achieve_at_least?: number | null
  time_box_minutes?: number | null
  /** The MSEL phases it's due by the end of, in session order. */
  due_phases?: EEGDuePhase[]
  achieved_note?: string
  partially_achieved?: string
  not_achieved?: string
  expected_actions?: EEGExpectedAction[]
  /** The definitive EEG's points (source "plan"). */
  points?: EEGPoint[]
  evaluators?: string[]
}

/** A notification regime the team should recognise during the session,
 * derived from the notification requirements the objectives cite. */
export interface ExpectedNotification {
  requirement_id: string
  framework: string
  framework_label_en: string
  framework_label_es: string
  reference: string
  description_en: string
  description_es: string
  objective_codes: string[]
  milestones: NotificationMilestone[]
}

export interface EEGRead {
  ttx_id: string
  exercise_code: string
  exercise_name: string
  tlp: Tlp
  needs_form_status: NeedsFormStatus
  needs_form_version: number
  /** The MSEL version the expected actions come from (null: none yet). */
  msel_version?: number | null
  objectives: EEGObjective[]
  rating_scale: ('P' | 'S' | 'M' | 'U')[]
  /** "plan": the ready conduct prep's definitive EEGs; "derived": a draft. */
  source?: 'plan' | 'derived'
  plan_version?: number | null
  plan_reopened?: boolean
  /** The observers' notification reference (empty: none cited). */
  notifications?: ExpectedNotification[]
  lead_evaluator?: string | null
}

/** GET /ttx/{ttx_id}/evaluators -- the exercise's Evaluators. */
export interface EvaluatorRead {
  user_id: string
  email: string
  full_name: string
  added_at: string
  last_login_at: string | null
}

export interface EvaluatorListResponse {
  items: EvaluatorRead[]
}

// -- MSEL (Creator -> MSEL) -------------------------------------------------

export type MselStatus = 'draft' | 'in_review' | 'ready'
export type ActorType =
  | 'soc'
  | 'csirt'
  | 'authority'
  | 'media'
  | 'supplier'
  | 'customer'
  | 'threat_actor'
  | 'internal'
  | 'other'
export type InjectKind = 'mandatory' | 'contingent'
export type DeliveryMethod =
  | 'email'
  | 'phone'
  | 'chat'
  | 'ticket'
  | 'security_tool'
  | 'in_person'
  | 'briefing'
  | 'media'
  | 'document'
export type InjectReviewStatus = 'draft' | 'validated'

/** Where an actor of the library comes from: TTX-Zone's own catalog, the
 * organization's library, or made for one exercise. */
export type ActorOrigin = 'system' | 'organization' | 'exercise'

export interface MselActor {
  id: string
  code: string
  name: string
  type: ActorType
  /** Its role in the fiction. */
  description: string
  /** How it usually reaches the players. */
  channel: DeliveryMethod | null
  /** A copy of a library actor remembers which, and its name then. */
  origin: ActorOrigin
  origin_id: string | null
  origin_name: string | null
  played_by: string
}

/** GET /ttx/{ttx_id}/actors: the exercise's cast, managed from Templates
 * independently of the needs analysis and the MSEL. */
export interface ExerciseActor extends MselActor {
  /** An inject sends it: it can't leave the cast. */
  in_use: boolean
}

/** GET /actor-catalog: TTX-Zone's own, read-only actors. */
export interface SystemActor {
  id: string
  type: ActorType
  name_en: string
  name_es: string
  description_en: string
  description_es: string
  channel: DeliveryMethod
  default: boolean
}

/** Groups of TTX-Zone's tags; each has one colour. */
export type SystemTagGroup = 'threat' | 'audience' | 'regulation' | 'programme' | 'people'

/** GET /tag-catalog: TTX-Zone's own, read-only tags. */
export interface SystemTag {
  id: string
  group: SystemTagGroup
  color: TagColor
  name_en: string
  name_es: string
  description_en: string
  description_es: string
}

/** GET /organizations/{id}/actors: the organization's library. */
export interface OrganizationActor extends LibraryItemState {
  id: string
  name: string
  type: ActorType
  description: string
  channel: DeliveryMethod | null
  origin: ActorOrigin | null
  origin_id: string | null
  origin_name: string | null
  created_at: string
  updated_at: string
}

export interface MselPhase {
  id: string
  code: string
  name: string
  /** One line the table sees once the phase begins (older snapshots lack it). */
  headline?: string
  start_offset: number
  end_offset: number
  incident_jump_minutes: number
  situation_update: string
  key_questions: string[]
  objective_ids: string[]
  /** The objectives due by the end of this phase (a subset of
   * `objective_ids`): their deadline. */
  due_objective_ids?: string[]
}

export interface MselExpectedAction {
  id: string
  code: string
  description: string
  responsible_role: string
  expected_within_minutes: number | null
  /** The inject's objectives this action evidences: the EEG of each lists
   * it. */
  objective_ids: string[]
}

export interface MselInject {
  id: string
  code: string
  phase_id: string | null
  kind: InjectKind
  title: string
  content: string
  offset_minutes: number | null
  trigger_condition: string
  contingent_purpose: string
  /** Contingent: when the facilitator checks whether to fire it, in
   * minutes after its phase starts (null: its trigger action's window). */
  fires_at_minute?: number | null
  /** Inject, discussion (no objective, not in the EEG) or poll. */
  format?: InjectFormat
  /** A poll's question and options, voted on by the Players. */
  poll_question?: string
  poll_options?: string[]
  poll_outcomes?: string[]
  /** By option: meter key -> level (1 low, 2 medium, 3 high). */
  poll_impacts?: Record<string, number>[]
  /** The storyline map's branch (contingent injects): the inject it hangs
   * from, the expected action of that inject whose absence fires it, and
   * the mandatory inject where the storyline resumes. */
  branch_from_id: string | null
  branch_action_id: string | null
  rejoin_inject_id: string | null
  simulated_actor_id: string | null
  /** Whose activity its ATT&CK techniques are: a threat actor of the
   * scenario (`threat_actor_id`), noise, or none (no ATT&CK). */
  attack_attribution?: AttackAttribution | null
  threat_actor_id?: string | null
  recipients: string[]
  /** The exercise's rooms it's played in; empty: all (absent in snapshots
   * frozen before rooms). */
  room_ids?: string[]
  delivery_method: DeliveryMethod
  attachment_notes: string[]
  attack_techniques: AttackRef[]
  facilitator_notes: string
  /** The content drawn as a simulated artifact (absent in snapshots
   * frozen before artifacts; null: plain text). */
  artifact?: InjectArtifact | null
  review_status: InjectReviewStatus
  validated_by: string
  /** The account that validated it (null: not validated, or validated
   * before accounts were recorded). */
  validated_by_id?: string | null
  /** What it was copied from (the inject library), if anything. */
  origin?: ActorOrigin | null
  origin_id?: string | null
  origin_name?: string | null
  objective_ids: string[]
  expected_actions: MselExpectedAction[]
  /** Images shown with it, in order (GET …/msel/images/{id}). */
  images?: MselInjectImage[]
  /** Files the players download with it, in order (GET …/msel/files/{id}). */
  files?: MselInjectFile[]
}

export interface MselInjectImage {
  id: string
  caption: string
  width: number
  height: number
}

/** POST /ttx/{id}/msel/images: an uploaded image, to link from an inject. */
export interface MselImageUpload {
  id: string
  width: number
  height: number
}

/** POST /ttx/{id}/msel/files: an uploaded file (any type, stored as
 * uploaded), to link from an inject. */
/** GET .../files/{id}/preview -- the beginning of a text file. */
export interface MselFilePreview {
  id: string
  name: string
  size_bytes: number
  text: string
  truncated: boolean
  encoding: string
  limit_bytes: number
}

export interface MselFileUpload {
  id: string
  name: string
  size_bytes: number
  /** Hex SHA-256, for the players to check what they downloaded. */
  sha256: string
}

export interface MselInjectFile extends MselFileUpload {
  description: string
}

export type AttackAttribution = 'threat_actor' | 'noise'

/** A threat actor behind the scenario: a MITRE ATT&CK group or an unknown
 * actor, with the techniques that characterize it (its profile, in the
 * MSEL's release; an unknown actor may have none). */
export interface MselThreatActor {
  id: string
  code: string
  name: string
  mitre_group_id: string | null
  aliases: string[]
  description: string
  techniques: ThreatActorTechniqueRead[]
  origin: ActorOrigin
  origin_id: string | null
  origin_name: string | null
  /** When it last changed after being copied or created (null: never). */
  modified_at?: string | null
}

/** What the MSEL takes from the needs analysis -- nothing else of it. */
export interface MselNeedsContext {
  status: NeedsFormStatus
  version: number
  tlp: Tlp
  participating_areas: string[]
  /** Optional participants from outside (suppliers, authorities...): they
   * can receive injects too. Absent in snapshots frozen before that. */
  third_parties?: string[]
  max_duration_hours: number | null
  objectives: {
    id: string
    code: string
    title?: string
    statement: string
    capability: Capability
  }[]
}

/** GET /ttx/{ttx_id}/msel. `validation.ready` blocks draft -> in_review,
 * `validation.approved` (injects not validated) blocks in_review -> ready. */
export interface Msel {
  meters?: { key: string; name: string }[]
  id: string
  ttx_id: string
  exercise_code: string
  status: MselStatus
  version: number
  revision: number
  needs_form_version: number
  /** False while the needs analysis is being revised: read-only. */
  editable: boolean
  needs: MselNeedsContext
  title: string
  summary: string
  /** The MITRE ATT&CK release the techniques come from, e.g. "19.2". */
  attack_version: string
  /** The scenario's threat actors (absent in old snapshots). */
  threat_actors?: MselThreatActor[]
  /** Every technique its injects use -- derived, read-only. */
  attack_techniques: AttackRef[]
  /** "HH:MM:SS" local time, or null. */
  exercise_start: string | null
  incident_start: string | null
  /** The scene's date, "YYYY-MM-DD" (older snapshots lack it). */
  incident_date?: string | null
  duration_minutes: number | null
  time_compression: number
  actors: MselActor[]
  phases: MselPhase[]
  injects: MselInject[]
  /** Played in rooms: injects say which (absent in older snapshots). */
  uses_rooms?: boolean
  rooms?: MselRoom[]
  updated_at: string
  /** Who marked it ready and when (empty / null unless READY). */
  ready_by?: string
  ready_by_id?: string | null
  ready_at?: string | null
  validation: ValidationReport
  /** Kinds of row whose codes don't follow their order and can be
   * renumbered (a draft). */
  renumberable: MselRenumberKind[]
  /** A draft's versions frozen when it was ready before: they keep the old
   * codes, so renumbering asks first (absent in snapshots). */
  frozen_versions?: MselFrozenVersion[]
}

export type MselRenumberKind = 'phases' | 'injects' | 'threat_actors'

/** A version of the MSEL frozen when it became ready, and the sessions
 * played from it. */
export interface MselFrozenVersion {
  version: number
  ready_at: string
  ready_by: string
  sessions: number
}

/** A room of the exercise, as the MSEL aims injects at it. */
export interface MselRoom {
  id: string
  code: string
  name: string
}

/** POST /ttx/{ttx_id}/msel/renumber: `previous` (row id -> code) undoes it. */
export interface MselRenumberResult {
  msel: Msel
  previous: Record<string, string>
}

export type AttackDomain = 'enterprise' | 'ics'

/** An ATT&CK technique under the tactic it serves in the scenario, with
 * their names in the MSEL's pinned release (English, as MITRE publishes). */
export interface AttackRef {
  domain: AttackDomain
  tactic_id: string
  technique_id: string
  tactic_name: string
  technique_name: string
}

export interface AttackTechnique {
  id: string
  name: string
  tactics: string[]
  /** Set on a sub-technique: its parent's id. */
  parent: string | null
}

export interface AttackDomainCatalog {
  domain: AttackDomain
  name: string
  /** In matrix order, reconnaissance to impact. */
  tactics: { id: string; name: string }[]
  /** Live techniques only (deprecated ones aren't offered). */
  techniques: AttackTechnique[]
}

/** GET /attack/{version}: one MITRE ATT&CK release. */
export interface AttackCatalog {
  version: string
  /** "YYYY-MM-DD" */
  released: string
  latest_version: string
  copyright: string
  domains: AttackDomainCatalog[]
}

/** POST /ttx/{ttx_id}/msel/attack-upgrade */
export interface AttackUpgradeResult {
  msel: Msel
  replaced: { from_id: string; to_id: string }[]
  removed: string[]
}

/** GET /auth/me/lead-exercises: what deleting the account must hand over. */
export interface LeadExercise {
  ttx_id: string
  ttx_code: string
  ttx_name: string
  organization_name: string
  /** The rest of the planning team, longest-standing first. */
  candidates: { user_id: string; full_name: string }[]
}

/** Inject library (Library -> Injects). */
export type InjectFamily =
  | 'ransomware'
  | 'data_breach'
  | 'bec_fraud'
  | 'phishing_account_takeover'
  | 'supply_chain'
  | 'cloud_compromise'
  | 'ddos'
  | 'insider'
  | 'wiper_destructive'
  | 'ot_ics'
  | 'physical_hybrid'
  | 'regulatory'
  | 'generic'

export type InjectStage = 'detection' | 'escalation' | 'response' | 'recovery'

export type InjectAudience = 'executive' | 'technical' | 'mixed'

/** A text in both supported languages. */
export interface LocalizedText {
  es: string
  en: string
}

export interface SystemInjectAction {
  description: LocalizedText
  responsible_role: LocalizedText
  /** Scenario minutes after the inject is delivered. */
  within_minutes: number | null
}

export interface SystemInjectAttack {
  domain: string
  tactic_id: string
  tactic_name: string
  technique_id: string
  technique_name: string
}

/** GET /inject-catalog: one of TTX-Zone's inject templates. */
export interface SystemInject {
  /** INJ-<FAM>-NN, INJ-<FAM>-CNN for contingent ones. */
  id: string
  title: LocalizedText
  content: LocalizedText
  kind: InjectKind
  contingent_for: string | null
  trigger: LocalizedText | null
  purpose: LocalizedText | null
  /** A TTX-Zone actor id (GET /actor-catalog). */
  actor: string
  delivery_method: DeliveryMethod
  recipients: LocalizedText[]
  expected_actions: SystemInjectAction[]
  attachments: LocalizedText[]
  key_question: LocalizedText | null
  facilitator_notes: LocalizedText | null
  families: InjectFamily[]
  stage: InjectStage
  capabilities: Capability[]
  audience: InjectAudience
  attack: SystemInjectAttack[]
  frameworks: string[]
  variables: string[]
  /** Scenario variables' default values (system ones have none). */
  variable_defaults: Record<string, LocalizedText>
  /** Illustrations (a few injects only), served at
   * GET /inject-catalog/{id}/images/{index}?lang=; copied with the inject. */
  images?: SystemInjectImage[]
}

export interface SystemInjectImage {
  index: number
  caption: LocalizedText
  width: number
  height: number
}

export interface SystemInjectCatalog {
  attack_version: string
  items: SystemInject[]
}

/** An expected action in a library template: scenario minutes. */
export interface TemplateAction {
  description: string
  responsible_role: string
  within_minutes: number | null
}

export type ContentLanguage = 'en' | 'es'

/** What an inject template is in an organization's library (one
 * language): what its form edits and what a copy carries over. */
export interface OrganizationInjectFields {
  format: InjectFormat
  poll_question: string
  poll_options: string[]
  poll_outcomes: string[]
  /** The language its text is written in; null only for injects saved
   * before it was recorded. */
  language: ContentLanguage | null
  title: string
  content: string
  kind: InjectKind
  trigger_condition: string
  contingent_purpose: string
  actor_name: string
  actor_type: ActorType
  actor_origin: ActorOrigin | null
  actor_origin_id: string | null
  delivery_method: DeliveryMethod
  recipients: string[]
  expected_actions: TemplateAction[]
  attachment_notes: string[]
  key_question: string
  facilitator_notes: string
  families: InjectFamily[]
  stage: InjectStage
  audience: InjectAudience
  capabilities: Capability[]
  attack_version: string
  attack: AttackRef[]
  frameworks: string[]
  variable_defaults: Record<string, string>
  origin: ActorOrigin | null
  origin_id: string | null
  /** The original's title at copy time ("Copied from"). */
  origin_name: string | null
}

/** GET /organizations/{id}/injects: the organization's library. */
export interface OrganizationInject extends OrganizationInjectFields, LibraryItemState {
  id: string
  created_at: string
  updated_at: string
}

/** Threat actor library (Library -> Threat actors). A technique a threat
 * actor uses, as MITRE records it: no tactic (a technique may serve
 * several). */
export interface ThreatActorTechnique {
  domain: AttackDomain
  technique_id: string
}

export interface ThreatActorTechniqueRead extends ThreatActorTechnique {
  technique_name: string
  /** The technique's tactics in the release. */
  tactic_ids: string[]
}

/** GET /threat-actor-catalog: a MITRE ATT&CK group. */
export interface SystemThreatActor {
  id: string
  name: string
  aliases: string[]
  techniques: ThreatActorTechnique[]
}

export interface SystemThreatActorCatalog {
  attack_version: string
  released: string
  copyright: string
  items: SystemThreatActor[]
}

/** GET /organizations/{organization_id}/threat-actors */
export interface OrganizationThreatActor extends LibraryItemState {
  id: string
  name: string
  mitre_group_id: string | null
  aliases: string[]
  description: string
  attack_version: string
  techniques: ThreatActorTechniqueRead[]
  origin: ActorOrigin | null
  origin_id: string | null
  origin_name: string | null
  created_at: string
  updated_at: string
}

/** What moving ATT&CK references onto another release changed: MITRE's
 * replacements applied (techniques and groups) and what that release
 * doesn't have. */
export interface AttackConversion {
  replaced: { from_id: string; to_id: string }[]
  removed: string[]
}

/** POST /attack/{version}/threat-actor */
export interface ThreatActorProfileConversion {
  mitre_group_id: string | null
  techniques: ThreatActorTechniqueRead[]
  conversion: AttackConversion
}

/** POST /organizations/{id}/{threat-actors,injects}/attack-upgrade */
export interface LibraryAttackUpgrade {
  attack_version: string
  upgraded: number
  conversion: AttackConversion
}

/** Creator -> Session plan (GET /ttx/{id}/conduct-prep). */
export type ConductPrepStatus = 'draft' | 'ready'
export type SessionModality = 'in_person' | 'remote' | 'hybrid'
export type EegPointKind = 'criterion' | 'expected_action' | 'notification' | 'custom'
export type EegSourceStatus = 'custom' | 'current' | 'changed' | 'orphaned'
export type FindingKind = 'ambiguous_inject' | 'overloaded_phase' | 'unrealistic_timing' | 'other'
/** Which review of the design found it. */
export type FindingSource = 'design_review' | 'planning_meeting' | 'dry_run'
export type AbsenceFallback = 'substitute' | 'postpone' | 'proceed'

export interface ConductPrepEegPoint {
  id: string
  kind: EegPointKind
  text: string
  criteria_p: string
  criteria_s: string
  criteria_m: string
  criteria_u: string
  source_text: string
  source_action_id: string | null
  source_action_code: string
  source_inject_code: string
  source_inject_title: string
  responsible_role: string
  expected_within_minutes: number | null
  source_requirement_id: string
  source_status: EegSourceStatus
}

export interface ConductPrepEegObjective {
  id: string
  objective_id: string
  code: string
  title?: string
  statement: string
  capability: string
  orphaned: boolean
  points: ConductPrepEegPoint[]
}

export interface ConductPrepEvaluator {
  id: string
  user_id: string
  full_name: string
  areas: string[]
  briefed: boolean
  objective_ids: string[]
}

export interface ConductPrepFinding {
  id: string
  kind: FindingKind
  found_in: FindingSource
  description: string
  inject_id: string | null
  phase_id: string | null
  resolved: boolean
}

export interface ConductPrepAttendee {
  id: string
  user_id: string | null
  name: string
  role: string
  confirmed: boolean
  fallback: AbsenceFallback | null
  substitute: string
}

export interface PersonOption {
  user_id: string
  full_name: string
}

export interface CodedOption {
  id: string
  code: string
  title: string
}

export interface ConductPrepContext {
  tlp: Tlp
  needs_form_status: NeedsFormStatus
  needs_form_version: number
  date_window_start: string | null
  date_window_end: string | null
  max_duration_hours: number | null
  stop_exercise_keyword: string
  participating_areas: string[]
  msel_status: MselStatus | null
  msel_ready_version: number | null
  msel_exercise_start: string | null
  msel_duration_minutes: number | null
  mandatory_injects: number
  mandatory_injects_validated: number
  lead_evaluator: PersonOption | null
  exercise_evaluators: PersonOption[]
  /** The team members who control it (briefed with the Evaluators). */
  exercise_controllers: PersonOption[]
  team_members: PersonOption[]
  phases: CodedOption[]
  injects: CodedOption[]
  /** Players with access: when they used the invitation (null if added
   * another way) and when access was granted. */
  exercise_players: {
    user_id: string
    full_name: string
    email: string
    invited_at: string | null
    joined_at: string
  }[]
  pending_access_requests: number
}

export interface ConductPrep {
  id: string
  ttx_id: string
  exercise_code: string
  status: ConductPrepStatus
  version: number
  revision: number
  editable: boolean
  seeded_needs_form_version: number
  seeded_msel_version: number | null
  drift: { needs_changed: boolean; msel_changed: boolean }
  context: ConductPrepContext
  eeg: ConductPrepEegObjective[]
  evaluators: ConductPrepEvaluator[]
  data_collection_methods: string[]
  data_collection_other: string
  log_keeper_id: string | null
  briefing_date: string | null
  briefing_checklist: string[]
  briefing_notes: string
  briefed_controller_ids: string[]
  /** The evaluation calendar: days after the session. */
  hot_wash_days: number
  debrief_days: number
  ratings_due_days: number
  draft_aar_days: number
  after_action_meeting_days: number
  fpm_date: string | null
  fpm_done: boolean
  fpm_attendees: string
  fpm_notes: string
  fpm_msel_version: number | null
  dry_run_date: string | null
  dry_run_done: boolean
  findings: ConductPrepFinding[]
  session_date: string | null
  session_time: string | null
  timezone: string
  session_starts_at: string | null
  modality: SessionModality | null
  venue: string
  room: string
  meeting_link: string
  session_notes: string
  invitation_sent_on: string | null
  invitation_text: string
  logistics_checklist: string[]
  attendees: ConductPrepAttendee[]
  documents_reviewed: string[]
  stop_procedure: string
  updated_at: string
  ready_by: string
  ready_by_id: string | null
  ready_at: string | null
  validation: ValidationReport
}

/** GET /ttx/{id}/run: the Playground's live session, projected per role
 * (Players and the rest of the table get delivered injects only; `control`
 * only for a Controller). */
export type RunState = 'not_started' | 'live' | 'paused' | 'ended' | 'stopped'

export interface RunPhase {
  code: string
  number: number
  state: 'done' | 'current' | 'upcoming'
  /** Null until the phase begins. */
  name: string | null
  headline: string | null
}

export type ArtifactKind = 'email' | 'press_release' | 'social_post' | 'chat_message'

/** An inject's content rendered as a simulated artifact: the body is the
 * inject's content, these the template's header fields (their meaning
 * follows `kind`). Plain text, drawn by the app. */
export interface InjectArtifact {
  kind: ArtifactKind
  sender: string
  sender_address: string
  recipient: string
  subject: string
  timestamp: string
  location: string
}

export interface RunInject {
  code: string
  title: string
  content: string
  format?: InjectFormat
  phase_code: string | null
  delivery_method: DeliveryMethod
  sender: { name: string; type: ActorType; channel: DeliveryMethod | null } | null
  recipients: string[]
  attachment_notes: string[]
  /** The content drawn as a simulated email, press release… (null: text). */
  artifact?: InjectArtifact | null
  images: MselInjectImage[]
  /** Files the table downloads with it (GET …/run/files/{id}). */
  files?: MselInjectFile[]
  /** Minutes into the fiction, from the incident start. */
  scenario_minute: number | null
  released_at: string
  /** Key questions the Controller put to the table on it. */
  questions: { text: string; covered: boolean; room_code?: string | null }[]
  /** Rooms: the rooms it's played in (empty: all of them). */
  room_codes?: string[]
}

/** Rooms: each place asks and covers a phase's key questions on its own. */
export interface RunQuestionPlace {
  room_code: string
  released_questions: number[]
  covered_questions: number[]
}

export type ActionMark = 'observed' | 'partial' | 'not_observed'

export interface RunAction {
  code: string
  description: string
  responsible_role: string
  expected_within_minutes: number | null
  mark: ActionMark | null
  note: string
  marked_at: string | null
}

export interface RunControlInject {
  code: string
  title: string
  kind: InjectKind
  format?: InjectFormat
  phase_code: string | null
  offset_minutes: number | null
  /** The session minute it's due (a contingent's check minute). */
  due_minute: number | null
  state: 'pending' | 'released' | 'skipped'
  /** Why it was released (a contingent) or skipped. */
  reason: string
  trigger_condition: string
  contingent_purpose: string
  branch_action_code: string | null
  /** Its expected action was marked not observed: time to fire it. */
  suggested: boolean
  expected_actions: RunAction[]
  /** Rooms: the rooms it's played in (empty: all of them). */
  room_codes?: string[]
}

export interface RunControlPhase {
  code: string
  name: string
  start_offset: number
  end_offset: number
  key_questions: string[]
  /** Positions of the key questions already put to the table, and of
   * those marked as discussed. */
  released_questions: number[]
  covered_questions: number[]
  /** Rooms: where they stand in each place. */
  question_places?: RunQuestionPlace[]
}

export interface RunPresence {
  role: ContextRole
  /** Null for the team, to a Player (they see only how many). */
  name: string | null
}

/** The Facilitator's script for the phase in play. */
export interface RunFacilitation {
  phase_code: string
  phase_name: string
  key_questions: string[]
  released_questions: number[]
  covered_questions: number[]
  /** Rooms: where they stand in each place. */
  question_places?: RunQuestionPlace[]
  inject_code: string | null
  facilitator_notes: string
}

export interface RunNote {
  id: string
  /** "" for the general note. */
  inject_code: string
  /** Rooms: the place a team member's note on an inject is about. */
  room_code?: string
  text: string
  updated_at: string
}

export interface RunTeamNote {
  author: string
  role: ContextRole
  inject_code: string
  room_code?: string
  text: string
  updated_at: string
}

export interface RunRead {
  /** The team's all along; a Player's once the Controller shows them. */
  meters?: RunMeterGroup[]
  meters_shown?: boolean
  state: RunState
  seq: number
  /** Sent back as `?since=`: 204 while nothing happened, nobody came or went. */
  cursor: string
  /** Which run of the exercise (1, 2...); null before it starts. */
  run_number?: number | null
  /** The Controller may restart it by deleting it: over, and no
   * after-action report written from it. */
  can_delete?: boolean
  started_at: string | null
  ended_at: string | null
  /** Pauses the session clock leaves out: over, and the current one. */
  paused_seconds: number
  paused_at: string | null
  /** The current pause is for a real-world event (REAL WORLD pressed):
   * since when, and by whom. */
  real_world_at?: string | null
  real_world_by?: string | null
  /** The time since the last inject: when it started counting (the latest
   * release, or a Controller's reset) and the pause seconds counted then. */
  inject_timer_at?: string | null
  inject_timer_paused_seconds?: number
  stop_reason: string
  stop_keyword: string
  scenario_title: string
  scenario_summary: string
  incident_start: string | null
  incident_date: string | null
  time_compression: number
  session_time: string | null
  phases: RunPhase[]
  current_phase_code: string | null
  /** The Controller's closing message (ENDEX) went out: every phase is over. */
  endex_released_at?: string | null
  /** Delivered, oldest first. */
  injects: RunInject[]
  can_control: boolean
  msel_ready: boolean
  plan_ready: boolean
  control: {
    phases: RunControlPhase[]
    injects: RunControlInject[]
    /** The frozen MSEL being played (for the storyline map). */
    msel: Msel
  } | null
  presence: RunPresence[]
  /** How many are present, by role (a Player's `presence` names only a
   * few Players). Absent from an older server: count `presence`. */
  presence_counts?: Record<string, number>
  facilitation: RunFacilitation | null
  /** Null (or absent): played at one table. */
  rooms?: RunRooms | null
  /** The table's decision log, oldest first, and its votes (a Player gets
   * their room's and the main room's). */
  decisions?: RunDecision[]
  polls?: RunPoll[]
}

/** A decision of the table, as recorded (and maybe edited). */
export interface RunDecision {
  id: string
  text: string
  inject_code: string
  /** "main", a room's code; null without rooms. */
  room_code: string | null
  author: string
  role: ContextRole
  at: string
  edited: boolean
  /** Recorded from a vote's result. */
  poll_id?: string | null
  mine: boolean
}

/** A question put to the Players' vote: the tally, never who voted. */
/** What an inject is: it decides its code (INJ, DSC, POL), which steps
 * its dialog has, and what happens when it's released. */
export type InjectFormat = 'inject' | 'discussion' | 'poll'

/** The impact meters of one place: the table, or a room. */
export interface RunMeterGroup {
  room_code: string | null
  decisions: number
  meters: { key: string; name: string; total: number; most: number }[]
}

export interface RunPoll {
  id: string
  question: string
  /** `outcome`: what follows the option, for the team only. */
  options: {
    text: string
    votes: number
    outcome?: string | null
    impacts?: { name: string; level: number }[]
  }[]
  inject_code: string
  room_code: string | null
  open: boolean
  voters: number
  /** The viewer's own vote (a Player), as the option's position. */
  my_vote?: number | null
  decision_id?: string | null
  /** A poll of the MSEL (not one put to a vote on the spot). */
  planned?: boolean
  /** False: the tally stays with the team (a Player gets every option at
   * 0) until the Controller shows it. */
  results_visible?: boolean
  /** The option the vote settled on and what follows it, once closed; a
   * Player gets them only with the result. */
  outcome_option?: number | null
  outcome?: string | null
}

/** Where a Player is: their own room, or the main room (where everyone
 * without a room always is). */
export type RoomLocation = 'main' | 'room'

export interface RunRoom {
  code: string
  name: string
  /** Players seated in it, and how many of them are in the main room now. */
  players: number
  in_main: number
}

export interface RunRoomPlayer {
  user_id: string
  name: string
  room_code: string | null
  location: RoomLocation
}

/** A session played in rooms. A Player gets only their own room and
 * `me`; the Controller also `players`, to move them. */
export interface RunRooms {
  rooms: RunRoom[]
  main_projected: string | null
  /** Every inject projected in the main room so far, in order. */
  main_history: string[]
  in_main: number
  me?: { room_code: string | null; room_name: string | null; location: RoomLocation } | null
  players?: RunRoomPlayer[] | null
  /** A team member's default room: where their view opens (null: the
   * first room). */
  default_room_code?: string | null
}

/** GET /ttx/{id}/run/evaluation: the Evaluator's EEG for the session. */
export type RatingLevel = 'P' | 'S' | 'M' | 'U'

export interface RunPoint {
  id: string
  kind: string
  text: string
  /** Keyed P/S/M/U; blank reads the common scale. */
  criteria: Record<RatingLevel, string>
  inject_code: string
  action_code: string
  responsible_role: string
  expected_within_minutes: number | null
  action_mark: ActionMark | null
  action_note: string
  rating: { level: RatingLevel; rationale: string; inject_code: string; updated_at: string } | null
}

export interface RunEvaluation {
  objectives: {
    id: string
    code: string
    title: string
    capability: string
    statement: string
    points: RunPoint[]
  }[]
  rated: number
  total: number
}

/** GET /ttx/{id}/run/summary: how the session went (the team only). */
/** A previous (archived) run of the exercise. */
export interface RunPast {
  id: string
  number: number
  state: RunState
  started_at: string
  ended_at: string | null
  stop_reason: string
  has_report: boolean
}

export interface RunSummary {
  state: RunState
  started_at: string
  ended_at: string | null
  played_minutes: number
  stop_reason: string
  injects: {
    code: string
    title: string
    kind: InjectKind
    state: 'pending' | 'released' | 'skipped'
    reason: string
  }[]
  /** By what the Controller marked, plus "unmarked". */
  actions: Record<ActionMark | 'unmarked', number>
  questions_asked: number
  questions_covered: number
  ratings: { name: string; rated: number; total: number }[]
  levels: Record<RatingLevel, number>
  team_notes: number
  milestones: {
    key: 'hot_wash' | 'debrief' | 'ratings_due' | 'draft_aar' | 'after_action_meeting'
    on: string
  }[]
}

/** GET /ttx/{id}/run/feedback: the participant feedback form. */
export interface RunFeedbackForm {
  available: boolean
  submitted: boolean
  intro: string
  statements: { key: string; text: string }[]
  open_questions: { key: string; text: string }[]
}

/** GET /ttx/{id}/run/feedback/results: the answers, aggregated. */
export interface RunFeedbackResults {
  responses: number
  players: number
  team: number
  minimum: number
  shown: boolean
  statements: {
    key: string
    text: string
    n: number
    average: number | null
    distribution: number[] | null
  }[]
  answers: Record<string, string[]>
  open_questions: { key: string; text: string }[]
}

/** GET /ttx/{id}/aar: the editable after-action report and improvement plan. */
export type ImprovementStatus = 'open' | 'in_progress' | 'done' | 'cancelled'

export interface ImprovementAction {
  id: string | null
  /** Only on the page: names a row an AI proposal made before it has an id. */
  key?: string
  code: string
  objective_code: string | null
  finding: string
  action: string
  owner: string
  owner_area: string
  due_date: string | null
  status: ImprovementStatus
  status_note: string
  overdue: boolean
  /** The later exercise that re-tests it (follow-up, like the status). */
  retest?: RetestRef | null
}

/** The later exercise that re-tests an improvement action, and which of
 * its objectives (none: the exercise as a whole). */
export interface RetestRef {
  ttx_id: string
  ttx_code: string
  ttx_name: string
  objective_id: string | null
  objective_code: string | null
  objective_title: string | null
}

/** A later exercise of the organization an action can be linked to: code,
 * name and objectives only. */
export interface RetestCandidate {
  ttx_id: string
  ttx_code: string
  ttx_name: string
  archived: boolean
  objectives: { id: string; code: string; title: string }[]
}

/** An improvement action of an earlier exercise that this one re-tests. */
export interface RetestedAction {
  source_ttx_id: string
  source_ttx_code: string
  source_ttx_name: string
  code: string
  finding: string
  action: string
  status: ImprovementStatus
  objective_id: string | null
  objective_code: string | null
  objective_title: string | null
}

export interface AarObjective {
  id: string
  objective_code: string
  title: string
  overall: RatingLevel | null
  strengths: string
  improvements: string
  analysis: string
  session_ratings: {
    point: string
    level: RatingLevel
    rationale: string
    evaluator: string
    room_code?: string
  }[]
}

/** A session an after-action report can be written from: the current one
 * or an archived one. */
export interface AarRunOption {
  id: string
  number: number
  current: boolean
  status: string
  started_at: string
}

/** The after-action report before it exists (`GET /ttx/{id}/aar/preview`). */
export interface AarPreview {
  session_started: boolean
  /** The caller may start and write it (a Planner or the Lead Evaluator). */
  can_edit: boolean
  objectives: { code: string; title: string }[]
  /** The sessions it can be written from, the default first (the current
   * one, else the latest archived). */
  runs: AarRunOption[]
}

export interface AarRead {
  id: string
  ttx_id: string
  status: 'draft' | 'final'
  version: number
  revision: number
  executive_summary: string
  scenario_summary: string
  conclusions: string
  objectives: AarObjective[]
  actions: ImprovementAction[]
  finalized_by: string
  finalized_at: string | null
  updated_at: string
  /** Never on an archived exercise, whose plan its authors still follow
   * up (`can_follow_up`: status, note, due date). */
  can_edit: boolean
  can_follow_up?: boolean
  /** The run it was written from, and whether the caller reads that run's
   * team notes and feedback. */
  run_id: string | null
  can_see_session: boolean
  /** The sessions it can be written from, the default first. */
  runs: AarRunOption[]
}

/** GET /organizations/{id}/improvement-plan. */
export interface ImprovementPlanList {
  items: {
    id: string
    ttx_id: string
    ttx_code: string
    ttx_name: string
    report_status: 'draft' | 'final'
    code: string
    objective_code: string | null
    finding: string
    action: string
    owner: string
    owner_area: string
    due_date: string | null
    status: ImprovementStatus
    overdue: boolean
    retest?: RetestRef | null
  }[]
  total: number
  open: number
  overdue: number
}

/** A room of an exercise played by several teams at once (Creator ->
 * Exercise -> Rooms). The main room is implicit, never one of these. */
export interface RoomRead {
  id: string
  code: string
  name: string
  description: string
  player_count: number
}

export interface RoomPlayerRead {
  user_id: string
  email: string
  full_name: string
  last_login_at: string | null
  joined_at: string
  /** Null: no room yet, so the main room only. */
  room_id: string | null
}

/** Creator -> Invitations -> Players: one Player who joined the exercise. */
export interface TTXPlayerRead {
  user_id: string
  email: string
  full_name: string
  last_login_at: string | null
  joined_at: string
  /** Only while the exercise is played in rooms; null = no room yet. */
  room: { code: string; name: string } | null
  /** The invitation whose request was approved; null if added another way. */
  invitation: { id: string; description: string | null } | null
  /** Joined through a personal invitation sent by email (no request). */
  invited_by_email: boolean
}

export interface TTXPlayersRead {
  uses_rooms: boolean
  items: TTXPlayerRead[]
}

export interface RoomsRead {
  uses_rooms: boolean
  /** The MSEL is ready or the session has started: rooms can't be added,
   * removed or turned off (renaming and seating Players still can). */
  structure_locked: boolean
  rooms: RoomRead[]
  players: RoomPlayerRead[]
  /** Team members who follow the session, and the room their view opens on. */
  team?: RoomTeamMemberRead[]
}

export interface RoomTeamMemberRead {
  user_id: string
  email: string
  full_name: string
  /** What they follow the session as. */
  roles: ('controller' | 'facilitator' | 'evaluator' | 'observer')[]
  room_id: string | null
}

export type TenancyMode = 'open' | 'single' | 'managed'

/** GET /instance/policy -- public: the register screen reads it. */
export interface InstancePolicy {
  tenancy_mode: TenancyMode
  can_found_organization: boolean
  /** The deployment sends email links: the sign-in page offers "Forgot
   * your password?". */
  password_reset_available: boolean
  /** Same condition: Creator -> Players -> Invitations can send personal
   * invitations by email. */
  email_invitations_available: boolean
  /** The deployment's password rules the forms check before sending
   * (Platform -> Sign-in security); reuse is only checked by the server. */
  password_min_length: number
  password_reject_personal: boolean
  /** The AI assistant is on: Preferences shows its section. */
  assistant_enabled?: boolean
  /** The face this server is: "public" serves only the Players' part
   * (docs/deployment.md, section 9). */
  surface?: 'internal' | 'public'
}

/** Platform -> Sign-in security: password rules on top of the fixed floor. */
export interface PasswordPolicy {
  min_length: number
  reject_personal: boolean
  /** null: passwords never expire. */
  max_age_days: number | null
  /** 0: reuse isn't checked. */
  history_count: number
}

/** Roles whose second factor is mandatory. The instance administrator
 * always needs one, so it has no flag. */
export type MfaPolicyRole = 'program_manager' | 'planner' | 'evaluator' | 'observer' | 'player'
export type MfaPolicy = Record<MfaPolicyRole, boolean>

/** GET/PUT /instance/security-policy. */
export interface SecurityPolicy {
  password: PasswordPolicy
  mfa: MfaPolicy
  /** Per role: active accounts holding it without their own TOTP. */
  accounts_without_totp: Record<MfaPolicyRole, number>
}

export type EmailInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export type EmailInvitationOutcomeKind =
  'sent' | 'resent' | 'already_player' | 'on_team' | 'dropped'

export interface EmailInvitationRead {
  id: string
  ttx_id: string
  email: string
  status: EmailInvitationStatus
  invited_by_name: string | null
  created_at: string
  sent_at: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
}

export interface EmailInvitationListResponse {
  items: EmailInvitationRead[]
  total: number
  limit: number
  offset: number
}

export interface EmailInvitationCreateResponse {
  results: { email: string; outcome: EmailInvitationOutcomeKind }[]
}

export interface EmailInvitationPreview {
  organization_name: string
  ttx_name: string
  /** "p•••@acme.com": the mailbox the link went to. */
  email_hint: string
  account_exists: boolean
}

export interface EmailInvitationAcceptResponse {
  ttx_id: string
  ttx_name: string
  organization_id: string
  organization_name: string
  created_account: boolean
}

/** Platform: the deployment's tenancy rules. */
export interface InstanceSettings {
  tenancy_mode: TenancyMode
  max_organizations: number | null
  /** Set in the deployment's configuration: read-only here. */
  pinned_by_env: boolean
  organization_count: number
}

/** A domain whose accounts can't found an organization of their own --
 * only in an "open" deployment. */
export interface FreeEmailDomain {
  domain: string
  /** Shipped with TTX-Zone: switched off, never removed. */
  builtin: boolean
  active: boolean
}

export interface FreeEmailDomainListResponse {
  items: FreeEmailDomain[]
  /** Whether the deployment's rule is "open", the only one it applies to. */
  applies: boolean
}

export interface InstanceOrganization {
  id: string
  name: string
  domain: string | null
  program_manager_count: number
  created_at: string
}

export interface InstanceOrganizationListResponse {
  items: InstanceOrganization[]
  total: number
  limit: number
  offset: number
}

export interface InstanceAccountOrganization {
  id: string
  name: string
  roles: OrgRole[]
  /** Removed from the organization while still on its exercises. */
  disabled: boolean
  /** Its only active Program Manager: suspending the account leaves the
   * organization without one. */
  sole_program_manager: boolean
}

/** Platform -> Accounts: an account of the whole deployment. */
export interface InstanceAccount {
  user_id: string
  email: string
  full_name: string | null
  created_at: string
  last_login_at: string | null
  is_instance_admin: boolean
  suspended_at: string | null
  organizations: InstanceAccountOrganization[]
}

export interface InstanceAccountListResponse {
  items: InstanceAccount[]
  total: number
  limit: number
  offset: number
}

export interface InstanceAccountExercise {
  id: string
  code: string
  name: string
  organization_id: string
  organization_name: string
  /** Context roles held on it (planner, controller, ..., player). */
  roles: ContextRole[]
  lead_evaluator: boolean
  lead_planner: boolean
}

export type AccountDependencyCategory =
  | 'organizations'
  | 'exercises'
  | 'exercise_requests'
  | 'invitations'
  | 'library'
  | 'exercise_content'
  | 'instance'
  | 'other'

/** Platform -> Accounts -> one account. */
export interface InstanceAccountDetail extends InstanceAccount {
  totp_enabled: boolean
  email_mfa_enabled: boolean
  backup_codes_remaining: number
  password_change_required: boolean
  /** When the address was confirmed (a link opened, or single sign-on). */
  email_verified_at: string | null
  /** The account is held at the confirmation screen. */
  email_verification_pending: boolean
  /** Past the periodic reconfirmation's grace period: held at the
   * confirmation screen. */
  email_reconfirmation_overdue: boolean
  active_sessions: number
  exercises: InstanceAccountExercise[]
  /** What keeps it from being deleted for good; empty = it can be. */
  dependencies: { category: AccountDependencyCategory; count: number }[]
  /** Your own account: managed from Preferences. */
  is_self: boolean
}

/** Platform -> Administrators: an account that runs Platform. */
export interface InstanceAdmin {
  user_id: string
  email: string
  full_name: string
  created_at: string
  last_login_at: string | null
  suspended_at: string | null
}

export interface InstanceAdminListResponse {
  items: InstanceAdmin[]
  /** False: granted and revoked from the server's console only. */
  web_grants_enabled: boolean
}

/** One entry of Platform's activity log, as it read at the time. */
export interface PlatformAuditEvent {
  id: string
  created_at: string
  action: PlatformAuditAction
  /** Null: the server's console. */
  actor_user_id: string | null
  actor_label: string
  target_kind: 'account' | 'organization' | 'instance' | 'legal' | 'exercise'
  target_id: string | null
  target_label: string | null
  details: Record<string, unknown> | null
}

export type PlatformAuditAction =
  | 'tenancy.update'
  | 'security_policy.update'
  | 'free_email_domain.add'
  | 'free_email_domain.remove'
  | 'free_email_domain.enable'
  | 'free_email_domain.disable'
  | 'organization.create'
  | 'organization.domain'
  | 'organization.delete'
  | 'program_manager.grant'
  | 'program_manager.revoke'
  | 'account.create'
  | 'account.suspend'
  | 'account.reactivate'
  | 'account.update'
  | 'account.password_reset'
  | 'account.totp_reset'
  | 'account.sessions_end'
  | 'account.delete'
  | 'instance_admin.grant'
  | 'instance_admin.revoke'
  | 'legal.publish'
  | 'legal.acceptances_export'
  | 'audit.export'
  | 'audit_webhook.update'
  | 'audit_webhook.rotate_secret'
  | 'audit_webhook.delete'
  | 'email.settings_update'
  | 'email.settings_delete'
  | 'email.test'
  | 'email.reconfirmation_update'
  | 'sso.settings_update'
  | 'sso.settings_delete'
  | 'sso.test'
  | 'assistant.settings_update'
  | 'assistant.proposal_accepted'
  | 'assistant.proposal_discarded'
  | 'organization.leave'
  | 'organization.allowed_domain'
  | 'library.item_delete'
  | 'exercise.delete'
  | 'exercise.member_joined'
  | 'exercise.needs_approved'
  | 'exercise.needs_approval_recorded'
  | 'exercise.scenario_applied'
  | 'exercise.aar_final'
  | 'exercise.aar_reopened'
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.login_locked'
  | 'auth.signup_locked'
  | 'auth.mfa_failed'
  | 'auth.mfa_locked'
  | 'auth.backup_code_login'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.password_change'
  | 'auth.totp_enable'
  | 'auth.totp_disable'
  | 'auth.backup_codes_regenerate'
  | 'auth.mfa_email_sent'
  | 'auth.mfa_email_enable'
  | 'auth.mfa_email_disable'
  | 'auth.mfa_preferred'
  | 'auth.mfa_skipped'
  | 'auth.step_up'
  | 'auth.step_up_failed'
  | 'auth.sso_link'
  | 'auth.sso_unlink'
  | 'auth.token_create'
  | 'auth.token_revoke'

export interface PlatformAuditListResponse {
  items: PlatformAuditEvent[]
  total: number
  limit: number
  offset: number
}

/** Platform -> Activity log -> Retention (fixed, read-only). */
export interface AuditRetention {
  days: number
  /** The server's log files: rotated at this size (0 = by logrotate). */
  log_file_max_mb: number
  log_file_backups: number
}

/** Platform -> Activity log -> Forward to a SIEM. */
export interface AuditWebhook {
  configured: boolean
  url: string | null
  enabled: boolean
  /** Shared with the collector to check each delivery's signature. */
  secret: string | null
  /** Whether an Authorization header is stored (its value never comes back). */
  has_authorization: boolean
  /** Entries waiting to reach the collector. */
  pending: number
  last_success_at: string | null
  last_failure_at: string | null
  last_status: number | null
  last_error: string | null
  /** Whether plain http:// collectors are accepted. */
  allow_http: boolean
}

export type SmtpSecurity = 'starttls' | 'tls' | 'none'

/** Platform -> Email: how the instance sends email. Never carries a
 * secret -- `has_password` says whether one is stored. */
export interface EmailSettings {
  /** Whether the instance sends email right now. */
  active: boolean
  /** Set in the server's configuration: read-only here. */
  pinned_by_env: boolean
  /** Plain text, unverified certificates and other ports accepted. */
  allow_insecure: boolean
  configured: boolean
  enabled: boolean
  transport: string | null
  from_address: string | null
  from_name: string | null
  reply_to: string | null
  smtp_host: string | null
  smtp_port: number | null
  smtp_security: SmtpSecurity | null
  smtp_username: string | null
  has_password: boolean
  /** False when the server's key no longer decrypts the stored password. */
  password_readable: boolean
  updated_at: string | null
  pending: number
  failed: number
  last_sent_at: string | null
  last_failed_at: string | null
  last_error: string | null
}

export interface EmailTestResult {
  ok: boolean
  to: string
  error: string | null
}

export type EmailOutboxStatus = 'pending' | 'sent' | 'failed'

/** A queued or sent message, without its content. */
export interface EmailOutboxItem {
  id: string
  created_at: string
  template: string
  locale: string
  to_address: string
  status: EmailOutboxStatus
  attempts: number
  next_attempt_at: string
  last_attempt_at: string | null
  sent_at: string | null
  last_error: string | null
}

export interface EmailOutboxListResponse {
  items: EmailOutboxItem[]
  total: number
  limit: number
  offset: number
  retention_days: number
}

export interface AuditWebhookTest {
  ok: boolean
  status: number | null
  error: string | null
}

export interface InstanceProgramManager {
  user_id: string
  email: string
  full_name: string | null
  /** Removed from the organization while still on its exercises. */
  disabled: boolean
}

export interface InstanceProgramManagerListResponse {
  items: InstanceProgramManager[]
}

export interface DomainOrganizationListResponse {
  items: { id: string; name: string }[]
}

/** An account from the organization's allowed domains with no role in it yet. */
export interface DomainAccount {
  user_id: string
  email: string
  full_name: string
  created_at: string
  last_login_at: string | null
}

export interface DomainAccountListResponse {
  items: DomainAccount[]
}

/** The deployment's legal documents (Platform publishes them). */
export type LegalDocumentKind = 'terms' | 'privacy'

export interface LegalPending {
  kind: LegalDocumentKind
  version: number
  /** The account accepted an earlier version (a substantial change). */
  updated: boolean
}

/** GET /auth/legal/acceptances: what this account accepted. */
export interface LegalAcceptance {
  kind: LegalDocumentKind
  version: number
  accepted_at: string
}

export interface LegalDocumentSummary {
  kind: LegalDocumentKind
  version: number
  published_at: string
  languages: string[]
}

export interface LegalDocumentListResponse {
  /** Empty while the operator has published nothing: signup asks nothing. */
  items: LegalDocumentSummary[]
}

export interface LegalDocumentRead {
  kind: LegalDocumentKind
  version: number
  published_at: string
  language: string
  /** False: shown in another language, the asked one isn't published. */
  requested_language_available: boolean
  content: string
}

export interface LegalVersionSummary {
  version: number
  published_at: string
  published_by: string | null
  requires_acceptance: boolean
  languages: string[]
}

export interface LegalDocumentAdminRead {
  kind: LegalDocumentKind
  draft: { content: Record<string, string>; updated_at: string | null }
  has_unpublished_changes: boolean
  versions: LegalVersionSummary[]
}

export interface LegalDocumentAdminListResponse {
  items: LegalDocumentAdminRead[]
}

export interface LegalVersionRead {
  version: number
  published_at: string
  published_by: string | null
  requires_acceptance: boolean
  content: Record<string, string>
}

export interface LegalTemplateListResponse {
  items: { kind: LegalDocumentKind; content: Record<string, string> }[]
}

/** Platform -> Email -> Periodic reconfirmation. */
export interface EmailReconfirmationRead {
  /** After how many days every account confirms its address again; null:
   * never. */
  days: number | null
  pinned_by_env: boolean
  grace_days: number
}

/** GET/PUT /instance/assistant -- Platform -> AI assistant. */
export interface AssistantSettings {
  enabled: boolean
  pinned_by_env: boolean
  disclaimer_version: string
  /** Active personal access tokens in the whole deployment. */
  active_tokens: number
}

/** One of the account's personal access tokens (never its secret). */
export interface PersonalAccessToken {
  id: string
  name: string
  /** The token's first characters, to tell tokens apart. */
  prefix: string
  created_at: string
  expires_at: string
  last_used_at: string | null
  expired: boolean
}

/** GET /auth/tokens -- Preferences -> AI assistant. */
export interface PersonalAccessTokenListResponse {
  items: PersonalAccessToken[]
  enabled: boolean
  disclaimer_version: string
  max_active: number
  expiry_days_choices: number[]
}

/** POST /auth/tokens: the secret, this once. */
export interface PersonalAccessTokenCreated extends PersonalAccessToken {
  token: string
}

/** One tool call on the MCP endpoint (Platform -> AI assistant -> Recent
 * use): never what was asked or answered. */
export interface AssistantCall {
  id: string
  created_at: string
  user_id: string
  user_name: string
  user_email: string
  token_name: string
  token_prefix: string
  tool: string
  ttx_id: string | null
  ttx_code: string | null
  ttx_name: string | null
  organization_name: string | null
  /** "ok" or the error code the call ended with. */
  outcome: string
  duration_ms: number
}

/** GET /instance/assistant/calls */
export interface AssistantCallListResponse {
  items: AssistantCall[]
  callers: { user_id: string; name: string; email: string }[]
  retention_days: number
}
