interface PackageIconProps {
  abbr: string;
  color: string;
  /** px size of the outer box — default 40 (w-10 h-10) */
  size?: number;
}

/**
 * Renders a styled abbreviation badge — the unique identity marker for each
 * BackendKit package. Uses a gradient derived from the package accent color
 * so each badge feels alive without relying on generic emojis.
 */
export default function PackageIcon({ abbr, color, size = 40 }: PackageIconProps) {
  const fontSize =
    size >= 56 ? 20 :
    size >= 48 ? 17 :
    size >= 40 ? 14 :
    size >= 32 ? 12 :
                  9;

  return (
    <div
      className="flex items-center justify-center flex-shrink-0 rounded-xl select-none"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}28, ${color}0c)`,
        border: `1px solid ${color}38`,
      }}
    >
      <span
        className="font-mono font-black leading-none tracking-tight"
        style={{ fontSize, color }}
      >
        {abbr}
      </span>
    </div>
  );
}
