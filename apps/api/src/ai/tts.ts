import { OPENAI_API_KEY } from '../config';

// Server-side text-to-speech so the mobile app can "talk back" without adding a
// native TTS module (keeps the client rebuild-free; playback reuses expo-audio).
export async function synthesizeSpeech(text: string, voice = 'nova'): Promise<Buffer> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts-1',
      voice, // nova = warm, natural; alloy/shimmer/echo also available
      input: text.slice(0, 4000),
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error(`tts failed: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}
