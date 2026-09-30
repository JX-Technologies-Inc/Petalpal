export interface ApiConnection {
  apiBaseUrl: string;
  getAccessToken: (forceRefresh?: boolean) => Promise<string | null>;
}
let connection: ApiConnection | null = null;
export function configureApi(next: ApiConnection | null) { connection = next; }
export function apiBaseUrl() {
  if (connection) return connection.apiBaseUrl.replace(/\/$/, '');
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined' && __DEV__) return `${window.location.protocol}//${window.location.hostname}:3000`;
  return '';
}
export async function accessToken(forceRefresh = false) {
  return connection ? connection.getAccessToken(forceRefresh) : null;
}
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
export async function apiRequest<T>(path: string, method = 'GET', body?: object,
  options: { headers?: Record<string, string>; signal?: AbortSignal } = {}): Promise<T> {
  const current = connection;
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken(attempt === 1);
    if (connection !== current) throw new ApiError('Your session changed. Please try again.', 401);
    if (!token) throw new ApiError('Sign in to PetalPal to continue.', 401);
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method, signal: options.signal,
      headers: { ...options.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 401 && attempt === 0) continue;
    const data = await response.json().catch(() => null);
    if (connection !== current) throw new ApiError('Your session changed. Please try again.', 401);
    if (!response.ok) throw new ApiError(data?.error || `Request failed (${response.status}).`, response.status, data?.code);
    if (!data) throw new ApiError('The backend did not return JSON data.', response.status);
    return data as T;
  }
  throw new ApiError('Your session expired. Please sign in again.', 401);
}
