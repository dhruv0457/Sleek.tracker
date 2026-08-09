import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserInfo, canUseAIInsights } from "@/lib/tier";
import { AIInsightsStandalone } from "@/components/panels/AIInsightsStandalone";
import Link from "next/link";
import { ArrowLeft, Sparkles, ArrowUpRight } from "lucide-react";

export const metadata = { title: "AI Insights — sleek" };

export default async function AIInsightsRoute() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const user = await getUserInfo(session.userId);
  const hasAccess = user && canUseAIInsights(user);

  if (!hasAccess) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--bg)" }}>
        <div className="grid h-16 w-16 place-items-center rounded-2xl" style={{ background: "linear-gradient(135deg, var(--blue-50), #ecfeff)" }}>
          <Sparkles className="h-7 w-7" style={{ color: "var(--blue-600)" }} />
        </div>
        <h2 className="text-xl font-bold text-ink">Ultra Pro Feature</h2>
        <p className="text-sm meta max-w-xs text-center">AI Insights is available on Ultra Pro. Start your trial or upgrade to unlock personalized habit coaching.</p>
        <div className="flex gap-3 mt-2">
          <Link href="/dashboard" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition hover:border-ink" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </Link>
          <Link href="/pricing" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition hover:opacity-90" style={{ background: "var(--ink)", boxShadow: "0 4px 14px -4px rgba(0,0,0,0.3)" }}>
            View Plans <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header
        className="app-header px-6 py-3.5 shrink-0 flex items-center gap-3"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--line)" }}
      >
        <a
          href="/dashboard"
          className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[var(--bg-2)] text-ink-soft hover:text-ink transition"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <div>
          <h1 className="text-lg font-bold text-ink leading-tight">AI Insights</h1>
          <div className="text-[11px] meta">Your personal data-driven coach, powered by NVIDIA NIM</div>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <AIInsightsStandalone embedded />
      </div>
    </div>
  );
}