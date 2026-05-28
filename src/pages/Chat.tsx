import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, Send, RefreshCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { PrevMascot } from "@/components/PrevMascot";
import { AgrosLogo } from "@/components/AgrosLogo";
import { toast } from "sonner";

type Plan = "invest" | "vida" | "outros";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const PLAN_META: Record<Plan, { name: string; intro: string; suggestions: string[] }> = {
  invest: {
    name: "InvestPrev",
    intro:
      "Olá! Sou a Prev, assistente do Agros para o **InvestPrev**. Como posso te ajudar hoje?",
    suggestions: [
      "Qual o valor mínimo de contribuição?",
      "Quais as vantagens do InvestPrev?",
      "Como funciona o resgate?",
      "Qual a diferença entre regime progressivo e regressivo?",
    ],
  },
  vida: {
    name: "VidaPrev",
    intro:
      "Olá! Sou a Prev, assistente do Agros para o **VidaPrev**. Como posso te ajudar hoje?",
    suggestions: [
      "O que é o VidaPrev?",
      "Como é calculado o benefício de renda mensal?",
      "Posso fazer resgate parcial?",
      "O que acontece com o saldo após o falecimento?",
    ],
  },
  outros: {
    name: "Outros Assuntos",
    intro:
      "Olá! Sou a Prev, assistente do Agros. Aqui posso te ajudar com **plano de saúde, boletos, mensalidades, notícias e demandas administrativas**. Como posso ajudar?",
    suggestions: [
      "Como faço para emitir um boleto?",
      "Qual o prazo de pagamento da mensalidade?",
      "Como acesso o plano de saúde?",
      "Quais as últimas notícias do Agros?",
    ],
  },
};

const getUserId = () => {
  let id = localStorage.getItem("agros_user_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("agros_user_id", id);
  }
  return id;
};

const Chat = () => {
  const { plan } = useParams<{ plan: string }>();
  if (plan !== "invest" && plan !== "vida" && plan !== "outros") return <Navigate to="/" replace />;

  const meta = PLAN_META[plan];
  const userId = useMemo(() => getUserId(), []);
  const storageKey = `agros_chat_${plan}`;

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as Message[];
    } catch {/* ignore */}
    return [{ id: "intro", role: "assistant", content: meta.intro }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal de coleta de contato para transbordo
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffName, setHandoffName] = useState(
    () => localStorage.getItem("agros_user_name") || ""
  );
  const [handoffPhone, setHandoffPhone] = useState(
    () => localStorage.getItem("agros_user_phone") || ""
  );
  // Contexto pendente para o webhook (preenchido ao detectar handoff)
  const pendingHandoffRef = useRef<{
    history: Message[];
    motivo: string;
    mensagem: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll ao receber nova mensagem
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages, storageKey]);

  // Auto-resize do textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 130) + "px";
  };

  const HANDOFF_MSG =
    "Aguarde, você será atendido em breve por um de nossos especialistas.";
  const HANDOFF_WEBHOOK = "https://testimony-citations-extraordinary-irc.trycloudflare.com/webhook/transbordo";

  const USER_HANDOFF_PATTERNS = [
    /falar\s+com\s+(um\s+)?(atendente|humano|pessoa|algu[ée]m|especialista|consultor|operador)/i,
    /atendente\s+humano/i,
    /quero\s+falar\s+com\s+algu[ée]m/i,
    /transbordo/i,
    /atendimento\s+humano/i,
  ];

  const AI_HANDOFF_PATTERNS = [
    /n[ãa]o\s+(sei|tenho|possuo|consigo|encontrei|localizei|disponho|tenho\s+como)/i,
    /n[ãa]o\s+(tenho|possuo|encontrei)\s+(essa|a)\s+informa[çc][ãa]o/i,
    /n[ãa]o\s+(fui|estou)\s+(capaz|apto)/i,
    /sem\s+informa[çc][ãa]o/i,
    /n[ãa]o\s+posso\s+(ajudar|responder|informar)/i,
    /fora\s+do\s+meu\s+(escopo|conhecimento)/i,
    /n[ãa]o\s+est[áa]\s+(na|em)\s+(minha\s+)?base/i,
  ];

  const triggerHandoff = async (
    history: Message[],
    motivo: string,
    mensagem: string,
    nome: string,
    numero: string
  ) => {
    try {
      await fetch(HANDOFF_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          assistant: plan,
          timestamp: new Date().toISOString(),
          motivo,
          nome,
          numero,
          telefone: numero,
          mensagem,
          history: history.map(({ role, content }) => ({ role, content })),
        }),
      });
    } catch (e) {
      console.error("Falha ao enviar transbordo:", e);
    }
  };

  // Abre o modal pedindo nome/telefone (ou dispara direto se já temos)
  const requestHandoff = (history: Message[], motivo: string, mensagem: string) => {
    const nome = localStorage.getItem("agros_user_name") || "";
    const numero = localStorage.getItem("agros_user_phone") || "";
    pendingHandoffRef.current = { history, motivo, mensagem };
    if (nome && numero) {
      finalizeHandoff(nome, numero);
    } else {
      setHandoffName(nome);
      setHandoffPhone(numero);
      setHandoffOpen(true);
    }
  };

  const finalizeHandoff = (nome: string, numero: string) => {
    const ctx = pendingHandoffRef.current;
    if (!ctx) return;
    pendingHandoffRef.current = null;
    localStorage.setItem("agros_user_name", nome);
    localStorage.setItem("agros_user_phone", numero);
    const handoffMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: HANDOFF_MSG,
    };
    const newHistory = [...ctx.history, handoffMsg];
    setMessages(newHistory);
    triggerHandoff(newHistory, ctx.motivo, ctx.mensagem, nome, numero);
  };

  const submitHandoffForm = (e: React.FormEvent) => {
    e.preventDefault();
    const nome = handoffName.trim();
    const numero = handoffPhone.trim();
    if (!nome || !numero) {
      toast.error("Informe seu nome e telefone para continuar.");
      return;
    }
    setHandoffOpen(false);
    finalizeHandoff(nome, numero);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const baseHistory = [...messages, userMsg];
    setMessages(baseHistory);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // 1) Transbordo solicitado pelo usuário
    if (USER_HANDOFF_PATTERNS.some((r) => r.test(trimmed))) {
      requestHandoff(baseHistory, "solicitado_pelo_usuario", trimmed);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { user_id: userId, message: trimmed, assistant: plan },
      });
      if (error) throw error;
      const reply = (data as { response?: string; error?: string })?.response;
      if (!reply) throw new Error((data as any)?.error || "Resposta inválida");

      const aiMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: reply };
      const newHistory = [...baseHistory, aiMsg];
      setMessages(newHistory);

      // 2) Transbordo automático se a IA não souber responder
      if (AI_HANDOFF_PATTERNS.some((r) => r.test(reply))) {
        requestHandoff(newHistory, "ia_nao_soube_responder", trimmed);
      }
    } catch (err) {
      console.error(err);
      toast.error("Não consegui responder agora. Tente novamente em instantes.");
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Desculpe, tive um problema para responder. Verifique sua conexão e tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([{ id: "intro", role: "assistant", content: meta.intro }]);
    localStorage.removeItem(storageKey);
  };

  // Cor de acento por plano — classe fixa para o Tailwind não purgar
  const accentBar = plan === "invest" ? "bg-primary/40" : plan === "vida" ? "bg-accent/40" : "bg-emerald-400/40";

  return (
    <div className="flex flex-col h-[100dvh] bg-[hsl(var(--chat-bg))] text-[hsl(var(--chat-text))]">

      {/* ── Barra superior ── */}
      <header className="flex items-center gap-3 px-3.5 py-2.5 bg-primary text-primary-foreground shadow-[0_2px_14px_hsl(213_80%_15%/0.3)] flex-shrink-0">
        <Link
          to="/"
          aria-label="Voltar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Avatar — persona Prev */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden border border-accent/40 flex-shrink-0">
          <PrevMascot size={36} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold leading-tight">Prev — {meta.name}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
            Online · Agros
          </p>
        </div>

        {/* Logo no lugar do nome escrito */}
        <AgrosLogo height={22} className="brightness-0 invert opacity-70 hidden sm:block mr-1" />

        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/85 hover:bg-white/20 transition"
        >
          <RefreshCcw className="h-3 w-3" />
          Nova conversa
        </button>
      </header>

      {/* ── Área de chat ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-3.5">
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} accentBar={accentBar}>
              {m.content}
            </Bubble>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-sm bg-[hsl(var(--chat-bubble-bot))] border border-[hsl(var(--chat-border))] px-4 py-3 shadow-sm">
              <Dot delay={0} /> <Dot delay={150} /> <Dot delay={300} />
            </div>
          )}

          {/* Chips de sugestão — apenas na mensagem inicial */}
          {messages.length <= 1 && !loading && (
            <div className="mt-2 flex flex-wrap gap-2">
              {meta.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-[hsl(var(--chat-border))] bg-white px-3.5 py-1.5 text-[12.5px] text-[hsl(var(--chat-text))] hover:border-primary/40 hover:bg-primary/5 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Input ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="border-t border-[hsl(var(--chat-border))] bg-white px-3 sm:px-6 py-3 flex-shrink-0"
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <div className="flex-1 rounded-2xl border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-bg))] focus-within:border-primary/50 transition">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              maxLength={500}
              rows={1}
              placeholder={`Pergunte sobre o ${meta.name}...`}
              className="w-full resize-none bg-transparent px-4 py-3 text-[14px] outline-none placeholder:text-muted-foreground leading-relaxed"
              style={{ maxHeight: 130 }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Enviar"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:bg-primary-glow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mx-auto mt-1.5 max-w-2xl text-[10.5px] text-muted-foreground">
          Respostas geradas por IA. Em caso de dúvida, ligue{" "}
          <a href="tel:3138996550" className="underline underline-offset-2 hover:text-primary transition">
            (31) 3899-6550
          </a>.
        </p>
      </form>

      {/* ── Modal de coleta para transbordo ── */}
      {handoffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={submitHandoffForm}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-[15px] font-semibold text-[hsl(var(--chat-text))]">
              Falar com um especialista
            </h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Informe seus dados para que possamos entrar em contato.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={handoffName}
                onChange={(e) => setHandoffName(e.target.value)}
                placeholder="Seu nome"
                autoFocus
                className="w-full rounded-xl border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-bg))] px-3.5 py-2.5 text-[14px] outline-none focus:border-primary/50"
              />
              <input
                type="tel"
                value={handoffPhone}
                onChange={(e) => setHandoffPhone(e.target.value)}
                placeholder="Telefone com DDD"
                className="w-full rounded-xl border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-bg))] px-3.5 py-2.5 text-[14px] outline-none focus:border-primary/50"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setHandoffOpen(false);
                  pendingHandoffRef.current = null;
                }}
                className="rounded-full px-4 py-2 text-[13px] text-muted-foreground hover:text-[hsl(var(--chat-text))]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow hover:bg-primary-glow"
              >
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

/* ── Bubble ── */
const Bubble = ({
  role,
  children,
  accentBar,
}: {
  role: "user" | "assistant";
  children: string;
  accentBar: string;
}) => {
  if (role === "user") {
    return (
      <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-[14px] text-primary-foreground shadow-sm whitespace-pre-wrap break-words">
        {children}
      </div>
    );
  }
  return (
    <div className="self-start max-w-[88%] rounded-2xl rounded-bl-sm border border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-bubble-bot))] px-4 py-3 text-[14px] text-[hsl(var(--chat-text))] shadow-sm">
      <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0 prose-strong:text-[hsl(var(--chat-text))]">
        <ReactMarkdown>{children}</ReactMarkdown>
      </div>
      {/* Linha de acento por plano — classe fixa evita purge do Tailwind */}
      <span className={`mt-1.5 inline-block h-0.5 w-8 rounded-full ${accentBar}`} />
    </div>
  );
};

/* ── Typing dot ── */
const Dot = ({ delay }: { delay: number }) => (
  <span
    className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50"
    style={{ animation: `pulse-dot 1.2s ${delay}ms infinite` }}
  />
);

export default Chat;
