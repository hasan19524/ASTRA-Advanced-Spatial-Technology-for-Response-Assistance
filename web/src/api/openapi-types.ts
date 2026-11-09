/**
 * AUTO-GENERATED from http://localhost:8000/openapi.json — do not edit by hand.
 * Regenerate:  npm run contracts:sync
 * Generated: 2026-11-09T21:28:49.801Z
 */
export interface AlertCreateIn {
  event: string;
  title: string;
  body: string;
  severity?: string;
  urgency?: string;
  certainty?: string;
  area?: string;
  expires_at?: string | null;
}

export interface AlertOut {
  id: string;
  event: string;
  title: string;
  body: string;
  severity: string;
  urgency: string;
  certainty: string;
  area: string;
  published_by?: string | null;
  expires_at?: string | null;
  expired_at?: string | null;
  created_at: string;
}

export interface AlertPrefIn {
  region?: string | null;
  category?: string | null;
  enabled?: boolean;
}

export interface AlertPrefOut {
  id: string;
  user_id: string;
  region?: string | null;
  category?: string | null;
  enabled: boolean;
  created_at: string;
}

export interface AssessmentOut {
  id: string;
  backend: string;
  outcome: string;
  confidence?: number | null;
  reason?: string | null;
  created_at: string;
}

export interface Body_analyze_evidence_api_v1_evidence_analyze_post {
  image: string;
  incident_description: string;
  category: string;
}

export interface Body_speech_to_text_api_v1_voice_stt_post {
  audio: string;
  language_code?: string;
}

export interface Body_submit_report_api_v1_incidents_post {
  title: string;
  description: string;
  category: string;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_text?: string | null;
  source?: string | null;
  photo?: string | null;
}

export interface CloseIn {
  note?: string | null;
}

export interface ConvIn {
  title?: string | null;
  language?: string;
}

export interface DemoLoginRequest {
  email: string;
}

export interface DepartmentOut {
  name: string;
  head_name?: string | null;
  head_email?: string | null;
  personnel_count?: number;
  open_tasks?: number;
  total_tasks?: number;
}

export interface EvidenceAnalysis {
  image_quality: string;
  image_relevance: string;
  detected_objects?: Array<string>;
  incident_consistency: string;
  authenticity_assessment: string;
  confidence: number;
  explanation: string;
  human_review_required: boolean;
}

export interface HTTPValidationError {
  detail?: Array<ValidationError>;
}

export interface IncidentCreatedOut {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  region?: string | null;
  latitude: number;
  longitude: number;
  location_text?: string | null;
  sensitivity: string;
  assessment_status: string;
  visibility: string;
  verification: string;
  response_phase: string;
  lifecycle: string;
  report_count?: number;
  created_at: string;
  updated_at: string;
  grouped?: boolean;
}

export interface IncidentDetailOut {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  region?: string | null;
  latitude: number;
  longitude: number;
  location_text?: string | null;
  sensitivity: string;
  assessment_status: string;
  visibility: string;
  verification: string;
  response_phase: string;
  lifecycle: string;
  report_count?: number;
  created_at: string;
  updated_at: string;
  reports?: Array<ReportOut>;
  assessments?: Array<AssessmentOut>;
  verification_events?: Array<VerificationEventOut>;
}

export interface IncidentOut {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  region?: string | null;
  latitude: number;
  longitude: number;
  location_text?: string | null;
  sensitivity: string;
  assessment_status: string;
  visibility: string;
  verification: string;
  response_phase: string;
  lifecycle: string;
  report_count?: number;
  created_at: string;
  updated_at: string;
}

export interface IncidentPageOut {
  items: Array<IncidentOut>;
  total: number;
  limit: number;
  offset: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MsgIn {
  text: string;
  language?: string;
}

export interface PhaseIn {
  phase: string;
}

export interface PollOut {
  eligible: boolean;
  reason?: string | null;
  my_vote?: string | null;
  genuine?: number;
  fake?: number;
  percent_genuine?: number;
}

export interface PollVoteIn {
  vote: string;
}

export interface RecentClosure {
  id: string;
  title: string;
  category: string;
  region?: string | null;
  closed_at: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RegisterRequest {
  email: string;
  full_name: string;
  password: string;
}

export interface ReopenIn {
  reason: string;
}

export interface ReportOut {
  id: string;
  content: string;
  source: string;
  media_path?: string | null;
  media_url?: string | null;
  created_at: string;
}

export interface SimRunIn {
  scenario: string;
  mode?: string;
  params?: Record<string, unknown>;
}

export interface StatsOut {
  total_incidents: number;
  open_incidents: number;
  closed_incidents: number;
  verified_incidents: number;
  rejected_incidents: number;
  public_unverified_incidents: number;
  hidden_incidents: number;
  restricted_incidents: number;
  active_tasks: number;
  done_tasks: number;
  poll_participation_rate: number;
  active_alerts: number;
  by_category: Record<string, number>;
  incidents_7d: number;
  incidents_previous_7d: number;
  avg_verify_minutes: number | null;
  poll_officer_agreement: number | null;
  recent_closures: Array<RecentClosure>;
}

export interface TaskCreateIn {
  title: string;
  description?: string | null;
  department?: string | null;
  assignee_ids?: Array<string>;
}

export interface TaskOut {
  id: string;
  incident_id: string;
  title: string;
  description?: string | null;
  department: string;
  status: string;
  assignee_ids?: Array<string>;
  assignee_names?: Array<string>;
  created_at: string;
  updated_at: string;
}

export interface TaskPatchIn {
  title?: string | null;
  description?: string | null;
  department?: string | null;
  status?: string | null;
}

export interface TaskUpdateIn {
  status?: string | null;
  note?: string | null;
}

export interface TaskUpdateOut {
  id: string;
  task_id: string;
  author_id: string;
  status: string;
  note?: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  user: UserOut;
}

export interface TtsIn {
  text: string;
  language_code?: string;
  voice?: string;
}

export interface UserDirectoryOut {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department?: string | null;
  permissions?: Array<string>;
}

export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department?: string | null;
  permissions: Array<string>;
}

export interface ValidationError {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export interface VerificationDecisionOut {
  action: string;
  reason?: string | null;
  officer_id: string;
  created_at: string;
}

export interface VerificationEventOut {
  id: string;
  action: string;
  reason?: string | null;
  officer?: string | null;
  created_at: string;
}

export interface VerifyIn {
  verdict: string;
  reason?: string | null;
}

