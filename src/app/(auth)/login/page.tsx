"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Flame, Mail, Lock, User, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";

const WELCOME_WORDS = ["embrace", "the", "friction."];
const STREAK_LINES = [
  "light up the night — one task at a time.",
  "small habits. big compound results.",
  "your future self is built in the dark.",
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [locality, setLocality] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot password flow
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [fpStep, setFpStep] = useState<"email" | "code" | "reset">("email");
  const [fpCode, setFpCode] = useState("");
  const [fpNewPw, setFpNewPw] = useState("");
  const [fpMsg, setFpMsg] = useState("");
  const [fpLoading, setFpLoading] = useState(false);

  // Typewriter state
  const [typedWelcome, setTypedWelcome] = useState("");
  const [streakIdx, setStreakIdx] = useState(0);
  const [habitGrid, setHabitGrid] = useState<boolean[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  // Show OAuth errors returned via URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "oauth_failed") setError("Google sign-in was cancelled. Please try again.");
    else if (err === "oauth_token_failed") setError("Failed to retrieve your Google session. Try again.");
    else if (err === "oauth_no_email") setError("Google account has no email address. Use email signup instead.");
    else if (err === "oauth_no_code") setError("Invalid OAuth response. Try again.");
    // Clean the param from the URL bar
    if (err) window.history.replaceState({}, "", "/login");
  }, []);

  // Typewriter for the hero welcome text
  useEffect(() => {
    const full = WELCOME_WORDS.join(" ");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTypedWelcome(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 75);
    return () => clearInterval(id);
  }, []);

  // Rotating motivation lines under the hero
  useEffect(() => {
    const id = setInterval(() => {
      setStreakIdx((i) => (i + 1) % STREAK_LINES.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  // Spawn-animated habit grid that fills up like a streak filling in
  useEffect(() => {
    const total = 35;
    const grid = Array.from({ length: total }, () => false);
    setHabitGrid(grid);
    let n = 0;
    const id = setInterval(() => {
      n++;
      const idx = Math.floor(Math.random() * total);
      setHabitGrid((prev) => {
        const next = [...prev];
        for (let k = 0; k < total; k++) {
          if (!next[k]) { next[k] = true; break; }
        }
        return next;
      });
      if (n >= total) clearInterval(id);
    }, 80);
    return () => clearInterval(id);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register" && !agree) { setError("Please accept the terms to create your account."); return; }
    setLoading(true);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload = mode === "login" ? { email, password } : { email, name, password, locality };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data?.error || "Something went wrong"); return; }
    // Anti-enumeration: register returns a generic success for already-existing
    // emails WITHOUT a session. In that case we Surface the message so the
    // user knows to log in instead of silently landing back on /login.
    if (data?.message) {
      setError(data.message);
      setMode("login");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setError("");
    setGoogleLoading(true);
    window.location.href = "/api/auth/google";
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setFpMsg(""); setFpLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (data.ok) setFpStep("code");
      setFpMsg(data.message || "If this email is registered, a code has been sent.");
    } catch { setFpMsg("Network error. Try again."); }
    setFpLoading(false);
  }

  async function handleResetPassword() {
    setFpMsg(""); setFpLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, code: fpCode, password: fpNewPw }),
      });
      const data = await res.json();
      if (data.ok) {
        setFpMsg("Password reset! Logging you in...");
        setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1000);
      } else {
        setFpMsg(data.error || "Reset failed");
      }
    } catch { setFpMsg("Network error. Try again."); }
    setFpLoading(false);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-bg">
      {/* LEFT — Animated hero with habit grid + typewriter */}
      <div className="relative overflow-hidden hidden lg:flex flex-col justify-between p-12" style={{ background: "var(--bg-2)" }}>
        {/* floating blobs */}
        <div className="absolute top-12 -right-12 h-60 w-60 rounded-full bg-green-200/40 blur-3xl animate-float" />
        <div className="absolute bottom-32 -left-10 h-72 w-72 rounded-full bg-amber-100/50 blur-3xl animate-float" style={{ animationDelay: "1.2s" }} />
        <div className="absolute top-1/3 left-1/2 h-40 w-40 rounded-full bg-pink-100/40 blur-3xl animate-float" style={{ animationDelay: "0.6s" }} />

        {/* Logo */}
        <div className="relative z-10">
          <a href="/login" className="flex items-center gap-2">
            <BrandMark size={32} idPrefix="login-hero" rounded={7} />
            <span className="text-xl font-semibold lowercase text-ink">sleek</span>
          </a>
        </div>

        {/* Typewriter welcome + streak info */}
        <div className="relative z-10 max-w-md">
          <h1 className="text-5xl font-extrabold tracking-tight text-ink leading-[1.08]">
            {typedWelcome}
            <span className="inline-block w-[3px] h-10 bg-green-500 ml-1 align-middle animate-pulse" />
          </h1>
          <p className="mt-4 text-base ink-soft min-h-[24px] transition-opacity duration-300" key={streakIdx}>
            {STREAK_LINES[streakIdx]}
          </p>

          <div className="mt-5 flex items-center gap-2">
<div className="flex items-center gap-2 rounded-full bg-white/70 backdrop-blur border border-[var(--line)] px-3 py-1.5">
                <Flame className="h-4 w-4" style={{ color: "var(--flame-fg)" }} />
                <span className="text-sm font-bold text-ink tabular-nums">365</span>
                <span className="text-xs meta">day goal</span>
              </div>
            <div className="chip chip-green">Free forever</div>
            <div className="chip chip-amber">No ads</div>
          </div>
        </div>

        {/* Habit grid filling in — like a streak heatmap */}
        <div ref={gridRef} className="relative z-10">
          <div className="label-xs mb-2">Your year, one habit at a time</div>
          <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5 max-w-md">
            {habitGrid.map((on, i) => (
              <span
                key={i}
                className={
                  "aspect-square rounded-[5px] transition-all duration-300 " +
                  (on ? "bg-green-500 scale-100 opacity-100 shadow-[0_2px_6px_rgba(34,165,88,0.4)]" : "bg-[var(--line-soft)] scale-95 opacity-60")
                }
                style={{ transitionDelay: `${i * 8}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Bottom testimonial */}
        <div className="relative z-10 flex items-center gap-3 text-sm">
          <div className="flex -space-x-2">
            {["#22a558", "#f5b812", "#3b82f6", "#ec4899"].map((c, i) => (
              <span key={i} className="h-8 w-8 rounded-full border-2 border-cream-100" style={{ background: c }} />
            ))}
          </div>
          <span className="meta">
            <b className="text-ink">2,400+</b> people tracking habits every day
          </span>
        </div>

        {/* Feedback / testimonials from early users */}
        <div className="relative z-10 mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { name: "Neetish",   color: "#22a558", quote: "Finally a tracker that doesn't shame me. The deep-work mode is gold." },
            { name: "Bhavishya", color: "#f5b812", quote: "The cleanest UI I've used. The AI coach gets my Sundays perfectly." },
            { name: "Rachit",    color: "#3b82f6", quote: "Streaks, badges, focus — it all clicks. Feels like a game I want to win." },
          ].map((t) => (
            <div key={t.name} className="rounded-2xl p-3 text-xs animate-fade-up"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(8px)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-6 w-6 rounded-full grid place-items-center text-white text-[10px] font-bold" style={{ background: t.color }}>
                  {t.name[0]}
                </span>
                <span className="font-semibold text-white">{t.name}</span>
              </div>
              <p className="text-white/75 leading-relaxed">"{t.quote}"</p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — Login form */}
      <div className="flex items-center justify-center p-6 lg:p-10 bg-bg">
        <div className="w-full max-w-md card !p-8 animate-fade-up" data-animate="pop">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-6">
            <BrandMark size={28} idPrefix="login-m" rounded={7} />
            <span className="font-semibold lowercase text-ink">sleek</span>
          </div>

          <h2 className="text-2xl font-bold text-ink">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p className="mt-1 text-sm meta">
            {mode === "login" ? "Keep your streak alive — log in to continue." : "Start tracking habits in less than a minute."}
          </p>

          {mode === "login" && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-[var(--line)] bg-white hover:bg-[var(--bg-2)] transition-all text-sm font-medium text-ink disabled:opacity-60"
              >
                {googleLoading ? (
                  <span className="h-5 w-5 border-2 border-[var(--line)] border-t-ink rounded-full animate-spin" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {googleLoading ? "Redirecting…" : "Continue with Google"}
              </button>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" style={{ borderColor: "var(--line)" }} />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-3 bg-[var(--bg)] text-ink-muted">or</span>
</div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPw && (
        <div className="fixed inset-0 z-50 grid place-items-center p-6 bg-black/50 animate-fade-up" onClick={() => setShowForgotPw(false)}>
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-xl animate-pop"
            style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-ink mb-1">Reset Password</h3>
            <p className="text-xs meta mb-4">We'll send a 6-digit code to your email.</p>

            {fpStep === "email" && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <InputField icon={<Mail className="h-4 w-4" />} placeholder="Your email" value={forgotEmail} onChange={setForgotEmail} type="email" />
                {fpMsg && <p className="text-xs" style={{ color: fpMsg.includes("sent") ? "var(--green-600)" : "var(--coral-500)" }}>{fpMsg}</p>}
                <button type="submit" disabled={fpLoading} className="btn-primary w-full !py-2.5 rounded-xl">
                  {fpLoading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Send Reset Code"}
                </button>
              </form>
            )}

            {fpStep === "code" && (
              <div className="space-y-4">
                <p className="text-xs text-green-600">{fpMsg}</p>
                <div>
                  <label className="label-xs block mb-1">6-digit code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={fpCode}
                    onChange={(e) => setFpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="input w-full text-center text-lg tracking-[0.3em] rounded-xl"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label-xs block mb-1">New password</label>
                  <input
                    type={showPw ? "text" : "password"}
                    value={fpNewPw}
                    onChange={(e) => setFpNewPw(e.target.value)}
                    placeholder="At least 8 characters"
                    className="input w-full rounded-xl"
                  />
                </div>
                {fpMsg && fpMsg.includes("wrong") && <p className="text-xs" style={{ color: "var(--coral-500)" }}>{fpMsg}</p>}
                <button
                  onClick={handleResetPassword}
                  disabled={fpLoading || fpCode.length < 6 || fpNewPw.length < 8}
                  className="btn-green w-full !py-2.5 rounded-xl flex items-center justify-center gap-2"
                >
                  {fpLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {fpLoading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            )}

            <button
              onClick={() => { setShowForgotPw(false); setFpStep("email"); setFpMsg(""); }}
              className="mt-4 text-xs meta underline underline-offset-2 mx-auto block hover:text-ink"
            >
              Back to login
            </button>
          </div>
        </div>
      )}
            </>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <InputField
                icon={<User className="h-4 w-4" />}
                placeholder="Name"
                value={name}
                onChange={setName}
                type="text"
              />
            )}
            {mode === "register" && (
              <InputField
                icon={<User className="h-4 w-4" />}
                placeholder="Locality (e.g. Gwalior) — hidden on leaderboard"
                value={locality}
                onChange={setLocality}
                type="text"
              />
            )}
            <InputField
              icon={<Mail className="h-4 w-4" />}
              placeholder="Email"
              value={email}
              onChange={setEmail}
              type="email"
            />
            <div className="relative">
              <InputField
                icon={<Lock className="h-4 w-4" />}
                placeholder="Password"
                value={password}
                onChange={setPassword}
                type={showPw ? "text" : "password"}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 meta hover:text-ink transition"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setShowForgotPw(true); setForgotEmail(email); setFpStep("email"); setFpMsg(""); }}
                  className="text-xs font-medium underline underline-offset-2 hover:text-green-700 transition"
                  style={{ color: "var(--green-600)" }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {mode === "register" && (
              <label htmlFor="agree" className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  id="agree"
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="sr-only"
                />
                <span className="check"><svg viewBox="0 0 18 18"><path d="M1 9 L7 14 L1 19" /><polyline points="1 9 7 14 17 4" /></svg></span>
                <span className="text-xs ink-soft">I agree to the <Link href="/terms" className="text-green-600 underline">Terms</Link> & <Link href="/privacy" className="text-green-600 underline">Privacy Policy</Link>.</span>
              </label>
            )}

            {error && (
              <div className="rounded-lg bg-coral-100 border border-coral-100 px-3 py-2 text-sm text-coral-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full !py-3"
            >
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm meta">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="font-semibold text-green-600 underline underline-offset-2 hover:text-green-700"
            >
              {mode === "login" ? "Create an account" : "Log in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({
  icon, placeholder, value, onChange, type
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 meta">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={type !== "password" || placeholder === "Password"}
        minLength={type === "password" ? 6 : undefined}
        className="input w-full !pl-10"
      />
    </div>
  );
}
