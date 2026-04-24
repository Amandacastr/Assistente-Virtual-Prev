interface Props {
  size?: number;
  className?: string;
}

/**
 * Prev — consultora previdenciária do Agros.
 * Persona: mulher de meia-idade, acolhedora e profissional.
 * Cabelo castanho com mechas grisalhas, óculos discretos, blazer azul-marinho
 * com lapela dourada (paleta Agros).
 */
export const PrevMascot = ({ size = 120, className }: Props) => (
  <svg
    width={size}
    height={size * (128 / 120)}
    viewBox="0 0 120 128"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Prev, consultora do Agros"
    className={className}
  >
    {/* sombra */}
    <ellipse cx="60" cy="124" rx="34" ry="4" fill="rgba(0,0,0,.22)" />

    {/* ombros / blazer */}
    <path
      d="M18 124 C 22 102, 38 92, 60 92 C 82 92, 98 102, 102 124 Z"
      fill="hsl(210 83% 27%)"
    />
    {/* lapelas */}
    <path d="M60 92 L48 124 L56 124 L60 100 Z" fill="hsl(210 68% 22%)" />
    <path d="M60 92 L72 124 L64 124 L60 100 Z" fill="hsl(210 68% 22%)" />
    {/* blusa */}
    <path d="M52 96 L60 110 L68 96 C 64 94, 56 94, 52 96 Z" fill="#f5f1e6" />
    {/* broche dourado */}
    <circle cx="54" cy="104" r="1.6" fill="hsl(43 70% 55%)" />

    {/* pescoço */}
    <rect x="55" y="82" width="10" height="12" rx="3" fill="hsl(28 45% 78%)" />

    {/* cabelo — parte de trás (bob na altura do queixo) */}
    <path
      d="M28 58 C 28 36, 42 22, 60 22 C 78 22, 92 36, 92 58 L 92 86 C 86 84, 80 84, 76 86 L 76 70 L 44 70 L 44 86 C 40 84, 34 84, 28 86 Z"
      fill="hsl(25 35% 28%)"
    />

    {/* rosto */}
    <ellipse cx="60" cy="58" rx="24" ry="27" fill="hsl(28 50% 82%)" />

    {/* franja lateral com mecha grisalha */}
    <path
      d="M36 44 C 42 32, 56 28, 76 32 C 80 33, 84 36, 84 40 C 78 38, 70 39, 64 42 C 58 45, 50 46, 44 48 C 40 49, 37 48, 36 44 Z"
      fill="hsl(25 35% 28%)"
    />
    <path
      d="M70 34 C 74 34, 78 36, 80 38 C 76 38, 72 38, 68 39 Z"
      fill="hsl(40 12% 78%)"
    />
    <path
      d="M40 46 C 44 44, 48 44, 50 45 C 46 47, 43 48, 41 48 Z"
      fill="hsl(40 12% 78%)"
    />

    {/* brincos dourados */}
    <circle cx="36" cy="64" r="1.8" fill="hsl(43 70% 55%)" />
    <circle cx="84" cy="64" r="1.8" fill="hsl(43 70% 55%)" />

    {/* óculos discretos */}
    <circle cx="50" cy="60" r="6" stroke="hsl(213 60% 20%)" strokeWidth="1.2" fill="rgba(255,255,255,.15)" />
    <circle cx="70" cy="60" r="6" stroke="hsl(213 60% 20%)" strokeWidth="1.2" fill="rgba(255,255,255,.15)" />
    <line x1="56" y1="60" x2="64" y2="60" stroke="hsl(213 60% 20%)" strokeWidth="1.2" />

    {/* sobrancelhas */}
    <path d="M45 53 Q50 51 55 53" stroke="hsl(25 35% 22%)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    <path d="M65 53 Q70 51 75 53" stroke="hsl(25 35% 22%)" strokeWidth="1.4" strokeLinecap="round" fill="none" />

    {/* olhos */}
    <circle cx="50" cy="60" r="1.6" fill="hsl(213 80% 12%)" />
    <circle cx="70" cy="60" r="1.6" fill="hsl(213 80% 12%)" />

    {/* linhas de expressão suaves (meia-idade) */}
    <path d="M42 62 Q44 64 43 66" stroke="hsl(25 30% 60%)" strokeWidth="0.6" fill="none" strokeLinecap="round" />
    <path d="M78 62 Q76 64 77 66" stroke="hsl(25 30% 60%)" strokeWidth="0.6" fill="none" strokeLinecap="round" />

    {/* nariz */}
    <path d="M60 64 Q59 70 60 72 Q61 73 62 72" stroke="hsl(25 35% 60%)" strokeWidth="0.9" fill="none" strokeLinecap="round" />

    {/* batom / sorriso acolhedor */}
    <path d="M53 78 Q60 82 67 78 Q60 80 53 78 Z" fill="hsl(0 50% 45%)" />
    <path d="M53 78 Q60 84 67 78" stroke="hsl(0 55% 35%)" strokeWidth="1.2" fill="none" strokeLinecap="round" />

    {/* bochechas levemente rosadas */}
    <circle cx="44" cy="70" r="2.6" fill="hsl(0 60% 70%)" opacity="0.35" />
    <circle cx="76" cy="70" r="2.6" fill="hsl(0 60% 70%)" opacity="0.35" />
  </svg>
);
