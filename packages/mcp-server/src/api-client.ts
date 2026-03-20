import {getApiUrl, getWallet} from './config.js';
import {getToken} from './auth.js';

type ApiSuccess<T> = {code: 0; message: string; data: T};
type ApiError = {code: number; message: string};

async function ensureToken(): Promise<string> {
  const wallet = await getWallet();
  return getToken(wallet);
}

async function fetchWithAuth<T>(path: string, options: RequestInit & {retryOn401?: boolean} = {}): Promise<T> {
  const {retryOn401 = true, ...fetchOptions} = options;
  const apiUrl = getApiUrl();
  const url = `${apiUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const token = await ensureToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(fetchOptions.headers as Record<string, string>),
  };

  let res = await fetch(url, {...fetchOptions, headers});

  if (res.status === 401 && retryOn401) {
    const {clearToken} = await import('./auth.js');
    clearToken();
    const newToken = await ensureToken();
    headers.Authorization = `Bearer ${newToken}`;
    res = await fetch(url, {...fetchOptions, headers});
  }

  const body = (await res.json()) as ApiSuccess<T> | ApiError;

  if (!res.ok) {
    const err = body as ApiError;
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }

  const success = body as ApiSuccess<T>;
  return success.data as T;
}

async function fetchPublic<T>(path: string, options: RequestInit = {}): Promise<T> {
  const apiUrl = getApiUrl();
  const url = `${apiUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    headers: {'Content-Type': 'application/json', ...(options.headers as Record<string, string>)},
  });

  const body = (await res.json()) as ApiSuccess<T> | ApiError;

  if (!res.ok) {
    const err = body as ApiError;
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }

  const success = body as ApiSuccess<T>;
  return success.data as T;
}

export const apiClient = {
  async get<T>(path: string, auth = false): Promise<T> {
    return auth ? fetchWithAuth<T>(path, {method: 'GET'}) : fetchPublic<T>(path, {method: 'GET'});
  },

  async post<T>(path: string, body: unknown, auth = true): Promise<T> {
    return auth
      ? fetchWithAuth<T>(path, {method: 'POST', body: JSON.stringify(body)})
      : fetchPublic<T>(path, {method: 'POST', body: JSON.stringify(body)});
  },
};
