"use client";

import { useState } from "react";
import { X, Lock } from "lucide-react";
import Link from "next/link";

export function PaywallModal({ featureName, onClose }: { featureName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 animate-fade-up" onClick={onClose}>
      <div className="panel w-full max-w-md animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <h3 className="text-base font-bold text-ink">Unlock {featureName}</h3>
          </div>
          <button onClick={onClose} className="hover:text-ink transition rounded-full p-1" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 text-center space-y-4">
          <p className="text-sm meta">{featureName} is a premium feature.</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/pricing"
              onClick={onClose}
              className="rounded-2xl px-6 py-3 text-sm font-bold text-white transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #22a558, #1e8b4c)" }}
            >
              View plans from $2/mo
            </Link>
            <button onClick={onClose} className="rounded-2xl px-5 py-3 text-sm font-medium transition" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>Maybe later</button>
          </div>
        </div>
      </div>
    </div>
  );
}