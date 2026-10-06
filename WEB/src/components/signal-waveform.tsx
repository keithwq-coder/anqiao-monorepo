type SignalWaveformProps = {
  labels: [string, string, string];
  className?: string;
};

export function SignalWaveform({ labels, className }: SignalWaveformProps) {
  const breathPath =
    "M0 90 C 40 90, 55 38, 85 38 C 115 38, 130 90, 170 90 C 200 90, 215 38, 245 38 C 275 38, 290 90, 330 90 C 360 90, 375 38, 405 38 C 435 38, 450 90, 490 90 C 520 90, 535 38, 565 38 C 595 38, 610 90, 650 90 C 680 90, 695 38, 725 38 C 755 38, 770 90, 810 90 C 840 90, 855 38, 885 38 C 915 38, 930 90, 960 90";
  const microPath =
    "M0 122 L 24 122 L 30 114 L 38 128 L 46 118 L 62 122 L 96 122 L 102 116 L 110 126 L 118 120 L 150 122 L 210 122 L 216 115 L 224 127 L 232 119 L 260 122 L 340 122 L 348 116 L 356 126 L 364 118 L 400 122 L 470 122 L 478 117 L 486 125 L 494 119 L 530 122 L 620 122 L 628 115 L 636 127 L 644 118 L 690 122 L 770 122 L 778 116 L 786 126 L 794 120 L 840 122 L 920 122 L 928 117 L 936 125 L 944 119 L 960 122";
  const exitPath =
    "M0 152 L 430 152 L 430 138 L 452 138 L 452 166 L 474 166 L 474 152 L 508 152 L 508 138 L 530 138 L 530 166 L 552 166 L 552 152 L 700 152 L 700 138 L 722 138 L 722 166 L 744 166 L 744 152 L 960 152";

  return (
    <figure className={className} aria-label="感知信号示意：呼吸、体动、离床">
      <svg
        viewBox="0 0 960 190"
        className="h-auto w-full"
        role="img"
        aria-hidden="true"
      >
        {[46, 90, 134, 178].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="960"
            y2={y}
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        ))}
        {[240, 480, 720].map((x) => (
          <line
            key={x}
            x1={x}
            y1="0"
            x2={x}
            y2="190"
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        ))}
        <path
          d={breathPath}
          fill="none"
          stroke="var(--color-primary-dark)"
          strokeWidth="1.5"
        />
        <path
          d={microPath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.25"
        />
        <path
          d={exitPath}
          fill="none"
          stroke="var(--color-text-light)"
          strokeWidth="1.25"
          strokeDasharray="1 3"
        />
      </svg>
      <figcaption className="mt-3 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-3 text-xs text-text-light">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 bg-primary-dark" aria-hidden="true" />
          {labels[0]}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 bg-primary" aria-hidden="true" />
          {labels[1]}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-6 border-t-2 border-dotted border-text-light"
            aria-hidden="true"
          />
          {labels[2]}
        </span>
      </figcaption>
    </figure>
  );
}
