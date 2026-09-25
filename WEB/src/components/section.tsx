const TONES = {
  bg: "bg-bg",
  warm: "bg-bg-warm",
  "primary-light": "bg-primary-light",
} as const;

export function Section({
  id,
  title,
  lead,
  children,
  tone = "bg",
  className = "",
}: {
  id?: string;
  title?: string;
  lead?: string;
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <section id={id} className={`${TONES[tone]} py-16 ${className}`}>
      <div className="container-page">
        {title ? (
          <h2 className="text-2xl font-semibold text-text sm:text-3xl">
            {title}
          </h2>
        ) : null}
        {lead ? (
          <p className="mt-3 max-w-3xl text-text-light">{lead}</p>
        ) : null}
        <div className={title || lead ? "mt-8" : ""}>{children}</div>
      </div>
    </section>
  );
}
