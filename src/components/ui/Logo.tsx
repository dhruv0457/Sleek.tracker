import Link from "next/link";
import { BrandMark } from "./BrandMark";

/* sleek logo: monochrome crescent moon + spark. The wordmark is plain ink,
   which inverts automatically on a dark parent (we just keep it ink here
   because the sidebar is always light). */
export function Logo({
  size = 28,
  href = "/",
  link = true,
  variant = "light"
}: {
  size?: number;
  href?: string;
  color?: string;   /* legacy prop, ignored */
  link?: boolean;
  variant?: "light" | "compact" | "no-text";
}) {
  const mark = <BrandMark size={size} idPrefix="logo" rounded={7} />;
  const text =
    variant === "no-text" ? null : (
      <span className="font-semibold tracking-tight text-ink lowercase">sleek</span>
    );
  const content = (
    <span className="flex items-center gap-2">
      {mark}{text}
    </span>
  );
  if (!link) return content;
  return (
    <Link href={href} className="flex items-center gap-2">
      {mark}{text}
    </Link>
  );
}
