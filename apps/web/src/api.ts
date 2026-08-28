import { useEffect, useState, useSyncExternalStore } from 'react';

export const API =
  (import.meta.env.VITE_API_URL as string | undefined) ?? (import.meta.env.PROD ? '' : 'http://localhost:3001');

// ---- auth token (persisted, reactive) ----
const TKEY = 'lifeos_token';
let token: string | null = (() => {
  try {
    return localStorage.getItem(TKEY);
  } catch {
    return null;
  }
})();
const listeners = new Set<() => void>();

export const getToken = () => token;
function setToken(t: string | null) {
  token = t;
  try {
    if (t) localStorage.setItem(TKEY, t);
    else localStorage.removeItem(TKEY);
  } catch {}
  listeners.forEach((l) => l());
}
export function useAuthToken() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => token
  );
}
export const logout = () => setToken(null);

function headers(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parse<T>(r: Response, path: string): Promise<T> {
  if (r.status === 401) {
    setToken(null); // expired/invalid → bounce to login
    throw new Error('session expired');
  }
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(body?.error ?? `${path}: ${r.status}`);
  }
  return r.json();
}

export async function getJSON<T>(path: string): Promise<T> {
  return parse(await fetch(`${API}${path}`, { headers: headers() }), path);
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: headers(true), body: JSON.stringify(body) });
  return parse(r, path);
}

// ---- auth actions ----
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}
type AuthResponse = { token: string; user: AuthUser };

export async function register(email: string, password: string, name: string): Promise<AuthUser> {
  const r = await postJSON<AuthResponse>('/api/auth/register', { email, password, name });
  setToken(r.token);
  return r.user;
}
export async function login(email: string, password: string): Promise<AuthUser> {
  const r = await postJSON<AuthResponse>('/api/auth/login', { email, password });
  setToken(r.token);
  return r.user;
}

export function usePoll<T>(path: string, ms = 4000): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const tick = () =>
      getJSON<T>(path)
        .then((d) => {
          if (live) {
            setData(d);
            setError(null);
          }
        })
        .catch((e) => live && setError(String(e)));
    tick();
    const id = setInterval(tick, ms);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [path, ms]);
  return { data, error };
}
