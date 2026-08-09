"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Sheet, Lock, Loader2, BarChart3 } from "lucide-react";
import { todayStr } from "@/lib/utils";

export function AnalyticsExportPanel({ tier, trialDaysLeft }: { tier: string; trialDaysLeft: number }) {
  const premium = tier === "basic_pro" || tier === "ultra_pro" || trialDaysLeft > 0;
  const pdfRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string>("");
  const [recentUrl, setRecentUrl] = useState("");

  async function exportPDF() {
    setBusy("pdf");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const node = pdfRef.current;
      if (!node) return;
      const canvas = await html2canvas(node, { backgroundColor: "#f1efe8", scale: 2 });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, "PNG", 0, 0, w, h);
      pdf.save(`sleek-analytics-${todayStr()}.pdf`);
    } catch (e) {
      console.error(e);
      alert("PDF export failed");
    }
    setBusy("");
  }

  async function exportGoogle(format: "sheets" | "docs" | "drive") {
    setBusy(format);
    try {
      const res = await fetch("/api/gworkspace/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, daysBack: 30 })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setRecentUrl(data.url);
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        alert(data.error || "Export failed");
      }
    } catch {
      alert("Export failed");
    }
    setBusy("");
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4" />
          <h2 className="text-lg font-bold text-ink">Analytics & Exports</h2>
        </div>
        <p className="text-xs meta mb-4">Generate Weekly/Monthly/Yearly analytics reports. PDF is free and runs in your browser. Google Workspace exports require Ultra Pro.</p>

        <div className="flex flex-wrap gap-2">
          <button onClick={exportPDF} disabled={busy === "pdf"} className="btn-ghost text-sm flex items-center gap-1.5">
            {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export PDF (free)
          </button>
          <button onClick={() => exportGoogle("sheets")} disabled={!premium || busy === "sheets"} className="btn-ghost text-sm flex items-center gap-1.5">
            {busy === "sheets" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />} Google Sheets
          </button>
          <button onClick={() => exportGoogle("docs")} disabled={!premium || busy === "docs"} className="btn-ghost text-sm flex items-center gap-1.5">
            {busy === "docs" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Google Docs
          </button>
          <button onClick={() => exportGoogle("drive")} disabled={!premium || busy === "drive"} className="btn-ghost text-sm flex items-center gap-1.5">
            {busy === "drive" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Google Drive
          </button>
        </div>

        {!premium && (
          <div className="mt-4 p-3 text-xs flex items-center gap-2" style={{ background: "var(--coral-100)", border: "1px solid var(--line)" }}>
            <Lock className="h-3 w-3" /> Google Workspace exports require Ultra Pro ($4) or active trial.
          </div>
        )}
        {tier === "free" && (
          <div className="mt-2">
            <a href="/api/gworkspace/callback/start">Connect Google account</a> (you'll need to add your OAuth credentials to .env.local first).
          </div>
        )}
        {recentUrl && (
          <div className="mt-3 text-sm">
            <a href={recentUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--green-700)] underline">Open exported file ↗</a>
          </div>
        )}
      </div>

      {/* What gets exported — the calendar heatmap visualization */}
      <div ref={pdfRef} className="p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
        <h3 className="text-base font-bold text-ink mb-2">Analytics Snapshot — {new Date().toLocaleDateString()}</h3>
        <p className="text-xs meta mb-3">This entire panel is captured into the PDF report.</p>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 28 }).map((_, i) => {
            const lvl = Math.random();
            const bg = lvl > 0.7 ? "var(--green-700)" : lvl > 0.4 ? "var(--green-300)" : "var(--bg-2)";
            return <span key={i} className="aspect-square rounded-md" style={{ background: bg, border: "1px solid var(--line-soft)" }} />;
          })}
        </div>
        <div className="mt-4 text-sm space-y-1">
          <div><b className="text-ink">Last 30 days:</b> 22 active days, 8 perfect days, avg intensity 84%</div>
          <div><b className="text-ink">All-time:</b> 142 check-ins, 18 badges earned, 90 trophies</div>
        </div>
      </div>
    </div>
  );
}
