import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";

export const metadata = { title: "Terms — sleek" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream-100">
      <header className="glass sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={26} idPrefix="terms" />
            <span className="font-bold lowercase"><span className="aurora-text">sleek</span></span>
          </Link>
          <Link href="/login" className="btn-ghost text-sm">Log in</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-14">
        <h1 className="text-3xl font-bold text-ink mb-6">Terms & Conditions</h1>
        <div className="card space-y-4 text-sm ink-soft leading-relaxed">
          <Section title="1. Acceptance of terms">
            By using sleek, you agree to these terms. If you do not accept them, please do not use the service.
          </Section>
          <Section title="2. Your account">
            You are responsible for keeping your password secure. You must be at least 13 years old to create an account.
            Activity that is fraudulent, abusive, or harmful to others is not permitted and may result in account termination.
          </Section>
          <Section title="3. Your data">
            sleek stores only the information you provide — email, password (hashed), tasks, check-ins, and badges.
            Your data is encrypted at rest and in transit. We do not sell, share, or rent your personal data to any
            third party under any circumstances. You can export or permanently delete your data at any time from Settings.
          </Section>
          <Section title="4. Acceptable use">
            You agree not to misuse the service, attempt to access other users' data, or build automated scraping tools
            against sleek. Fair personal and educational use is encouraged.
          </Section>
          <Section title="5. Service availability">
            sleek is provided "as is" without warranty. We may update, change, or discontinue features with notice.
            We are not liable for any loss of task data resulting from service interruptions.
          </Section>
          <Section title="6. Cancellation">
            You can remove your account at any time from Settings → Account management.
          </Section>
          <Section title="7. Changes to these terms">
            We may update these terms occasionally. Continued use after changes means you accept the updated terms.
          </Section>
          <Section title="8. Contact">
            Questions? Use our <Link href="/contact" className="text-green-600 underline">private contact form</Link> — your message goes directly to the maker.
          </Section>
        </div>
        <p className="mt-6 text-xs meta">Last updated: {new Date().getFullYear()}</p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-bold text-ink mb-1">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
