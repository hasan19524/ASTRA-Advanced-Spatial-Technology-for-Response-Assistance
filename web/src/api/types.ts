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
