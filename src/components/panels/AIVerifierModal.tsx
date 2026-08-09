"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, X, Check, AlertCircle, Loader2, RefreshCw, Image as ImageIcon, XCircle, Zap } from "lucide-react";

export function AIVerifierModal({
  habitsForToday, onVerified, onClose, singleHabitId,
}: {
  habitsForToday: { id: string; name: string; requiresCamera: boolean }[];
  onVerified: (passed: boolean, habitName: string, confidence: number, reason?: string) => void;
  onClose: () => void;
  singleHabitId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const todayHabits = habitsForToday.filter((h) => h.requiresCamera);

  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [step, setStep] = useState<"loading" | "ready" | "capturing" | "verifying" | "match" | "clarify" | "done">("loading");
  const [match, setMatch] = useState<{ habitId: string; habitName: string; confidence: string } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [latestDataUrl, setLatestDataUrl] = useState("");
  const [pendingList, setPendingList] = useState<{ id: string; name: string }[]>([]);
  // ── Clarification popup state ───────────────────────────
  // When the vision model says it's split between candidates, we DON'T auto-
  // confirm — we show a "Is this a [habit] task?  Yes / No" popup first.
  const [clarifyGuess, setClarifyGuess] = useState<{ habitId: string; habitName: string } | null>(null);
  const [clarifying, setClarifying] = useState(false);

  const maxAttempts = 3;

  // ─── Camera startup ───────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "camera") { setStep("ready"); return; }
    let cancelled = false;

    (async () => {
      setStep("loading");
      setError("");
      try {
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        }
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        setStep("ready");
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message?.includes("Permission") || e?.message?.includes("NotAllowed")
            ? "Camera permission denied. Use upload instead."
            : e?.message || "Camera unavailable.");
          setMode("upload");
          setStep("ready");
        }
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [mode]);

  // Bind stream to video once element mounts
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => {});
  }, [step, mode]);

  // ─── Capture photo from camera ────────────────────────────────────
  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    setStep("capturing");

    let waited = 0;
    while (video.videoWidth === 0 && waited < 6000) {
      await new Promise((r) => setTimeout(r, 200));
      waited += 200;
    }
    if (video.videoWidth === 0) {
      setError("Camera didn't start in time. Try again or use upload.");
      setStep("ready");
      return;
    }

    const canvas = document.createElement("canvas");
    const maxW = 720;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLatestDataUrl(dataUrl);
    await submit(dataUrl);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image."); return; }
    if (file.size > 5_000_000) { setError("Image too large — max 5 MB."); return; }
    setStep("capturing");
    try {
      const dataUrl = await resizeToDataUrl(file, 720, 0.82);
      setLatestDataUrl(dataUrl);
      await submit(dataUrl);
    } catch {
      setError("Could not read image.");
      setStep("ready");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  // ─── Submit photo to AI ───────────────────────────────────────────
  async function submit(dataUrl: string) {
    const att = attempts + 1;
    setAttempts(att);
    setStep("verifying");
    setError("");

    try {
      const r = await fetch("/api/ai-verifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          date: new Date().toISOString().slice(0, 10),
          imageDataUrl: dataUrl,
          attempt: att,
        }),
      });
      const json = await r.json();
      if (!r.ok) { setError(json.error ?? "Verification failed."); setStep("match"); return; }

      setReason(json.reason ?? "");
      setPendingList(json.remaining?.length ? json.remaining.map((n: string) => ({ id: "", name: n })) : []);
      if (json.match) {
        // ── Branch: model is split between candidates ──
        // Show the clarification popup. User confirms (Yes) or rejects (No).
        // No → API re-analyzes with the rejected name excluded.
        if (json.needsClarification) {
          setMatch(json.match);
          setClarifyGuess({ habitId: json.match.habitId, habitName: json.match.habitName });
          setStep("clarify");
        } else {
          // ── Branch: model is confident — show the standard match card ──
          setMatch(json.match);
          setStep("match");
        }
      } else {
        setMatch(null);
        setStep("match");
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
      setStep("match");
      setMatch(null);
    }
  }

  // ─── Clarification handlers ──────────────────────────────────────
  // User answered YES to "Is this a [habit] task?" — fall through to the
  // normal match card so they can press "Confirm".
  function clarifyYes() {
    setStep("match");
  }

  // User answered NO. We re-call the API with action=clarify, telling it to
  // re-analyze the SAME photo with the rejected name excluded. The server
  // runs the new CV invoke with the narrowed candidate list.
  async function clarifyNo() {
    if (!clarifyGuess || !latestDataUrl) { setStep("match"); return; }
    setClarifying(true);
    try {
      const r = await fetch("/api/ai-verifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clarify",
          date: new Date().toISOString().slice(0, 10),
          imageDataUrl: latestDataUrl,
          rejectedName: clarifyGuess.habitName,
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        setError(json.error ?? "Re-analysis failed.");
        setStep("match");
        return;
      }
      setReason(json.reason ?? "");
      setPendingList(json.remaining?.length ? json.remaining.map((n: string) => ({ id: "", name: n })) : []);
      if (json.match) {
        // The re-analysis is confident (clarifyHabitPhoto never sets
        // needsClarification) — show the standard match card.
        setMatch(json.match);
        setClarifyGuess({ habitId: json.match.habitId, habitName: json.match.habitName });
        setStep("match");
      } else {
        setMatch(null);
        setStep("match");
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error during re-analysis.");
      setStep("match");
      setMatch(null);
    } finally {
      setClarifying(false);
      setClarifyGuess(null);
    }
  }

  // ─── Confirm / reject / retry ─────────────────────────────────────
  async function confirm() {
    if (!match) return;
    try {
      const r = await fetch("/api/ai-verifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          habitId: match.habitId,
          date: new Date().toISOString().slice(0, 10),
        }),
      });
      if (r.ok) {
        onVerified(true, match.habitName, 1, reason);
        setStep("done");
      } else {
        const json = await r.json().catch(() => ({}));
        setError(json.error ?? "Failed to confirm.");
        setStep("match");
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
    }
  }

  async function reject() {
    if (!match) return;
    try {
      await fetch("/api/ai-verifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          habitId: match.habitId,
          date: new Date().toISOString().slice(0, 10),
        }),
      });
    } catch {}

    if (pendingList.length <= 1) {
      setMatch(null);
      setReason("Photo doesn't match any remaining task.");
      return;
    }

    try {
      const r = await fetch("/api/ai-verifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          date: new Date().toISOString().slice(0, 10),
          imageDataUrl: latestDataUrl,
          attempt: attempts,
        }),
      });
      const json = await r.json();
      if (json.match) {
        setMatch(json.match);
        setReason(json.reason ?? "");
        setPendingList(json.remaining?.map((n: string) => ({ id: "", name: n })) ?? []);
      } else {
        setMatch(null);
        setReason(json.reason ?? "No remaining task matches.");
      }
    } catch {
      setMatch(null);
      setReason("Failed to re-check remaining tasks.");
    }
  }

  async function retry() {
    if (attempts >= maxAttempts) {
      await autoSkip();
      return;
    }
    setMatch(null);
    setReason("");
    setError("");
    if (mode === "camera") {
      setStep("loading");
      setMode("camera");
    } else {
      setStep("ready");
    }
  }

  async function autoSkip() {
    const target = match?.habitId || todayHabits[0]?.id;
    if (!target) return;
    try {
      await fetch(`/api/habits/${target}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          completed: false,
          status: "skipped",
          locked: true,
          manualOverride: true,
          note: "Auto-skipped after 3 failed camera verifications.",
        }),
      });
      onVerified(false, todayHabits[0]?.name ?? target, 0, "Auto-skipped.");
      setStep("done");
    } catch {
      setError("Failed to auto-skip. Please close and try the upload method.");
    }
  }

  // ─── Run single-habit flow automatically ───────────────────────────
  useEffect(() => {
    if (!singleHabitId || step !== "ready" || mode !== "camera" || todayHabits.length !== 1) return;
    const timer = setTimeout(() => capture(), 800);
    return () => clearTimeout(timer);
  }, [step, mode, singleHabitId]);

  // ─── UI ───────────────────────────────────────────────────────────
  const photoPreview = latestDataUrl ? (
    <div className="rounded-xl overflow-hidden" style={{ border: "2px solid var(--line)", background: "#000" }}>
      <img src={latestDataUrl} alt="Your photo" className="w-full object-cover" style={{ maxHeight: 300 }} />
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-3 bg-black/50 backdrop-blur-sm animate-fade-up" onClick={onClose}>
      <div className="panel w-full max-w-[440px] max-h-[94vh] overflow-y-auto animate-pop p-0 rounded-[20px]"
        style={{ background: "var(--bg)", border: "1px solid var(--line)", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "linear-gradient(135deg,#3b82f6,#06b6d4)" }}>
              <Camera className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-ink">Camera Verification</h3>
              <p className="text-[10px] meta">
                {todayHabits.length} pending · attempt {attempts}/{maxAttempts}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--bg-2)] text-ink-muted hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Error banner */}
          {error && (
            <div className="px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2" style={{ background: "var(--coral-50)", color: "var(--coral-600)", border: "1px solid var(--coral-200)" }}>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </div>
          )}

          {/* Pending list */}
          {todayHabits.length > 0 && step !== "done" && (
            <div className="text-[11px] px-2.5 py-2 rounded-xl leading-relaxed" style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)" }}>
              <span className="font-semibold text-ink">Pending camera tasks: </span>
              <span style={{ color: "var(--ink-soft)" }}>{todayHabits.map((h) => h.name).join(", ")}</span>
            </div>
          )}

          {todayHabits.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--ink-muted)" }} />
              <p className="text-sm meta">No camera-pending habits today.</p>
            </div>
          )}

          {/* Loading */}
          {step === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="relative grid h-16 w-16 place-items-center">
                <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[var(--blue-500)] animate-spin" />
                <Camera className="h-6 w-6" style={{ color: "var(--blue-500)" }} />
              </div>
              <p className="text-xs text-ink-muted font-medium">Starting camera…</p>
            </div>
          )}

          {/* Camera view */}
          {step === "ready" && mode === "camera" && (
            <div>
              <div className="relative rounded-xl overflow-hidden" style={{ border: "2px solid var(--line)", background: "#0a0a0f" }}>
                <video ref={videoRef} playsInline muted className="w-full aspect-video object-cover" style={{ minHeight: 220 }} />
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,.4)" }}>
                    <div className="text-center px-4">
                      <div className="grid h-12 w-12 place-items-center rounded-full mx-auto mb-2" style={{ background: "var(--coral-100)" }}>
                        <AlertCircle className="h-6 w-6" style={{ color: "var(--coral-500)" }} />
                      </div>
                      <p className="text-xs text-white/70">{error}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] meta">Center the activity, tap Capture.</span>
                <button onClick={capture}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition hover:opacity-90"
                  style={{ background: "var(--ink)", boxShadow: "0 4px 14px -6px rgba(0,0,0,.4)" }}>
                  <Camera className="h-3.5 w-3.5" /> Capture
                </button>
              </div>
              <div className="mt-2 text-center">
                <button onClick={() => { setMode("upload"); setStep("ready"); }} className="text-xs meta underline hover:text-ink">Switch to image upload</button>
              </div>
            </div>
          )}

          {/* Upload mode */}
          {step === "ready" && mode === "upload" && (
            <div>
              <div className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-8 px-4 text-center cursor-pointer hover:border-[var(--blue-400)] transition"
                style={{ borderColor: "var(--line)" }}
                onClick={() => fileRef.current?.click()}>
                <ImageIcon className="h-7 w-7 mb-2" style={{ color: "var(--ink-muted)" }} />
                <p className="text-sm font-medium text-ink">Choose image</p>
                <p className="text-[11px] meta mt-1">JPG, PNG up to 5 MB. AI matches it to pending tasks.</p>
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" />
              <div className="mt-2 text-center">
                <button onClick={() => { setMode("camera"); setStep("loading"); }} className="text-xs meta underline hover:text-ink">Switch to camera</button>
              </div>
            </div>
          )}

          {/* Capturing / Verifying */}

          {(step === "capturing" || step === "verifying") && todayHabits.length > 0 && (
            <div className="text-center py-4">
              {photoPreview}
              <div className="mt-4 flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--blue-500)" }} />
                <span className="text-xs text-ink-muted font-medium">
                  {step === "capturing" ? "Capturing…" : "AI analyzing photo…"}
                </span>
              </div>
            </div>
          )}

          {/* Clarification popup — "Is this a [habit] task? Yes / No" */}
          {step === "clarify" && (
            <div className="text-center space-y-4 animate-fade-up">
              {photoPreview && <div className="opacity-95">{photoPreview}</div>}
              <div className="grid h-14 w-14 place-items-center rounded-full mx-auto animate-pop" style={{ background: "var(--amber-50)", border: "1px solid var(--amber-200)" }}>
                <AlertCircle className="h-7 w-7" style={{ color: "var(--amber-500)" }} />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-extrabold text-ink leading-snug">
                  Is this a <span style={{ color: "var(--blue-600)" }}>"{clarifyGuess?.habitName}"</span> task?
                </h4>
                <p className="text-[11px] meta leading-relaxed max-w-sm mx-auto">
                  {reason || "The AI is split between two candidates — please confirm which task this photo actually shows."}
                </p>
              </div>
              <div className="flex gap-3 justify-center pt-1">
                <button
                  onClick={clarifyYes}
                  disabled={clarifying}
                  className="btn-green !py-3 !px-6 text-sm font-bold flex items-center gap-2 flex-1 max-w-[180px] justify-center">
                  <Check className="h-4 w-4" /> Yes
                </button>
                <button
                  onClick={clarifyNo}
                  disabled={clarifying}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl border-2 transition flex-1 max-w-[180px] justify-center disabled:opacity-50"
                  style={{ borderColor: "var(--coral-500)", color: "var(--coral-500)" }}>
                  {clarifying
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Re-checking…</>
                    : <><XCircle className="h-4 w-4" /> No</>}
                </button>
              </div>
              <p className="text-[10px] meta pt-1">
                Picking "No" will re-analyze the photo with that task excluded.
              </p>
            </div>
          )}

          {/* Match results */}
          {step === "match" && (
            <>
              {photoPreview}
              {match ? (
                <div className="text-center space-y-3 pt-2 animate-fade-up">
                  <div className="grid h-12 w-12 place-items-center rounded-full mx-auto" style={{ background: "var(--green-100)" }}>
                    <Zap className="h-5 w-5" style={{ color: "var(--green-600)" }} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-ink">Is this "{match.habitName}"?</h4>
                    <p className="text-[11px] meta mt-1">
                      {reason} {match.confidence !== "high" && <span style={{ color: "var(--amber-600)" }}>({match.confidence})</span>}
                    </p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button onClick={confirm}
                      className="btn-green !py-2.5 !px-5 text-sm font-bold flex items-center gap-1.5 flex-1 max-w-[180px] justify-center">
                      <Check className="h-4 w-4" /> Confirm
                    </button>
                    <button onClick={reject}
                      className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold rounded-xl border-2 transition flex-1 max-w-[180px] justify-center"
                      style={{ borderColor: "var(--coral-500)", color: "var(--coral-500)" }}>
                      <XCircle className="h-4 w-4" /> Not this
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3 pt-3 animate-fade-up">
                  <div className="grid h-12 w-12 place-items-center rounded-full mx-auto" style={{ background: "var(--coral-100)" }}>
                    <AlertCircle className="h-5 w-5" style={{ color: "var(--coral-500)" }} />
                  </div>
                  <h4 className="text-base font-bold text-ink">{attempts < maxAttempts ? "No match found" : "Not verified"}</h4>
                  <p className="text-[11px] meta">{reason || "AI couldn't match this photo. Try a different angle."}</p>

                  {attempts < maxAttempts ? (
                    <div className="space-y-2">
                      <button onClick={retry}
                        className="btn-ghost w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold">
                        <RefreshCw className="h-3.5 w-3.5" /> Try again ({maxAttempts - attempts} remaining)
                      </button>
                      <button onClick={() => { setMode("upload"); setStep("ready"); }} className="text-[11px] meta underline hover:text-ink block mx-auto">
                        Or use image upload
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs meta">All {maxAttempts} attempts used.</p>
                      <button onClick={autoSkip}
                        className="flex items-center justify-center gap-1 px-5 py-2.5 text-sm font-semibold rounded-xl text-white w-full transition"
                        style={{ background: "var(--coral-500)" }}>
                        <XCircle className="h-3.5 w-3.5" /> Skip this task
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="text-center py-8 space-y-3 animate-fade-up">
              <div className="grid h-14 w-14 place-items-center rounded-full mx-auto" style={{ background: "var(--green-100)" }}>
                <Check className="h-7 w-7" style={{ color: "var(--green-600)" }} />
              </div>
              <h4 className="text-lg font-bold text-ink">Verified</h4>
              <p className="text-xs meta">Task marked complete. Great work.</p>
              <button onClick={onClose} className="btn-ghost text-xs">Close</button>
            </div>
          )}
        </div>

        {/* Footer tips */}
        {todayHabits.length > 0 && step !== "done" && (
          <div className="px-5 pb-4 flex items-center justify-center gap-1.5 text-[10px] meta">
            <Zap className="h-3 w-3" /> Take a clear, well-lit photo for best results
          </div>
        )}
      </div>
    </div>
  );
}

function resizeToDataUrl(file: File, maxW: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Decode failed"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}