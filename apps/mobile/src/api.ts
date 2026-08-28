import { useEffect, useState } from 'react';
import type { ItemType, ItemWithSource, Memo, MemoResult } from 'shared';

export const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
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

export async function uploadMemo(uri: string): Promise<MemoResult> {
  const form = new FormData();
  form.append('audio', { uri, name: 'memo.m4a', type: 'audio/m4a' } as unknown as Blob);
  const r = await fetch(`${API}/api/memos`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`upload failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function confirmMemo(id: string, type: ItemType): Promise<MemoResult> {
  const r = await fetch(`${API}/api/memos/${id}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
  if (!r.ok) throw new Error(`confirm failed: ${r.status}`);
  return r.json();
}

export const getMemo = (id: string) => getJSON<Memo>(`/api/memos/${id}`);

export type { ItemType, ItemWithSource, Memo, MemoResult };
