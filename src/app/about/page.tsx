import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";

export const metadata = { title: "About — sleek" };

export default function AboutPage() {
  return (
    <div className="min-h-screen hero-bg">
      <header className="glass sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={26} idPrefix="about" />
            <span className="font-bold lowercase"><span className="aurora-text">sleek</span></span>
          </Link>
          <Link href="/login" className="btn-ghost text-sm">Log in</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-16">
        <div className="label-xs">about the project</div>
        <h1 className="text-4xl font-extrabold text-ink mt-1 mb-6">Embrace the friction and light up the night.</h1>

        <div className="card mb-8">
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-ink text-white text-xl font-bold animate-float">DG</div>
            <div>
              <h2 className="text-xl font-bold text-ink">Dhruv Gupta</h2>
              <p className="text-sm meta mt-0.5">High school student · Founder of sleek</p>
              <p className="mt-3 text-sm ink-soft leading-relaxed">
                Hi! I'm Dhruv, a high school student who got tired of cluttered habit trackers that
                tried to do too much. I wanted something calm, focused, and beautifully simple — built
                around the one habit principle that actually compounds: <b className="text-ink">never miss twice</b>.
                sleek is the result. Every color, every animation, every panel is designed to
                keep you calm and consistent — purple when you act, green only when you've earned it.
              </p>
              <p className="mt-3 text-sm ink-soft leading-relaxed">
                Reach out anytime through the private contact form — happy to chat about habits,
                productivity, or just say hi.
              </p>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/contact" className="card hover:-translate-y-1 transition-transform no-underline">
            <div className="text-2xl mb-2">💬</div>
            <div className="label-xs">contact form</div>
            <div className="text-sm font-semibold text-ink mt-1">Send me a private message</div>
          </Link>
          <Link href="/" className="card hover:-translate-y-1 transition-transform no-underline">
            <div className="text-2xl mb-2">🌱</div>
            <div className="label-xs">project</div>
            <div className="text-sm font-semibold text-ink mt-1">Explore sleek</div>
          </Link>
        </div>

        <div className="mt-10 text-center">
          <Link href="/login" className="btn-aurora">Get started free</Link>
        </div>
      </main>
    </div>
  );
}
