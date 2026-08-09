import { GoogleGenAI } from "@google/genai";

/**
 * Gemini Vision helper — wraps a single image + prompt and returns the model's
 * text reply. Picks gemini-1.5-flash (fast, free-tier friendly, multimodal).
 *
 * The `imageDataUrl` is the raw data-URL captured in the browser
 * (e.g. "data:image/jpeg;base64,...."). We split off the mime + base64 payload
 * and feed it to the SDK as inline data so it doesn't need a file upload.
 */
export async function geminiVisionCheck(
  imageDataUrl: string,
  prompt: string
): Promise<{ text: string; ok: boolean; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { text: "", ok: false, error: "GEMINI_API_KEY is not configured." };

  // Parse the data-URL: "data:<mime>;base64,<payload>"
  const match = /^data:([\w./+-]+);base64,(.+)$/s.exec(imageDataUrl);
  if (!match) return { text: "", ok: false, error: "Bad image data-URL." };
  const mimeType = match[1];
  const base64 = match[2];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: prompt }
          ]
        }
      ],
      config: { temperature: 0.1, maxOutputTokens: 200 }
    });
    const text = (res.text ?? "").trim();
    return { text, ok: true };
  } catch (e: any) {
    return { text: "", ok: false, error: String(e?.message ?? e) };
  }
}

/**
 * Verifies a habit check-in photo against the user's stated habit using Gemini
 * Vision. Returns { passed, reason } where `passed` indicates the photo is a
 * plausible genuine picture of the user doing the habit.
 *
 * The prompt asks the model to output exactly `PASS` or `FAIL` on the first
 * line, optionally followed by a short reason. We then parse the first token.
 */
export async function verifyHabitPhoto(
  habitName: string,
  imageDataUrl: string
): Promise<{ passed: boolean; reason: string }> {
  const prompt = `You are a strict but fair habit-verification judge.
The user claims they just did this habit: "${habitName}".
Look at the attached photo and decide if it plausibly shows the user actually
doing that activity right now (or the result of it, like a finished book page,
open journal, gym machine, running trail, etc.).

Reply on the FIRST line with exactly PASS or FAIL:
- PASS if the photo plausibly depicts the habit "${habitName}" (real, in-progress or freshly done; not a stock photo, screen, or unrelated object).
- FAIL if it's blurry, dark, unrelated, a meme/screenshot, or you can't tell.

On the second line, give a <=12-word reason. Keep it short.`;

  const { text, ok, error } = await geminiVisionCheck(imageDataUrl, prompt);
  if (!ok || !text) return { passed: false, reason: error || "Vision call failed — try again." };

  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const passed = /^pass\b/i.test(firstLine);
  const reason = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(1).join(" ").slice(0, 160) ||
    (passed ? "Looks legit." : "Couldn't confirm the habit.");
  return { passed, reason };
}
