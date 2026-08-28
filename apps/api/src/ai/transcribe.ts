import fs from 'node:fs/promises';
import { OPENAI_API_KEY } from '../config';

// One function boundary so a Deepgram swap (TASKS.md R2) touches only this file.
export async function transcribe(filePath: string, filename = 'memo.m4a'): Promise<{ text: string; ms: number }> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const start = Date.now();
  const form = new FormData();
  form.append('file', new Blob([await fs.readFile(filePath)]), filename);
  form.append('model', 'whisper-1');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`transcription failed: ${res.status} ${await res.text()}`);
  const { text } = (await res.json()) as { text: string };
  const ms = Date.now() - start;
  console.log(`[transcribe] ${filename} ${ms}ms "${text.slice(0, 80)}"`);
  return { text, ms };
}
