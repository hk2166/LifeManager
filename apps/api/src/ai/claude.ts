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
  return block.input as T;
}
