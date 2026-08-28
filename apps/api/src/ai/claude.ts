import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '../config';

export const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// Force one tool call and return its input - structured output without parsing.
export async function structured<T>(opts: {
  system: string;
  user: string;
  tool: ToolSpec;
  maxTokens?: number;
}): Promise<T> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
    tools: [opts.tool as never],
    tool_choice: { type: 'tool', name: opts.tool.name },
  });
  const block = msg.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') throw new Error('model returned no tool_use block');
  return normalizeToolInput(block.input) as T;
}

// The model occasionally stringifies structured output instead of returning it as
// JSON - either the whole payload as a string, or a field double-encoded as
// {commitments: "{\"commitments\": [...]}"}. Recover the intended shape.
export function normalizeToolInput(input: unknown): unknown {
  if (typeof input === 'string') {
    try {
      return normalizeToolInput(JSON.parse(input));
    } catch {
      return input;
    }
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === 'string') {
        const s = v.trim();
        if (s.startsWith('{') || s.startsWith('[')) {
          try {
            const parsed = JSON.parse(s);
            // unwrap {k: "{k: [...]}"} -> the inner value; else use the parsed value
            obj[k] = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && k in parsed
              ? (parsed as Record<string, unknown>)[k]
              : parsed;
          } catch {
            /* leave the string as-is */
          }
        }
      }
    }
  }
  return input;
}
