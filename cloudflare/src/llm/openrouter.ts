/**
 * OpenRouter LLM client — unified interface for chat completions.
 * Default model: claude-sonnet-4, configurable via LUNAAI_LLM_MODEL env var.
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface FunctionDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMResponse {
  content: string | null;
  functionCall?: { name: string; arguments: string };
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export async function chatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options?: {
    model?: string;
    functions?: FunctionDef[];
    temperature?: number;
    maxTokens?: number;
  },
): Promise<LLMResponse> {
  const model = options?.model ?? "anthropic/claude-sonnet-4";
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options?.temperature ?? 0.1,
    max_tokens: options?.maxTokens ?? 1024,
  };

  if (options?.functions?.length) {
    body.tools = options.functions.map((fn) => ({
      type: "function",
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      },
    }));
    body.tool_choice = { type: "function", function: { name: options.functions[0].name } };
  }

  const resp = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://YOUR_APP_WORKER.YOUR_CF_SUBDOMAIN.workers.dev",
      "X-Title": "LunaAI",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`OpenRouter ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await resp.json()) as {
    choices: Array<{
      message: {
        content: string | null;
        tool_calls?: Array<{ function: { name: string; arguments: string } }>;
      };
    }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const choice = data.choices?.[0]?.message;
  if (!choice) throw new Error("No response from OpenRouter");

  return {
    content: choice.content,
    functionCall: choice.tool_calls?.[0]?.function,
    usage: data.usage,
  };
}
