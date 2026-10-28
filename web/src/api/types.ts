/**
 * ASTRA API types — generated shape for auth (from api/app/schemas/auth.py).
 *
 * Task 2.6: when the backend is running, regenerate the full contract with:
 *   npm run contracts:sync   (fetches http://localhost:8000/openapi.json)
 * Never hand-write duplicate interfaces for endpoints that exist there.
 */

export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string | null;
  permissions: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: UserOut;
}

export interface RegisterRequest {
  email: string;
  full_name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ApiError {
  detail: string;
  code?: string;
}

/** List envelope convention (contracts/requests.md) */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

/* ---------- Incident contract (api/app/schemas/incident.py) ---------- */

export interface ReportOut {
  id: string;
  content: string;
  source: string; // TEXT | PHOTO | VOICE
  media_path: string | null;
  created_at: string;
}

export interface AssessmentOut {
  id: string;
  backend: string; // RULE | LLM | EVON
  outcome: string; // DEFINITELY_FALSE | MAYBE_TRUE
  confidence: number | null;
  reason: string | null;
  created_at: string;
}

export interface IncidentOut {
  id: string;
  title: string;
  description: string | null;
  category: string;
  region: string | null;
  latitude: number;
  longitude: number;
  location_text: string | null;
  sensitivity: string;
  assessment_status: string;
  visibility: string;
  verification: string;
  response_phase: string;
  lifecycle: string;
  report_count: number;
  created_at: string;
  updated_at: string;
}

export interface IncidentCreatedOut extends IncidentOut {
  grouped: boolean;
}

export interface IncidentDetailOut extends IncidentOut {
  reports: ReportOut[];
  assessments: AssessmentOut[];
}

export interface IncidentPageOut {
  items: IncidentOut[];
  total: number;
  limit: number;
  offset: number;
}
