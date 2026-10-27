/**
 * AUTO-GENERATED from contracts/openapi.json (snapshot) — do not edit by hand.
 * Regenerate:  npm run contracts:sync
 * Generated: 2026-10-27T18:24:40.016Z
 */
/* eslint-disable */
export interface HTTPValidationError {
  detail?: Array<ValidationError>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RegisterRequest {
  email: string;
  full_name: string;
  password: string;
}

export interface TaskOut {
  id: string;
  incident_id: string;
  title: string;
  description?: string | Record<string, unknown>;
  department: string;
  status: string;
  created_at: string;
  updated_at: string;
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

