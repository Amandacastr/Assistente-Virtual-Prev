import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, TrendingUp, Shield, Phone, Globe, Instagram, MessagesSquare } from "lucide-react";
import { PrevMascot } from "@/components/PrevMascot";
import { AgrosLogo } from "@/components/AgrosLogo";

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
        {/* Logo no lugar do texto "Agros" */}
        <AgrosLogo height={30} className="brightness-0 invert" />
        <div className="h-5 w-px bg-white/20" />
        <span className="text-white/50 text-xs">Assistente de Previdência</span>
        <div className="ml-auto hidden sm:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
          <ShieldCheck className="h-3 w-3 opacity-70" />
          Regulamentado pela PREVIC
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-5 pt-12 pb-8">
        {/* Mascote — persona humana */}
        <div className="relative mb-6">
          <span className="absolute inset-[-14px] rounded-full border-2 border-accent/25 animate-pulse-slow" />
          <span className="absolute inset-[-28px] rounded-full border-2 border-accent/10 animate-pulse-slow" />
          <PrevMascot
            size={120}
            className="ring-4 ring-accent/30 shadow-[0_0_40px_hsl(43_55%_55%/0.2)]"
          />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-medium uppercase tracking-widest text-white/75 mb-5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
          Online agora
        </div>

        <h1 className="font-display text-white text-center text-balance text-5xl md:text-6xl font-semibold leading-tight max-w-xl">
          Olá! Eu sou a <em className="text-accent not-italic relative">Prev</em>
        </h1>
        <p className="mt-3 text-center text-white/55 max-w-md text-[15px] font-light leading-relaxed">
          Tire suas dúvidas sobre os planos de previdência do Agros.
        </p>

        <p className="mt-8 mb-4 text-[12px] uppercase tracking-widest text-white/40">
          Selecione um plano
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full max-w-5xl items-stretch">
          {/* InvestPrev — botão com indicador de ação */}
          <PlanCard
            to="/chat/invest"
            tag="Aberto a novas adesões"
            tagTone="blue"
            icon={<TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary-glow" />}
            title="InvestPrev"
            desc="Plano de Contribuição Definida. Você escolhe quanto investir — a partir de R$ 100/mês — e constrói sua reserva no próprio ritmo."
            cta="Conversar sobre InvestPrev"
            ctaTone="blue"
          />
          {/* VidaPrev — tag exclusivo, ícone escudo */}
          <PlanCard
            to="/chat/vida"
            tag="Plano exclusivo"
            tagTone="gold"
            icon={<Shield className="h-6 w-6 text-accent" />}
            title="VidaPrev"
            desc="Plano exclusivo para participantes transferidos pelo Termo de Conciliação de 2021. Tire dúvidas sobre benefício, resgate e IR."
            cta="Conversar sobre VidaPrev"
            ctaTone="gold"
          />
          {/* Outros Assuntos — saúde, boletos, notícias e admin */}
          <PlanCard
            to="/chat/outros"
            tag="Demais demandas"
            tagTone="blue"
            icon={<MessagesSquare className="h-6 w-6 text-primary-glow" />}
            title="Outros Assuntos"
            desc="Tire suas dúvidas sobre plano de saúde, emissão de boletos, mensalidades, notícias e demandas administrativas gerais do Agros."
            cta="Conversar sobre Outros Assuntos"
            ctaTone="blue"
          />
        </div>
      </main>

      {/* Rodapé — apenas ícones clicáveis */}
      <footer className="relative z-10 px-5 py-5 border-t border-white/10 bg-[hsl(213_80%_12%/0.6)] backdrop-blur-md flex flex-col items-center gap-3 text-center">
        <div className="flex items-center justify-center gap-5">
          {/* Site */}
          <a
            href="https://www.agros.org.br"
            target="_blank"
            rel="noreferrer"
            aria-label="Site do Agros"
            title="agros.org.br"
            className="text-white/40 hover:text-white/80 transition"
          >
            <Globe className="h-4.5 w-4.5 h-[18px] w-[18px]" />
          </a>
          {/* WhatsApp */}
          <a
            href="https://wa.me/553138996550"
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp Agros"
            title="WhatsApp (31) 3899-6550"
            className="text-white/40 hover:text-white/80 transition"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-[18px] w-[18px]"
              aria-hidden="true"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>
          {/* Telefone */}
          <a
            href="tel:3138996550"
            aria-label="Ligar para o Agros"
            title="(31) 3899-6550"
            className="text-white/40 hover:text-white/80 transition"
          >
            <Phone className="h-[18px] w-[18px]" />
          </a>
          {/* Instagram */}
          <a
            href="https://www.instagram.com/agrosprevsaude/"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram Agros"
            title="@agrosprevsaude"
            className="text-white/40 hover:text-white/80 transition"
          >
            <Instagram className="h-[18px] w-[18px]" />
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
  showArrowPulse?: boolean;
}

const PlanCard = ({ to, tag, tagTone, icon, title, desc, cta, ctaTone, showArrowPulse }: CardProps) => {
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
      ? "bg-sky-700 text-white border-2 border-sky-700"
      : "bg-accent/90 text-[hsl(30_40%_8%)] border border-accent";

  return (
    <Link
      to={to}
      className="group relative block transition-all duration-300 hover:-translate-y-1.5"
    >
      <div className="overflow-hidden rounded-3xl glass p-7 transition-all duration-300 group-hover:shadow-[var(--shadow-card)] group-hover:border-white/20">
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

        {/* Botão com indicador de ação */}
        <span
          className={`relative inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-all group-hover:gap-3 ${btnCls}`}
        >
          {showArrowPulse && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-60 animate-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-white opacity-80" />
            </span>
          )}
          {cta} <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
};

export default Index;
