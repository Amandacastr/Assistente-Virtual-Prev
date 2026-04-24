import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, TrendingUp, Heart } from "lucide-react";
import { PrevMascot } from "@/components/PrevMascot";

const Index = () => {
  return (
    <div className="relative min-h-screen flex flex-col bg-agros-radial overflow-x-hidden">
      {/* fundo grid sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0 0% 100% / 1) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100% / 1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-7 py-4 border-b border-white/10 backdrop-blur-md bg-[hsl(213_80%_12%/0.55)]">
        <span className="text-white font-semibold tracking-wide text-lg">Agros</span>
        <div className="h-5 w-px bg-white/20" />
        <span className="text-white/50 text-xs">Assistente de Previdência</span>
        <div className="ml-auto hidden sm:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
          <ShieldCheck className="h-3 w-3 opacity-70" />
          Regulamentado pela PREVIC
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-5 pt-12 pb-8">
        <div className="relative mb-6">
          <span className="absolute inset-[-14px] rounded-full border-2 border-accent/25" />
          <span className="absolute inset-[-28px] rounded-full border-2 border-accent/10" />
          <PrevMascot size={120} />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-medium uppercase tracking-widest text-white/75 mb-5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
          Online agora
        </div>

        <h1 className="font-display text-white text-center text-balance text-5xl md:text-6xl font-semibold leading-tight max-w-xl">
          Olá! Eu sou o <em className="text-accent not-italic relative">Prev</em>
        </h1>
        <p className="mt-3 text-center text-white/55 max-w-md text-[15px] font-light leading-relaxed">
          Tire suas dúvidas sobre os planos de previdência do Agros.
        </p>

        <p className="mt-8 mb-4 text-[12px] uppercase tracking-widest text-white/40">
          Selecione um plano
        </p>

        <div className="grid sm:grid-cols-2 gap-5 w-full max-w-3xl">
          <PlanCard
            to="/chat/invest"
            tag="Aberto a novas adesões"
            tagTone="blue"
            icon={<TrendingUp className="h-6 w-6 text-primary-glow" />}
            title="InvestPrev"
            desc="Plano de Contribuição Definida aberto a qualquer pessoa vinculada a um instituidor."
            cta="Conversar sobre InvestPrev"
            ctaTone="blue"
          />
          <PlanCard
            to="/chat/vida"
            tag="Fechado para novas adesões"
            tagTone="gold"
            icon={<Heart className="h-6 w-6 text-accent" />}
            title="VidaPrev"
            desc="Plano que recebeu os participantes e recursos do antigo Plano B (UFV)."
            cta="Conversar sobre VidaPrev"
            ctaTone="gold"
          />
        </div>
      </main>

      <footer className="relative z-10 px-5 py-5 border-t border-white/10 bg-[hsl(213_80%_12%/0.6)] backdrop-blur-md flex flex-col items-center gap-2 text-center">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-white/50 text-[12.5px]">
          <a href="https://www.agros.org.br" target="_blank" rel="noreferrer" className="hover:text-white/80 transition">
            agros.org.br
          </a>
          <span>(31) 3899-6550</span>
          <a href="https://www.instagram.com/agrosprevsaude" target="_blank" rel="noreferrer" className="hover:text-white/80 transition">
            @agrosprevsaude
          </a>
        </div>
        <p className="text-[11px] text-white/30">© Agros — Instituto UFV de Seguridade Social</p>
      </footer>
    </div>
  );
};

interface CardProps {
  to: string;
  tag: string;
  tagTone: "blue" | "gold";
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  ctaTone: "blue" | "gold";
}

const PlanCard = ({ to, tag, tagTone, icon, title, desc, cta, ctaTone }: CardProps) => {
  const tagCls =
    tagTone === "blue"
      ? "bg-primary-glow/30 text-sky-200 border-sky-300/20"
      : "bg-accent/20 text-accent-glow border-accent/30";
  const iconWrapCls =
    tagTone === "blue"
      ? "bg-primary-glow/25 border-primary-glow/40"
      : "bg-accent/15 border-accent/30";
  const btnCls =
    ctaTone === "blue"
      ? "bg-primary-glow text-white"
      : "bg-accent/90 text-[hsl(30_40%_8%)]";
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-3xl glass p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card)] hover:border-white/20"
    >
      <span
        className={`absolute top-4 right-4 rounded-full border px-2.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ${tagCls}`}
      >
        {tag}
      </span>
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${iconWrapCls} mb-4`}>
        {icon}
      </div>
      <h2 className="font-display text-3xl font-semibold text-white mb-2">{title}</h2>
      <p className="text-[13.5px] font-light text-white/55 leading-relaxed mb-6">{desc}</p>
      <span
        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-all group-hover:gap-3 ${btnCls}`}
      >
        {cta} <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
};

export default Index;
