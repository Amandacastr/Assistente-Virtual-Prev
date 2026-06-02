// Componente PrevMascot — mascote oficial do Agros (Prevnildo)
import prevnildoAsset from "@/assets/prevnildo.jpg.asset.json";

interface PrevMascotProps {
  size?: number;
  className?: string;
}

export const PrevMascot = ({ size = 80, className = "" }: PrevMascotProps) => (
  <img
    src={prevnildoAsset.url}
    alt="Prevnildo — assistente virtual do Agros"
    width={size}
    height={size}
    className={`rounded-full object-cover object-[50%_20%] bg-gray-100 ${className}`}
    style={{ width: size, height: size }}
  />
);
