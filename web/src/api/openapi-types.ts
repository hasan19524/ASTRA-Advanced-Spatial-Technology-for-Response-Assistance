/**
 * AUTO-GENERATED from http://localhost:8000/openapi.json — do not edit by hand.
 * Regenerate:  npm run contracts:sync
 * Generated: 2026-11-02T04:22:31.074Z
 */
/* eslint-disable */
export interface AlertCreateIn {
  event: string;
  title: string;
  body: string;
  severity?: string;
  urgency?: string;
  certainty?: string;
  area?: string;
  expires_at?: string | Record<string, unknown>;
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
  published_by?: string | Record<string, unknown>;
  expires_at?: string | Record<string, unknown>;
  created_at: string;
}

export interface AlertPrefIn {
  region?: string | Record<string, unknown>;
  category?: string | Record<string, unknown>;
  enabled?: boolean;
}

export interface AlertPrefOut {
  id: string;
  user_id: string;
  region?: string | Record<string, unknown>;
  category?: string | Record<string, unknown>;
  enabled: boolean;
  created_at: string;
}

export interface AssessmentOut {
  id: string;
  backend: string;
  outcome: string;
  confidence?: number | Record<string, unknown>;
  reason?: string | Record<string, unknown>;
  created_at: string;
}

export interface Body_speech_to_text_api_v1_voice_stt_post {
  audio: string;
  language_code?: string;
}

export interface Body_submit_report_api_v1_incidents_post {
  title: string;
  description: string;
  category: string;
  region?: string | Record<string, unknown>;
  latitude?: number | Record<string, unknown>;
  longitude?: number | Record<string, unknown>;
  location_text?: string | Record<string, unknown>;
  photo?: string | Record<string, unknown>;
}

export interface CloseIn {
  note?: string | Record<string, unknown>;
}

export interface ConvIn {
  title?: string | Record<string, unknown>;
  language?: string;
}

export interface DemoLoginRequest {
  email: string;
}

export interface HTTPValidationError {
  detail?: Array<ValidationError>;
}

export interface IncidentCreatedOut {
  id: string;
  title: string;
  description?: string | Record<string, unknown>;
  category: string;
  region?: string | Record<string, unknown>;
  latitude: number;
  longitude: number;
  location_text?: string | Record<string, unknown>;
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
  description?: string | Record<string, unknown>;
  category: string;
  region?: string | Record<string, unknown>;
  latitude: number;
  longitude: number;
  location_text?: string | Record<string, unknown>;
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
  description?: string | Record<string, unknown>;
  category: string;
  region?: string | Record<string, unknown>;
  latitude: number;
  longitude: number;
  location_text?: string | Record<string, unknown>;
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
  reason?: string | Record<string, unknown>;
  my_vote?: string | Record<string, unknown>;
  genuine?: number;
  fake?: number;
  percent_genuine?: number;
}

export interface PollVoteIn {
  vote: string;
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
  media_path?: string | Record<string, unknown>;
  created_at: string;
}

export interface SimRunIn {
  scenario: string;
  mode?: string;
  params?: Record<string, unknown>;
}

export interface StatsOut {
  total_incidents?: number;
  open_incidents?: number;
  closed_incidents?: number;
  verified_incidents?: number;
  rejected_incidents?: number;
  public_unverified_incidents?: number;
  hidden_incidents?: number;
  restricted_incidents?: number;
  active_tasks?: number;
  done_tasks?: number;
  poll_participation_rate?: number;
  active_alerts?: number;
}

export interface TaskCreateIn {
  title: string;
  description?: string | Record<string, unknown>;
  department?: string | Record<string, unknown>;
  assignee_ids?: Array<string>;
}

export interface TaskOut {
  id: string;
  incident_id: string;
  title: string;
  description?: string | Record<string, unknown>;
  department: string;
  status: string;
  assignee_ids?: Array<string>;
  assignee_names?: Array<string>;
  created_at: string;
  updated_at: string;
}

export interface TaskPatchIn {
  title?: string | Record<string, unknown>;
  description?: string | Record<string, unknown>;
  department?: string | Record<string, unknown>;
  status?: string | Record<string, unknown>;
}

export interface TaskUpdateIn {
  status?: string | Record<string, unknown>;
  note?: string | Record<string, unknown>;
}

export interface TaskUpdateOut {
  id: string;
  task_id: string;
  author_id: string;
  status: string;
  note?: string | Record<string, unknown>;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  user: UserOut;
}

export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department?: string | Record<string, unknown>;
  permissions: Array<string>;
}

export interface ValidationError {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export interface VerificationDecisionOut {
  action: string;
  reason?: string | Record<string, unknown>;
  officer_id: string;
  created_at: string;
}

export interface VerificationEventOut {
  id: string;
  action: string;
  reason?: string | Record<string, unknown>;
  officer?: string | Record<string, unknown>;
  created_at: string;
}

export interface VerifyIn {
  verdict: string;
  reason?: string | Record<string, unknown>;
}

