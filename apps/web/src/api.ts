import { useEffect, useState } from 'react';

export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

async function parse<T>(r: Response, path: string): Promise<T> {
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(body?.error ?? `${path}: ${r.status}`);
  }
  return r.json();
}

export async function getJSON<T>(path: string): Promise<T> {
  return parse(await fetch(`${API}${path}`), path);
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parse(r, path);
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
