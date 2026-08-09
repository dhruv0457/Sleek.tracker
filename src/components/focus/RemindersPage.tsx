"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RemindersPanel } from "@/components/panels/RemindersPanel";
import { Sparkles, ArrowRight } from "lucide-react";

export function RemindersPageClient() {
  const [tier, setTier] = useState<string>("free");
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setTier(d.user?.tier ?? "free");
        setTrialDaysLeft(d.user?.trialDaysLeft ?? 0);
      })
      .catch(() => {});
  }, []);

  const showPremiumBanner = tier !== "ultra_pro" && !trialDaysLeft;

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] w-full mx-auto">
      {showPremiumBanner && (
        <div className="mb-6 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 animate-fade-up"
          style={{ background: "linear-gradient(135deg, #eef2ff, #fff7ed)", border: "1px solid #c7d2fe" }}>
          <div className="grid h-12 w-12 place-items-center rounded-xl shrink-0"
            style={{ background: "linear-gradient(135deg, #6366f1, #f59e0b)", boxShadow: "0 8px 24px rgba(99,102,241,0.35)" }}>
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-ink">
              {tier === "free" ? "Unlock Reminders + more" : "Upgrade to Ultra Pro"}
            </div>
            <div className="text-xs meta mt-0.5 leading-relaxed">
              {tier === "free"
                ? "Email reminders, custom alerts, and AI insights — starting at $2/mo."
                : "Unlimited reminders, AI insights, and Google Workspace exports — $4/mo."}
            </div>
          </div>
          <Link href="/pricing"
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 6px 20px rgba(99,102,241,0.4)" }}>
            View plans <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
      <RemindersPanel tier={tier} trialDaysLeft={trialDaysLeft} />
    </div>
  );
}
