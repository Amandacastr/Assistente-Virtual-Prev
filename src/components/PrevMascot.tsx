// Componente PrevMascot — mascote oficial do Agros (Prev)
import prevAsset from "@/assets/prev-mascot.jpg.asset.json";

interface PrevMascotProps {
  size?: number;
  className?: string;
}

export const PrevMascot = ({ size = 80, className = "" }: PrevMascotProps) => (
  <img
    src={prevAsset.url}
    alt="Prev — assistente virtual do Agros"
    width={size}
    height={size}
    className={`rounded-full object-cover object-[50%_20%] bg-gray-100 ${className}`}
    style={{ width: size, height: size }}
  />
);
