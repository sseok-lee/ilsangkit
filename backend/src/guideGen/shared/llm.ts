import OpenAI from 'openai';
import {
  MODEL_DEFAULT,
  MODEL_EXTRACT,
  MODEL_CHECK,
} from './config.js';

export type LLMStage = 'extract' | 'plan' | 'draft' | 'check';

export interface CallLLMOpts {
  stage: LLMStage;
  systemPrompt: string;
  userPrompt: string;
  responseFormat: 'json' | 'text';
  temperature?: number;
}

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

function modelFor(stage: LLMStage): string {
  switch (stage) {
    case 'extract': return MODEL_EXTRACT;
    case 'check':   return MODEL_CHECK;
    case 'plan':
    case 'draft':
    default:        return MODEL_DEFAULT;
  }
}

async function callOnce(opts: CallLLMOpts): Promise<string> {
  const res = await client().chat.completions.create({
    model: modelFor(opts.stage),
    temperature: opts.temperature ?? 0.3,
    response_format: opts.responseFormat === 'json'
      ? { type: 'json_object' }
      : { type: 'text' },
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user',   content: opts.userPrompt },
    ],
  });
  const content = res.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`[callLLM] empty response from ${opts.stage}`);
  }
  return content;
}

export async function callLLM(opts: CallLLMOpts): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await callOnce(opts);
    } catch (err) {
      lastErr = err;
      if (attempt === 3) break;
      const delay = 500 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('callLLM failed');
}
