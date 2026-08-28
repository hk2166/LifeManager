import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths, UploadType } from 'expo-file-system';
import type { ItemType, ItemWithSource, Memo, MemoResult, NudgeDraft } from 'shared';

export const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

// ---- auth token (persisted in AsyncStorage, reactive) ----
const TKEY = 'lifeos_token';
let token: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export async function bootstrapAuth() {
  try {
    token = await AsyncStorage.getItem(TKEY);
  } catch {}
  loaded = true;
  notify();
}
async function setToken(t: string | null) {
  token = t;
  try {
    if (t) await AsyncStorage.setItem(TKEY, t);
    else await AsyncStorage.removeItem(TKEY);
  } catch {}
  notify();
}
export const getToken = () => token;
export function useAuth() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { token, loaded };
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
    await setToken(null);
    throw new Error('session expired');
  }
  if (!r.ok) {
    const body = await r.json().catch(() => null as { error?: string } | null);
    throw new Error(body?.error ?? `${path}: ${r.status}`);
  }
  return r.json();
}

export async function getJSON<T>(path: string): Promise<T> {
  return parse(await fetch(`${API}${path}`, { headers: headers() }), path);
}
export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  return parse(await fetch(`${API}${path}`, { method: 'POST', headers: headers(true), body: JSON.stringify(body) }), path);
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}
type AuthResponse = { token: string; user: AuthUser };
export async function login(email: string, password: string): Promise<AuthUser> {
  const r = await postJSON<AuthResponse>('/api/auth/login', { email, password });
  await setToken(r.token);
  return r.user;
}
export async function register(email: string, password: string, name: string): Promise<AuthUser> {
  const r = await postJSON<AuthResponse>('/api/auth/register', { email, password, name });
  await setToken(r.token);
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

export async function uploadMemo(uri: string): Promise<MemoResult> {
  // SDK 57's WinterCG fetch rejects RN's {uri} FormData part; File.upload does native multipart
  const res = await new File(uri).upload(`${API}/api/memos`, {
    httpMethod: 'POST',
    uploadType: UploadType.MULTIPART,
    fieldName: 'audio',
    mimeType: 'audio/m4a',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.status === 401) {
    await setToken(null);
    throw new Error('session expired');
  }
  if (res.status < 200 || res.status >= 300) throw new Error(`upload failed: ${res.status} ${res.body}`);
  return JSON.parse(res.body) as MemoResult;
}

export async function confirmMemo(id: string, type: ItemType): Promise<MemoResult> {
  return postJSON<MemoResult>(`/api/memos/${id}/confirm`, { type });
}

export const getMemo = (id: string) => getJSON<Memo>(`/api/memos/${id}`);

// Feature: smart nudge draft for a "waiting on" item.
export const getNudge = (itemId: string) => postJSON<NudgeDraft>(`/api/items/${itemId}/nudge`, {});

// ---- talk back: server TTS -> local file -> playback (no native TTS module) ----
let ttsPlayer: ReturnType<typeof createAudioPlayer> | null = null;
let ttsSeq = 0;

export function stopSpeaking() {
  try {
    ttsPlayer?.pause();
    ttsPlayer?.remove();
  } catch {}
  ttsPlayer = null;
}

export async function speak(text: string): Promise<void> {
  const t = text.trim();
  if (!t) return;
  // best-effort: talking back must never block or crash the capture flow
  try {
    const res = await fetch(`${API}/api/tts`, { method: 'POST', headers: headers(true), body: JSON.stringify({ text: t }) });
    if (!res.ok) return;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const file = new File(Paths.cache, `tts-${++ttsSeq}.mp3`);
    try {
      file.create({ overwrite: true });
    } catch {}
    file.write(bytes);
    // recording mode leaves output on the quiet earpiece — route back to the speaker
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    stopSpeaking();
    const p = createAudioPlayer(file.uri);
    ttsPlayer = p;
    p.play();
    const sub = p.addListener?.('playbackStatusUpdate', (st: { didJustFinish?: boolean }) => {
      if (st?.didJustFinish) {
        try {
          p.remove();
        } catch {}
        try {
          sub?.remove?.();
        } catch {}
        if (ttsPlayer === p) ttsPlayer = null;
      }
    });
  } catch {
    /* swallow — TTS is a nicety, not a requirement */
  }
}

export type { ItemType, ItemWithSource, Memo, MemoResult, NudgeDraft };
