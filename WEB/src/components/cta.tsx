import { Link } from "@/i18n/navigation";

const VARIANTS = {
  primary:
    "bg-primary text-white hover:bg-primary-dark border border-transparent",
  secondary:
    "bg-white text-primary border border-primary hover:bg-primary-light",
  ghost: "bg-transparent text-primary border border-border hover:bg-primary-light",
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
      className={`focus-ring inline-flex items-center justify-center rounded-md px-6 py-3 text-base font-medium transition-colors ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
