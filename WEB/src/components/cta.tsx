import { Link } from "@/i18n/navigation";

const VARIANTS = {
  primary:
    "text-primary-dark underline decoration-primary-dark/40 decoration-2 underline-offset-8 hover:decoration-primary-dark",
  secondary:
    "text-ink underline decoration-ink/30 decoration-2 underline-offset-8 hover:text-primary-dark hover:decoration-primary-dark/60",
  dark: "text-primary-dark underline decoration-primary-dark/40 decoration-2 underline-offset-8 hover:decoration-primary-dark",
  ghost:
    "text-text-light underline decoration-transparent underline-offset-8 hover:text-primary-dark hover:decoration-primary-dark/60",
} as const;

export function CtaLink({
  href,
  variant = "primary",
  children,
  className = "",
}: {
  href: string;
  variant?: keyof typeof VARIANTS;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`focus-ring inline-flex items-center gap-2 text-sm sm:text-base font-bold transition-colors ${VARIANTS[variant]} ${className}`}
    >
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}
