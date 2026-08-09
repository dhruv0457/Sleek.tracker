import { nvidiaVisionChat } from "@/lib/nvidia";

/**
 * Computer-vision habit verification powered by NVIDIA NIM vision models.
 *
 * ───────────────────────── Philosophy ─────────────────────────
 * The previous version of this file issued a single-shot prompt and
 * trusted whatever index the model blurted out — including when the
 * model wasn't sure. That produced random guesses (e.g. labelling a
 * physics notebook as "Zimbabwe travel").
 *
 * This rewrite fixes the flow in three ways:
 *
 *   1. The model is told to ANALYZE the photo first (describe what it
 *      sees in 1–2 short sentences), SYNTHHESIZE that against the
 *      candidate tasks, and THEN commit to a verdict. This is the
 *      classic "chain-of-thought" framing that vision LLMs respond
 *      well to.
 *
 *   2. The model explicitly returns a `is_ambiguous` flag. When true
 *      the API shows the user a clarification popup:
 *
 *         "Is this a [guessed-habit-name] task?  Yes / No"
 *
 *      If the user rejects the guess, the API re-runs a focused
 *      second pass that EXCLUDES the rejected guess from the list
 *      and asks the model to commit to one of the remaining names
 *      (or "no" if none match). The model is no longer allowed to
 *      keep re-pickering the same task.
 *
 *   3. The response is strict-JSON-fragment-parsed instead of a
 *      "first line must be PASS/FAIL". The model is allowed up to
 *      8 lines of reasoning first, then a single verdict line. This
 *      matches how the NIM vision models actually produce output.
 */

export type CVConfidence = "high" | "medium" | "low";
export type CVVerdict = "yes" | "no" | "unknown";

export interface CVAnalysis {
  /** What the model thinks the photo depicts, in plain text. */
  description: string;
  /** True iff the model couldn't confidently say yes/no. */
  ambiguous: boolean;
  /** For multi-habit match: index of the matched habit, or -1 for none. */
  matchedIndex: number;
  /** For single-habit verify: whether the photo matches the requested habit. */
  verdict: CVVerdict;
  confidence: CVConfidence;
  /** Short human reason, <= 24 words. */
  reason: string;
}

async function nvidiaVisionCheck(
  imageDataUrl: string,
  prompt: string,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<{ text: string; ok: boolean; errors: string[] }> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return { text: "", ok: false, errors: ["NVIDIA_API_KEY not configured"] };

  if (!/^data:([\w./+-]+);base64,(.+)$/s.test(imageDataUrl)) {
    return { text: "", ok: false, errors: ["Bad image data-URL."] };
  }

  return nvidiaVisionChat(
    [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageDataUrl } },
          { type: "text", text: prompt },
        ],
      },
    ],
    { temperature: opts?.temperature ?? 0.15, maxTokens: opts?.maxTokens ?? 280 },
  );
}

/* ──────────────── Shared JSON-fragment parsing ──────────────── */

function parseLooseJSON(text: string): Record<string, any> | null {
  // First try a fenced ```json``` block.
  const fenced = /```json\s*([\s\S]*?)\s*```/i.exec(text) || /```\s*([\s\S]*?)\s*```/i.exec(text);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  // Then try the first { ... } span in the text.
  const brace = /\{[\s\S]*\}/.exec(text);
  if (brace) {
    try { return JSON.parse(brace[0]); } catch {}
  }
  // Last resort: peel off key=val; pairs.
  const out: Record<string, any> = {};
  const re = /(\w+)\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|([a-z0-9_-]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const v = m[2] ?? m[3] ?? m[4] ?? "";
    out[m[1].toLowerCase()] = v;
  }
  return Object.keys(out).length ? out : null;
}

function normalizeVerdict(v: string): CVVerdict {
  const t = (v || "").trim().toLowerCase();
  if (/^(yes|true|pass|1)$/i.test(t)) return "yes";
  if (/^(no|false|fail|0)$/i.test(t)) return "no";
  return "unknown";
}

function normalizeConfidence(v: string): CVConfidence {
  const t = (v || "").trim().toLowerCase();
  if (t.startsWith("high")) return "high";
  if (t.startsWith("medium") || t.startsWith("med")) return "medium";
  return "low";
}

function normalizeBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "yes" || s === "1";
  }
  return false;
}

function pickReason(obj: Record<string, any>, fallback: string): string {
  return (obj.reason || obj.reasoning || obj.explanation || obj.why || "").toString().slice(0, 200) || fallback;
}

function pickDescription(obj: Record<string, any>, fallback: string): string {
  return (obj.description || obj.depicts || obj.analysis || obj.what_i_see || obj.seeing || "").toString().slice(0, 300) || fallback;
}

/* ──────────────── Single-habit verify ──────────────── */

export async function verifyHabitPhoto(
  habitName: string,
  imageDataUrl: string,
): Promise<{ passed: boolean; reason: string; description: string; ambiguous: boolean; confidence: CVConfidence }> {
  const prompt = `You are a strict but fair habit-verification judge using computer vision.

The user claims they just completed this activity: "${habitName}".
Look at the attached photo carefully and ANALYZE what you see — describe the objects, the setting, and any context clues in 1–2 sentences. Then SYNTHHESIZE: does what you see plausibly show the user actually doing "${habitName}" right now (the activity in progress, or the freshly produced result: an open book on the right page, a finished workout, gym equipment being used, a running path, etc.)?

Reply with ONLY a single JSON object on one line, no markdown, no backticks:
{
  "description": "<what you see in <= 20 words>",
  "verdict": "yes" | "no" | "unknown",
  "ambiguous": true | false,
  "confidence": "high" | "medium" | "low",
  "reason": "<<= 24 words; e.g. 'Photo shows an open physics textbook with formulas written on the page.'>"
}

Rules:
- Set verdict="unknown" and ambiguous=true when you genuinely can't tell (blurry, dark, screenshot, meme, stock image, ambiguous object).
- Set verdict="no" when the photo clearly does NOT depict "${habitName}".
- Never guess. If you don't have enough evidence, vote "unknown".`;

  const { text, ok, errors } = await nvidiaVisionCheck(imageDataUrl, prompt, { temperature: 0.15, maxTokens: 260 });
  if (!ok || !text) {
    return { passed: false, reason: errors.join(". ") || "Vision call failed — try again.", description: "", ambiguous: true, confidence: "low" };
  }

  const obj = parseLooseJSON(text) || {};
  const description = pickDescription(obj, "");
  const verdict = normalizeVerdict(obj.verdict);
  const ambiguous = normalizeBoolean(obj.ambiguous) || verdict === "unknown";
  const confidence = normalizeConfidence(obj.confidence);
  const reason = pickReason(obj, ambiguous ? "Couldn't confidently confirm." : verdict === "yes" ? "Looks legit." : "Doesn't match.");

  return {
    passed: verdict === "yes" && !ambiguous,
    reason,
    description,
    ambiguous,
    confidence,
  };
}

/* ──────────────── Multi-habit matcher ──────────────── */

export interface MatchResult {
  matched: boolean;
  habitName?: string;
  confidence?: CVConfidence;
  reason: string;
  description?: string;
  /** True iff the model is split between two candidates. */
  needsClarification?: boolean;
}

export async function matchPhotoToHabit(
  imageDataUrl: string,
  habitNames: string[],
): Promise<MatchResult> {
  if (habitNames.length === 0) {
    return { matched: false, reason: "No pending tasks to match against.", needsClarification: false };
  }

  const taskList = habitNames.map((n, i) => `${i + 1}. "${n}"`).join("\n");

  const prompt = `You are a habit-match judge using computer vision. The user took this photo to verify that they did one of these tasks today:

${taskList}

STEP 1 — ANALYZE the photo. In 1–2 sentences describe what you ACTUALLY see (objects, settings, text, equipment, people, gestures). Don't assume a task yet.
STEP 2 — SYNTHHESIZE. Compare your description to each task above. Pick the ONE task (or "none") that the photo MOST plausibly shows.
STEP 3 — COMMIT. Output ONLY a single JSON line — no markdown, no backticks:

{
  "description": "<<= 25 words; what you actually see>",
  "matched_index": <1..${habitNames.length} or 0>,
  "confidence": "high" | "medium" | "low",
  "ambiguous": true | false,
  "reason": "<= 20 words; e.g. 'Open textbook matches a reading/study task.'>"
}

Rules:
- matched_index = 0 if NONE match — do NOT force a guess.
- Set ambiguous=true when you're split between two tasks (e.g. a notebook could be "physics homework" or "journaling"). In that case pick the strongest candidate AND set ambiguous=true.
- Do NOT pick a task just because the photo contains a generic object (a notebook ≠ any reading task). Look for SPECIFIC signals.
- If the photo is blurry, dark, a screenshot, a meme, or a stock image, set matched_index=0.`;

  const { text, ok, errors } = await nvidiaVisionCheck(imageDataUrl, prompt, { temperature: 0.15, maxTokens: 320 });
  if (!ok || !text) {
    return { matched: false, reason: errors.join(". ") || "Vision call failed — try again.", needsClarification: false };
  }

  const obj = parseLooseJSON(text) || {};
  const description = pickDescription(obj, "");
  const matchedIndexRaw = obj["matched_index"] ?? obj.matched ?? obj.index ?? obj.choice ?? "0";
  const matchedIndex = parseInt(String(matchedIndexRaw).replace(/[^0-9]/g, ""), 10) || 0;
  const ambiguous = normalizeBoolean(obj.ambiguous);
  const confidence = normalizeConfidence(obj.confidence);
  const reason = pickReason(obj, ambiguous ? "Split between candidates — please confirm." : "AI analyzed the photo.");

  if (matchedIndex === 0 || matchedIndex > habitNames.length) {
    return { matched: false, reason: reason || "Photo doesn't match any pending task.", description, needsClarification: false };
  }

  return {
    matched: true,
    habitName: habitNames[matchedIndex - 1],
    confidence,
    reason,
    description,
    // Surface clarification when the model is uncertain about its own pick.
    needsClarification: ambiguous || confidence === "low",
  };
}

/* ──────────────── Clarification pass ────────────────
   User clicked "No" on the clarification popup. The API calls this
   path with the rejected habit name and a (possibly narrowed) list of
   remaining candidates. The model is told the previous guess was wrong
   and is NOT allowed to produce the same one again. */

export interface ClarifyResult extends MatchResult {}

export async function clarifyHabitPhoto(
  imageDataUrl: string,
  rejectedName: string,
  remainingNames: string[],
): Promise<ClarifyResult> {
  if (remainingNames.length === 0) {
    return { matched: false, reason: `That wasn't "${rejectedName}" and there are no other pending tasks left.`, needsClarification: false };
  }
  if (remainingNames.length === 1) {
    // Skip the model call entirely — if there's one task left, we still run
    // a focused single-habit verify because we can't trust the prior guess.
    const { passed, reason, description } = await verifyHabitPhoto(remainingNames[0], imageDataUrl);
    return {
      matched: passed,
      habitName: passed ? remainingNames[0] : undefined,
      confidence: passed ? "high" : "low",
      reason,
      description,
      needsClarification: false,
    };
  }

  const taskList = remainingNames.map((n, i) => `${i + 1}. "${n}"`).join("\n");

  const prompt = `You are a strict habit-match judge using computer vision.

CONTEXT: The user took a photo. The previous guess was "${rejectedName}" — the user has now REJECTED that guess. So "${rejectedName}" is NOT what the photo shows. Do not pick it again.

The remaining candidate tasks are:
${taskList}

STEP 1 — ANALYZE the photo in 1–2 sentences. Describe what you actually see (ignore "${rejectedName}" unless it's impossible to mistake).
STEP 2 — SYNTHHESIZE. Which of the REMAINING candidates does the photo MOST plausibly show?
STEP 3 — COMMIT. Reply with ONLY one JSON line, no markdown:

{
  "description": "<= 25 words>",
  "matched_index": <1..${remainingNames.length} or 0>,
  "confidence": "high" | "medium" | "low",
  "reason": "<= 18 words>"
}

Rules:
- matched_index = 0 if NONE of the remaining tasks match.
- Do NOT pick the same tag a different way — "${rejectedName}" is excluded.
- Be strict. A vague item (a blank notebook, a generic scene) should get matched_index = 0, not a guess.`;

  const { text, ok, errors } = await nvidiaVisionCheck(imageDataUrl, prompt, { temperature: 0.15, maxTokens: 320 });
  if (!ok || !text) {
    return { matched: false, reason: errors.join(". ") || "Vision call failed — try again.", needsClarification: false };
  }

  const obj = parseLooseJSON(text) || {};
  const description = pickDescription(obj, "");
  const matchedIndex = parseInt(String(obj["matched_index"] ?? obj.matched ?? 0).replace(/[^0-9]/g, ""), 10) || 0;
  const confidence = normalizeConfidence(obj.confidence);
  const reason = pickReason(obj, "Re-analyzed with the rejected task excluded.");

  if (matchedIndex === 0 || matchedIndex > remainingNames.length) {
    return { matched: false, reason: reason || "No remaining task matches the photo.", description, needsClarification: false };
  }

  return {
    matched: true,
    habitName: remainingNames[matchedIndex - 1],
    confidence,
    reason,
    description,
    needsClarification: false,
  };
}

/* ──────────────── Focused confirm pass ────────────────
   After the clarification popup ("Is this a [habit] task?"), the user
   doesn't actually say "Yes" — they pick a habit from a list. The API
   then calls this to confirm the chosen habit genuinely matches the
   photo (so a mischievous user can't pick the wrong one to skip). */

export async function confirmHabitPhoto(
  chosenHabitName: string,
  imageDataUrl: string,
): Promise<{ passed: boolean; reason: string; description: string }> {
  const r = await verifyHabitPhoto(chosenHabitName, imageDataUrl);
  return { passed: r.passed, reason: r.reason, description: r.description };
}

/** Back-compat shim — used by older callers that expected retryMatchPhoto. */
export async function retryMatchPhoto(
  imageDataUrl: string,
  remainingNames: string[],
  _rejectedNames: string[],
): Promise<MatchResult> {
  return matchPhotoToHabit(imageDataUrl, remainingNames);
}
