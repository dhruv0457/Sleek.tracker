import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function PublicHeader() {
  return (
    <header className="glass sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
        <Logo href="/" />
        <Link href="/login" className="btn-ghost text-sm">Log in</Link>
      </div>
    </header>
  );
}
