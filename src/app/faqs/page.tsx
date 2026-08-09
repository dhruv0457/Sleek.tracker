import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";

export const metadata = { title: "FAQs — sleek" };

const FAQS = [
  {
    q: "Is sleek really free?",
    a: "Yes. The core tracker — unlimited tasks, calendar, streaks, trophies, and statistics — is free forever with no ads."
  },
  {
    q: "Do I need a credit card to sign up?",
    a: "No. Sign up with just an email and password. Cancel anytime."
  },
  {
    q: "What do the calendar cell colors mean?",
    a: "Dark green = fully completed. Light green = ~80% done (high partial). Dark amber = moderate (40-60%). Light amber = low done. Dark blue = multitasked fully. Light blue = multitasked partially. White = skipped."
  },
  {
    q: "What is auto-skip?",
    a: "If a habit's target minutes (say 15 minutes) pass for a day without your action, the app auto-marks that cell as skipped (white). You can still tap to override and mark it done."
  },
  {
    q: "What are badges and how do I unlock them?",
    a: "Badges are milestone achievements — first check-in, 3-day streak, 7-day streak, perfect week, multitasker, etc. Locked ones show as '?' with a faint glow. When you unlock one, a celebratory modal appears with share buttons (WhatsApp, Telegram, X, LinkedIn, Instagram)."
  },
  {
    q: "Can I delete my account?",
    a: "Yes, from Settings → Danger zone. You must type your email and password to confirm. Deletion is permanent and irreversible."
  },
  {
    q: "Is my data shared or sold?",
    a: "Never. We don't sell data and we don't run third-party ads. See our Privacy page for details."
  },
  {
    q: "Who built this?",
    a: "Dhruv Gupta, a high school student. Reach out through the private contact form on the Contact page."
  }
];

export default function FaqsPage() {
  return (
    <div className="min-h-screen bg-cream-100">
      <header className="glass sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={26} idPrefix="faqs" />
            <span className="font-bold lowercase"><span className="aurora-text">sleek</span></span>
          </Link>
          <Link href="/login" className="btn-ghost text-sm">Log in</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-14">
        <div className="label-xs">FAQs</div>
        <h1 className="text-3xl font-bold text-ink mt-1 mb-6">Frequently asked questions</h1>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <details key={i} className="card group">
              <summary className="font-semibold text-ink cursor-pointer list-none flex items-center justify-between">
                {f.q}
                <span className="text-purple-600 text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm ink-soft leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </main>
    </div>
  );
}
