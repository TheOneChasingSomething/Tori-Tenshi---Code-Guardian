/**
 * Minimal OpenAI-compatible chat client. Ollama, LM Studio and vLLM all expose
 * a `/v1/chat/completions` endpoint with this shape, so a single client covers
 * both the local-model and remote-agent connectors.
 *
 * Uses the global `fetch` (Node 18+, available in the VS Code extension host)
 * and an AbortController-based timeout.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  endpoint: string; // base URL, e.g. http://127.0.0.1:11434
  model: string;
  apiKey?: string; // bearer token (remote agents)
  timeoutMs?: number;
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

export async function chatCompletion(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60000);
  try {
    const url = opts.endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.apiKey) {
      headers['Authorization'] = `Bearer ${opts.apiKey}`;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: opts.model, messages, stream: false }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as ChatResponse;
    return data.choices?.[0]?.message?.content ?? '(empty response)';
  } finally {
    clearTimeout(timer);
  }
}
