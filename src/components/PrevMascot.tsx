interface Props {
  size?: number;
  className?: string;
}

export const PrevMascot = ({ size = 120, className }: Props) => (
  <svg
    width={size}
    height={size * (128 / 120)}
    viewBox="0 0 120 128"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Prev, assistente do Agros"
    className={className}
  >
    <ellipse cx="60" cy="122" rx="36" ry="6" fill="rgba(0,0,0,.25)" />
    <path d="M60 6 L104 22 L104 68 C104 96 60 118 60 118 C60 118 16 96 16 68 L16 22 Z" fill="hsl(210 83% 27%)" />
    <path d="M60 10 L100 25 L100 68 C100 93 60 113 60 113 C60 113 20 93 20 68 L20 25 Z" fill="hsl(210 68% 39%)" />
    <path d="M60 8 L105 24 L105 68 C105 98 60 120 60 120 C60 120 15 98 15 68 L15 24 Z" stroke="hsl(43 53% 55%)" strokeWidth="2.5" fill="none" />
    <path d="M35 26 Q60 18 85 26" stroke="rgba(255,255,255,.2)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    <circle cx="60" cy="67" r="30" fill="#edf2f7" />
    <circle cx="60" cy="67" r="29" fill="white" />
    {/* olhos */}
    <circle cx="50" cy="64" r="3.5" fill="hsl(213 80% 12%)" />
    <circle cx="70" cy="64" r="3.5" fill="hsl(213 80% 12%)" />
    <circle cx="51" cy="63" r="1" fill="white" />
    <circle cx="71" cy="63" r="1" fill="white" />
    {/* sorriso */}
    <path d="M50 75 Q60 82 70 75" stroke="hsl(213 80% 12%)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    {/* bochechas */}
    <circle cx="44" cy="73" r="3" fill="hsl(43 53% 55%)" opacity="0.45" />
    <circle cx="76" cy="73" r="3" fill="hsl(43 53% 55%)" opacity="0.45" />
  </svg>
);
