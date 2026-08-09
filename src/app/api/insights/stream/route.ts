import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUserInfo, canUseAIInsights } from "@/lib/tier";
import { rateLimit, RL_AI } from "@/lib/rateLimit";
import { checkCsrf } from "@/lib/csrf";
import { CHAT_MODEL_CHAIN } from "@/lib/nvidia";

const NIM_BASE = "https://integrate.api.nvidia.com/v1";

/** UI model preset → NIM model priority chains (Claude/Gemini/GPT-style flavors). */
const MODEL_CHAINS: Record<string, string[]> = {
  "nim-balanced": CHAT_MODEL_CHAIN,
  "nim-reason": [
    process.env.NVIDIA_REASONING_MODEL || "meta/llama-3.3-70b-instruct",
    "nvidia/llama-3.3-nemotron-super-49b-v1",
    "meta/llm-3.1-405b-instruct",
  ],
  "nim-creative": [
    process.env.NVIDIA_CREATIVE_MODEL || "mistralai/mixtral-8x22b-instruct",
    "qwen/qwen3-5-122b-a10b",
    "meta/llama-3.3-70b-instruct",
  ],
  "nim-fast": [
    process.env.NVIDIA_FAST_MODEL || "meta/llama-3.1-8b-instruct",
    "mistralai/mixtral-8x7b-instruct-v0.1",
  ],
};

/** Persona presets — modify the system-prompt tone & focus. */
const PERSONA_PROMPTS: Record<string, string> = {
  data:         "Be evidence-driven. Cite specific numbers from the user data. Be objective and surgical.",
  motivational: "Be warm, encouraging, and uplifting. Acknowledge effort. Frame setbacks as feedback.",
  toughlove:    "Be direct, no-excuses, and accountability-focused. Tell the user what they need to hear, not what they want to hear.",
  scientific:   "Reference behavioral-science concepts (habit loops, dopamine, compounding). Be precise but accessible.",
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  concise:     "Keep your answer under 4 sentences.",
  detailed:    "Give a thorough multi-paragraph answer with specifics and suggestions.",
  motivational:"End with one actionable, motivational next step.",
};

function userContextJson(habits: any[], aiV: any[]): string {
  const countsByDay: Record<string, { done: number; total: number; skipped: number; missed: number }> = {};
  for (const h of habits) {
    if (!Array.isArray(h.checkins)) continue;
    for (const c of h.checkins as any[]) {
      if (!countsByDay[c.date]) countsByDay[c.date] = { done: 0, total: 0, skipped: 0, missed: 0 };
      countsByDay[c.date].total++;
      if (c.completed) countsByDay[c.date].done++;
      if (c.status === "skipped") countsByDay[c.date].skipped++;
      if (c.status === "missed") countsByDay[c.date].missed++;
    }
  }
  const dates = Object.keys(countsByDay).sort();
  const totals = {
    habits: habits.length,
    totalDone: habits.flatMap((h: any) => (h.checkins as any[] || [])).filter((c: any) => c.completed).length,
    aiVerificationsPassed: aiV.filter((v: any) => v.passed).length,
    recent14Days: dates.slice(-14).map((d) => ({
      date: d,
      weekday: new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }),
      done: countsByDay[d].done,
      total: countsByDay[d].total,
      skipped: countsByDay[d].skipped,
      missed: countsByDay[d].missed,
    })),
  };
  return JSON.stringify(totals);
}

export async function POST(req: NextRequest) {
  if (!checkCsrf(req)) {
    return new Response(JSON.stringify({ error: "Origin mismatch" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const session = await getSession();
  if (!session.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const rl = rateLimit(req, { ...RL_AI, keyPrefix: "ai-stream" });
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many requests. Wait a moment." }), { status: 429, headers: { "Content-Type": "application/json" } });
  }

  const user = await getUserInfo(session.userId);
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  if (!canUseAIInsights(user)) {
    return new Response(JSON.stringify({ error: "AI Insights is a premium feature. Upgrade to Ultra Pro ($4/mo) or use it during your trial." }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayMsgs = await prisma.aiMessage.count({
    where: { userId: session.userId, role: "user", createdAt: { gte: new Date(today) } },
  });
  const tier = user.tier;
  const maxMsgs = tier === "ultra_pro" ? Infinity : tier === "basic_pro" ? 10 : 4;
  if (todayMsgs >= maxMsgs) {
    return new Response(JSON.stringify({ error: `Daily limit reached (${maxMsgs}). Upgrade for more.` }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  if (!process.env.NVIDIA_API_KEY) {
    return new Response(JSON.stringify({ error: "NVIDIA_API_KEY not configured" }), { status: 503, headers: { "Content-Type": "application/json" } });
  }

  const body = await req.json().catch(() => ({}));
  const userMsg = String(body.message || "").trim().slice(0, 4000);
  if (!userMsg) {
    return new Response(JSON.stringify({ error: "Empty message" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const [habits, aiV, history] = await Promise.all([
    prisma.habit.findMany({ where: { userId: session.userId }, include: { checkins: true } }),
    prisma.aIVerification.findMany({ where: { userId: session.userId }, take: 50 }),
    prisma.aiMessage.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "asc" }, take: 10 }),
  ]);

  const contextJson = userContextJson(habits as any, aiV);

  const personaPrompt = PERSONA_PROMPTS[String(body.persona || "data")] || PERSONA_PROMPTS.data;
  const toneInstr = TONE_INSTRUCTIONS[String(body.tone || "concise")] || TONE_INSTRUCTIONS.concise;

  const systemPrompt = `You are an AI Habit Coach for a productivity app called "sleek". ${personaPrompt} ${toneInstr} Analyze the user's data and answer their question directly with evidence from the data.

USER DATA:
${contextJson}`;

  const chatMessages: any[] = [
    { role: "system", content: systemPrompt },
  ];
  for (const m of history.slice(-6)) {
    chatMessages.push({ role: m.role === "model" ? "assistant" : m.role, content: m.content });
  }
  chatMessages.push({ role: "user", content: userMsg });

  const apiKey = process.env.NVIDIA_API_KEY!;
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = "";
      let streamedAny = false;

      try {
        const modelChain = MODEL_CHAINS[String(body.model) as string] || MODEL_CHAINS["nim-balanced"];
        for (const model of modelChain) {
          try {
            const res = await fetch(`${NIM_BASE}/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model,
                messages: chatMessages,
                temperature: 0.3,
                max_tokens: 800,
                stream: true,
              }),
            });

            if (!res.ok) {
              const errBody = await res.text().catch(() => "");
              console.error(`[insights/stream] ${model} → ${res.status}: ${errBody.slice(0, 200)}`);
              continue;
            }

            const reader = res.body?.getReader();
            if (!reader) continue;

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                streamedAny = true;
                break;
              }
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                const jsonStr = trimmed.slice(6);
                if (jsonStr === "[DONE]") { streamedAny = true; break; }
                try {
                  const parsed = JSON.parse(jsonStr);
                  const token = parsed?.choices?.[0]?.delta?.content;
                  if (token) {
                    fullResponse += token;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
                    streamedAny = true;
                  }
                } catch { /* skip malformed SSE line */ }
              }
            }

            if (streamedAny) break;
          } catch (e: any) {
            console.error(`[insights/stream] ${model} exception:`, e?.message || e);
          }
        }

        if (!streamedAny) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "All AI models failed. Try again in a moment." })}\n\n`));
        }

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (fatalError: any) {
        console.error("[insights/stream] fatal:", fatalError);
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Streaming failed unexpectedly." })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch { /* controller already closed */ }
      }

      // Persist after streaming completes — only if we got a real response
      const uid = session.userId!;
      if (fullResponse && fullResponse.length > 10 && !fullResponse.startsWith("All AI models failed")) {
        try {
          await Promise.all([
            prisma.aiMessage.create({ data: { userId: uid, role: "user", content: userMsg } }),
            prisma.aiMessage.create({ data: { userId: uid, role: "model", content: fullResponse } }),
          ]);
        } catch (e) {
          console.error("[insights/stream] persist failed:", e);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}