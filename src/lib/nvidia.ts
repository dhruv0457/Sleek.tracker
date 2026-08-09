/**
 * NVIDIA NIM (OpenAI-compatible) helper with automatic model fallback.
 *
 * Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 * Auth header: Authorization: Bearer <NVIDIA_API_KEY>
 *
 * All models are free-tier on NVIDIA NIM:
 *   meta/llama-3.3-70b-instruct           – best reasoning, chat
 *   nvidia/llama-3.1-nemotron-70b-instruct – high-quality instruction following
 *   mistralai/mixtral-8x7b-instruct-v0.1   – fast multi-purpose (default chat)
 *   nvidia/cosmos-reason1-7b              – vision + text (default vision)
 *   microsoft/phi-3-vision-128k-instruct   – vision fallback
 *
 * Fallback chain: model1 → model2 → model3 → fail (never silent error)
 * Rate limit: 100 requests/minute per account (NVIDIA free tier).
 */

const NIM_BASE = "https://integrate.api.nvidia.com/v1";

/** Chat model fallback chain — tried in order */
export const CHAT_MODEL_CHAIN: string[] = [
  process.env.NVIDIA_CHATBOT_MODEL || process.env.NVIDIA_INSIGHTS_MODEL || "meta/llama-3.3-70b-instruct",
  "nvidia/llama-3.3-nemotron-super-49b-v1",
  "mistralai/mixtral-8x22b-instruct",
  "qwen/qwen3-5-122b-a10b",
];

/** Vision model fallback chain — tried in order */
export const VISION_MODEL_CHAIN: string[] = [
  process.env.NVIDIA_VISION_MODEL || "nvidia/nemotron-nano-12b-v2-vl",
  "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
  "meta/llama-3.2-11b-vision-instruct",
  "microsoft/phi-4-multimodal-instruct",
  "meta/llama-4-maverick-17b-128e-instruct",
  "meta/llama-3.2-90b-vision-instruct",
  "nvidia/vila",
];

export const NIM_DEFAULT_CHAT = CHAT_MODEL_CHAIN[0];
export const NIM_DEFAULT_VISION = VISION_MODEL_CHAIN[0];

async function callOnce(
  model: string,
  bodyPayload: string,
  apiKey: string
): Promise<{ text: string; ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${NIM_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: bodyPayload
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { text: "", ok: false, error: `${model} → ${res.status}: ${errBody.slice(0, 120)}` };
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim() ?? "";
    return { text, ok: true };
  } catch (e: any) {
    return { text: "", ok: false, error: `${model} → network: ${String(e?.message ?? e).slice(0, 120)}` };
  }
}

async function callWithFallback(
  models: string[],
  buildBody: (model: string) => string,
  apiKey: string
): Promise<{ text: string; ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  for (const model of models) {
    const body = buildBody(model);
    const r = await callOnce(model, body, apiKey);
    if (r.ok) return { text: r.text, ok: true, errors };
    errors.push(r.error || "unknown");
  }
  return { text: "", ok: false, errors };
}

type TextMsg = { role: "user" | "system" | "model"; content: string };

/** Resilient chat completion — tries models in CHAT_MODEL_CHAIN until one succeeds. */
export async function nvidiaChat(
  messages: TextMsg[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<{ text: string; ok: boolean; errors: string[] }> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return { text: "", ok: false, errors: ["NVIDIA_API_KEY not set in env"] };

  return callWithFallback(
    CHAT_MODEL_CHAIN,
    (model) => JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role === "model" ? "assistant" : m.role, content: m.content })),
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.maxTokens ?? 600
    }),
    apiKey
  );
}

type VisionContent = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type VisionMsg = { role: "user" | "system" | "model"; content: VisionContent[] };

/** Resilient vision completion — tries models in VISION_MODEL_CHAIN until one succeeds. */
export async function nvidiaVisionChat(
  messages: VisionMsg[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<{ text: string; ok: boolean; errors: string[] }> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return { text: "", ok: false, errors: ["NVIDIA_API_KEY not set in env"] };

  return callWithFallback(
    VISION_MODEL_CHAIN,
    (model) => JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role === "model" ? "assistant" : m.role,
        content: m.content
      })),
      temperature: opts?.temperature ?? 0.1,
      max_tokens: opts?.maxTokens ?? 200
    }),
    apiKey
  );
}