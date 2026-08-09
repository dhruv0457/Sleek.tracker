"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Zap, Shield, Sparkles, ArrowLeft } from "lucide-react";
import Script from "next/script";

interface PaymentPlan {
  id: "basic_pro" | "ultra_pro";
  name: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  recommended: boolean;
  gradient: string;
}

const PAID_PLANS: PaymentPlan[] = [
  {
    id: "basic_pro",
    name: "Pro",
    price: "$2",
    period: "/month",
    desc: "AI-powered camera verification, automated reports, and premium features.",
    cta: "Get Pro",
    recommended: false,
    gradient: "from-indigo-500 to-violet-600",
    features: [
      "AI camera work verification",
      "Advanced detailed work reports",
      "Custom time-based alerts",
      "10 AI insights messages/day",
      "Priority email support",
      "Gmail daily digest reports",
      "Focus zone analytics",
    ],
  },
  {
    id: "ultra_pro",
    name: "Ultra",
    price: "$4",
    period: "/month",
    desc: "Everything in Pro plus unlimited AI chat, Google Workspace export, and the full analytical suite.",
    cta: "Get Ultra",
    recommended: true,
    gradient: "from-amber-500 to-orange-600",
    features: [
      "Everything in Pro plan",
      "Unlimited AI insights chat",
      "Export to Google Workspace",
      "Google Sheets summary export",
      "Google Docs habit journal",
      "Full Google Drive backup",
      "Workspace export scheduling",
    ],
  },
];

const FREE_FEATURES = [
  "Immutable daily check-in list",
  "Intensity & capacity tracking",
  "Heatmap & streak analytics",
  "5 habits & 4 AI messages/day",
  "Focus zone with deep-work timer",
  "Trophies & badges system",
  "2-day free trial included",
];

export function PricingPageClient({ currentTier, isLoggedIn }: { currentTier: string; isLoggedIn: boolean }) {
  const router = useRouter();
  const [rzpLoaded, setRzpLoaded] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push("/login?redirect=pricing");
    }
  }, [isLoggedIn, router]);

  async function handleUpgrade(planId: string) {
    if (!isLoggedIn) {
      router.push(`/login?redirect=pricing`);
      return;
    }
    setConfirmPlan(planId);
  }

  async function confirmUpgrade(plan: string) {
    setConfirmPlan(null);
    setLoadingPlan(plan); setError("");
    try {
      const res = await fetch("/api/payment/free-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upgrade failed");
      setLoadingPlan(null);
      router.push("/dashboard?upgraded=" + plan);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Upgrade failed. Try again.");
      setLoadingPlan(null);
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRzpLoaded(true)} />
      <main className="flex-1 flex flex-col">
        {/* Back button — top left */}
        <button
          onClick={() => router.back()}
          className="absolute top-5 left-5 z-50 grid h-10 w-10 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition group"
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition" />
        </button>
        {/* Hero */}
        <section className="pt-20 pb-16 px-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-1/4 w-72 h-72 rounded-full blur-3xl bg-green-200" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl bg-indigo-100" />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-6" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
              <Shield className="h-3 w-3" /> Secured by Razorpay &bull; Cancel anytime
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink">
              Simple, <span className="text-green-600">transparent</span> pricing
            </h1>
            <p className="mt-4 text-lg meta max-w-lg mx-auto">
              Start free, upgrade when you're ready. No hidden fees, no surprise bills.
            </p>
          </div>
        </section>

        {/* Plans */}
        <section className="flex-1 px-6 pb-20">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6 items-stretch">
            {/* Free card */}
            <div className="p-6 rounded-3xl flex flex-col" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
              <div className="text-sm font-bold text-ink">Free</div>
              <div className="mt-1">
                <span className="text-3xl font-extrabold text-ink">$0</span>
                <span className="text-sm meta ml-1">forever</span>
              </div>
              <p className="text-xs meta mt-2">Getting started, small changes.</p>
              <div className="mt-5 space-y-2 flex-1">
                {FREE_FEATURES.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-ink-soft">
                    <Check className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5 " />
                    {f}
                  </div>
                ))}
              </div>
              {currentTier === "free" ? (
                <button className="mt-6 w-full rounded-2xl py-3 text-sm font-semibold border-2 text-ink transition hover:border-ink" style={{ borderColor: "var(--line )", background: "transparent" }}>
                  Current plan
                </button>
              ) : (
                <a
                  href="/api/payment/free-upgrade"
                  onClick={(e) => { e.preventDefault(); handleUpgrade("free"); }}
                  className="mt-6 w-full block text-center rounded-2xl py-3 text-sm font-semibold border-2 transition hover:border-ink"
                  style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
                >
                  Downgrade to Free
                </a>
              )}
            </div>

            {PAID_PLANS.map((plan) => {
              const isCurrent = currentTier === plan.id;
              // A Pro user should be able to upgrade to Ultra, but not "re-buy" Pro.
              // Ultra user sees "Current plan" on Ultra and "Downgrade" on Pro.
              const isHigher = plan.id === "ultra_pro" && currentTier === "basic_pro";
              const isLower  = plan.id === "basic_pro" && currentTier === "ultra_pro";
              const ctaLabel =
                isHigher ? "Upgrade to Ultra" :
                isLower  ? "Downgrade to Pro" :
                plan.cta;
              return (
                <div
                  key={plan.id}
                  className={`p-6 rounded-3xl flex flex-col relative ${
                    plan.recommended ? "shadow-xl ring-2 ring-amber-400 scale-[1.02]" : ""
                  } ${plan.recommended ? "rounded-3xl" : ""}`}
                  style={{
                    background: plan.recommended ? "linear-gradient(180deg, #fffdf2, #ffffff)" : "var(--bg)",
                    border: `1px solid ${plan.recommended ? "#f59e0b" : "var(--line)"}`,
                  }}
                >
                  {plan.recommended && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-0.5 text-[10px] font-bold text-white bg-amber-500 shadow-lg shadow-amber-500/30">
                      MOST POPULAR
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink">{plan.name}</span>
                    {plan.recommended && (
                      <span className="rounded-full px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold">BEST VALUE</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-ink">{plan.price}</span>
                    <span className="text-sm meta">{plan.period}</span>
                  </div>
                  <p className="text-xs meta mt-2">{plan.desc}</p>
                  <div className="mt-5 space-y-1.5 flex-1">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-ink-soft">
                        <Check className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5 " />
                        {f}
                      </div>
                    ))}
                  </div>
                  {isCurrent ? (
                    <div className="mt-6 w-full py-3 text-sm font-bold text-center rounded-2xl" style={{ background: "var(--green-50)", color: "var(--green-700)" }}>
                      Current plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={loadingPlan === plan.id}
                      className={`mt-6 w-full py-3 text-sm font-bold text-white rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.99] bg-gradient-to-r ${plan.gradient}`}
                      style={{ opacity: loadingPlan ? 0.6 : 1 }}
                    >
                      {loadingPlan === plan.id ? "Processing..." : ctaLabel}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-5 py-3 text-sm font-medium shadow-xl" style={{ background: "var(--coral-500)", color: "white" }}>
            {error}
          </div>
        )}

      {confirmPlan && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 animate-fade-up" onClick={() => setConfirmPlan(null)}>
            <div className="w-full max-w-sm rounded-2xl p-6 shadow-xl bg-white animate-pop" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-ink">Confirm free upgrade</h3>
              <p className="text-sm meta mt-2">
                You're about to upgrade to the <b>{confirmPlan === "ultra_pro" ? "Ultra" : "Pro"}</b> plan at <b>$0</b> — no payment needed.
                All premium features unlock immediately.
              </p>
              <div className="mt-5 flex gap-3 justify-end">
                <button onClick={() => setConfirmPlan(null)} className="bg-ghost py-2 px-4 text-sm">Cancel</button>
                <button onClick={() => confirmUpgrade(confirmPlan!)} className="btn-green py-2 px-5 text-sm font-semibold">
                  Yes, upgrade me
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trust bar */}
        <section className="py-12 px-6 border-t" style={{ borderColor: "var(--line)" }}>
          <div className="max-w-3xl mx-auto flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2 text-xs meta">
              <Shield className="h-4 w-4" /> 256-bit encrypted payments
            </div>
            <div className="flex items-center gap-2 text-xs meta">
              Razorpay: Cards, UPI, and wallets supported
            </div>
            <div className="flex items-center gap-2 text-xs meta">
              <Crown className="h-4 w-4" style={{ color: "var(--amber-500)" }} /> Cancel anytime from settings
            </div>
          </div>
        </section>
      </main>
    </>
  );
}