const TONES = {
  bg: "bg-paper",
  warm: "bg-white",
  "primary-light": "bg-primary-light",
} as const;

export function Section({
  id,
  num,
  title,
  lead,
  children,
  tone = "bg",
  variant = "default",
  className = "",
}: {
  id?: string;
  num?: string;
  title?: string;
  lead?: string;
  children?: React.ReactNode;
  tone?: keyof typeof TONES;
  variant?: "default" | "page-head";
  className?: string;
}) {
  if (variant === "page-head") {
    return (
      <section
        id={id}
        className={`border-b border-border bg-paper py-16 sm:py-24 ${className}`}
      >
        <div className="container-page">
          {title ? (
            <h1
              className="max-w-4xl text-3xl font-bold leading-[1.3] tracking-tight text-ink sm:text-4xl lg:text-5xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {title}
            </h1>
          ) : null}
          {lead ? (
            <p className="mt-5 max-w-3xl text-base sm:text-lg leading-relaxed text-text-light">
              {lead}
            </p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </section>
    );
  }

  return (
    <section
      id={id}
      className={`border-b border-border last:border-0 ${TONES[tone]} py-20 sm:py-28 ${className}`}
    >
      <div className="container-page">
        {title ? (
          <header className="border-b border-border pb-6">
            {num ? (
              <p className="text-sm font-semibold tracking-[0.2em] text-primary-dark">
                {num}
              </p>
            ) : null}
            <h2
              className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {title}
            </h2>
            {lead ? (
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-text-light">
                {lead}
              </p>
            ) : null}
          </header>
        ) : null}
        {children ? (
          <div className={title || lead ? "mt-10" : ""}>{children}</div>
        ) : null}
      </div>
    </section>
  );
}
