import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";

export const metadata = { title: "Privacy — sleek" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header className="glass sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={26} idPrefix="privacy" />
            <span className="font-bold lowercase">sleek</span>
          </Link>
          <Link href="/login" className="btn-ghost text-sm">Log in</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-14">
        <h1 className="text-3xl font-bold text-ink mb-6">Privacy Policy</h1>
        <div className="card space-y-4 text-sm ink-soft leading-relaxed">
          <Section title="What we collect">
            Only what you give us: your email, a hashed password, your display name, and the tasks and check-ins you log.
            We do not track you across sites, plant cookies from ad networks, or collect telemetry.
          </Section>

          <Section title="How we use it">
            Exclusively to operate sleek for you. We do not run ads, sell data, share information with analytics vendors,
            or provide your personal data to any third party. Your interaction history with the AI coach is stored
            solely for your reference within the app.
          </Section>

          <Section title="Storage and encryption">
            Your password is hashed with bcrypt (12 rounds, industry standard). Session cookies are signed and encrypted
            using iron-session JWT cookies. Data at rest is encrypted by our database provider. Data in transit is
            protected by TLS. The AI coach messages are stored encrypted in our database and are accessed only by you
            within your authenticated session.
          </Section>

          <Section title="Data deletion">
            You can remove your account at any time from Settings → Account management. Deletion removes your data
            from the live database.
          </Section>

          <Section title="Data retention">
            We retain only what you actively use. When you delete your account, your data is removed. We do not
            keep backups beyond the scope necessary for the application to function.
          </Section>

          <Section title="Your rights">
            You may view, edit, export, or permanently delete your account and all its data from Settings at any time.
          </Section>

          <Section title="Contact">
            For privacy questions, use our <Link href="/contact" className="underline" style={{ color: "var(--blue-600)" }}>private contact form</Link> — your message goes directly to the app maintainer
            and no one else.
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