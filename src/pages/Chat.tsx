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
      "Qual o valor da coparticipação?",
      "Como funciona o reembolso?",
      "Qual o telefone de emergência?",
      "Como agendar no Agros + Saúde?",
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
  const HANDOFF_WEBHOOK = "https://girls-arch-settlement-elect.trycloudflare.com/webhook-test/transbordo";

  // Normaliza texto: minúsculo, sem acentos, sem pontuação
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Distância de Levenshtein para tolerar erros de digitação
  const levenshtein = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[a.length][b.length];
  };

  // Tolerância proporcional ao tamanho da palavra
  const fuzzyTolerance = (w: string) => (w.length <= 4 ? 1 : w.length <= 7 ? 2 : 3);

  // Palavras-chave fortes — sozinhas já indicam transbordo
  const HANDOFF_STRONG = [
    "atendente", "humano", "suporte", "atendimento", "transbordo",
    "especialista", "consultor", "operador",
  ];
  // Palavras-chave que precisam de verbo de intenção
  const HANDOFF_WEAK = [
    "pessoa", "alguem", "funcionario", "responsavel", "gerente", "representante", "ajuda",
  ];
  const INTENT_KEYWORDS = [
    "falar", "conversar", "contato", "contatar", "chamar", "ligar",
    "quero", "preciso", "gostaria", "desejo", "solicito", "queria",
  ];

  const fuzzyHas = (tokens: string[], target: string) => {
    const tol = fuzzyTolerance(target);
    return tokens.some((t) => {
      if (Math.abs(t.length - target.length) > tol + 1) return false;
      return t === target || levenshtein(t, target) <= tol;
    });
  };

  // Detecta intenção de buscar notícias/editais/novidades (tolerante a erros)
  const NEWS_KEYWORDS = [
    "noticia", "noticias", "novidade", "novidades", "atualizacao", "atualizacoes",
    "edital", "editais", "comunicado", "comunicados", "informativo", "informativos",
    "informe", "informes",
  ];
  const isNewsRequest = (raw: string) => {
    const norm = normalize(raw);
    if (!norm) return false;
    const tokens = norm.split(" ").filter((t) => t.length >= 3);
    return NEWS_KEYWORDS.some((k) => fuzzyHas(tokens, k));
  };

  const isHandoffRequest = (raw: string) => {

    const norm = normalize(raw);
    if (!norm) return false;
    const tokens = norm.split(" ").filter((t) => t.length >= 2);
    if (HANDOFF_STRONG.some((k) => fuzzyHas(tokens, k))) return true;
    const weak = HANDOFF_WEAK.some((k) => fuzzyHas(tokens, k));
    const intent = INTENT_KEYWORDS.some((k) => fuzzyHas(tokens, k));
    return weak && intent;
  };

  // Detecta telefone na resposta da IA (para forçar transbordo em vez de números soltos)
  const containsPhoneNumber = (s: string) =>
    /(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/.test(s.replace(/\D(?=\d)/g, (m) => m));


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
    const payload = {
      name: nome,
      phone_number: numero,
      // campos extras de contexto
      nome,
      numero,
      telefone: numero,
      user_id: userId,
      assistant: plan,
      timestamp: new Date().toISOString(),
      motivo,
      mensagem,
      history: history.map(({ role, content }) => ({ role, content })),
    };
    console.log("[Transbordo] Disparando PUT para", HANDOFF_WEBHOOK, payload);
    try {
      const response = await fetch(HANDOFF_WEBHOOK, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        console.log(
          "[Transbordo] ✅ Requisição PUT enviada com sucesso:",
          response.status,
          response.statusText
        );
      } else {
        console.error(
          "[Transbordo] ❌ Webhook respondeu com erro:",
          response.status,
          response.statusText
        );
      }
    } catch (e) {
      console.error("[Transbordo] ❌ Falha ao enviar requisição PUT:", e);
    }
  };

  // Sempre abre o modal pedindo nome/telefone antes de disparar o webhook
  const requestHandoff = (history: Message[], motivo: string, mensagem: string) => {
    pendingHandoffRef.current = { history, motivo, mensagem };
    setHandoffName(localStorage.getItem("agros_user_name") || "");
    setHandoffPhone(localStorage.getItem("agros_user_phone") || "");
    setHandoffOpen(true);
  };

  const finalizeHandoff = (nome: string, numero: string) => {
    const ctx = pendingHandoffRef.current ?? {
      history: messages,
      motivo: "solicitado_pelo_usuario",
      mensagem: messages.filter((m) => m.role === "user").slice(-1)[0]?.content ?? "",
    };
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
    console.log("Enviando para o n8n...");
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

    // Notícias / editais / atualizações — consulta a tabela `noticias` em tempo real
    if (isNewsRequest(trimmed)) {
      setLoading(true);
      try {
        const { data: noticias, error } = await supabase
          .from("noticias")
          .select("titulo, link, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        if (error) throw error;
        const content =
          noticias && noticias.length > 0
            ? `📰 **Últimas notícias e atualizações do Agros:**\n\n${noticias
                .map((n) => `- [${n.titulo}](${n.link})`)
                .join("\n")}\n\nClique em um título para acessar a página completa.`
            : "No momento não encontrei notícias cadastradas. Você pode acompanhar tudo em [agros.org.br/noticias](https://www.agros.org.br/noticias).";
        setMessages([
          ...baseHistory,
          { id: crypto.randomUUID(), role: "assistant", content },
        ]);
      } catch (err) {
        console.error("[Notícias] Erro ao consultar Supabase:", err);
        toast.error("Não consegui buscar as notícias agora.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);


    try {
      const history = baseHistory
        .filter((m) => m.id !== "intro")
        .map(({ role, content }) => ({ role, content }));
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { user_id: userId, message: trimmed, assistant: plan, history },
      });
      if (error) throw error;
      const reply = (data as { response?: string; error?: string })?.response;
      if (!reply) throw new Error((data as any)?.error || "Resposta inválida");

      const aiMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: reply };
      setMessages([...baseHistory, aiMsg]);
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
        <div className="mx-auto mt-2 flex max-w-2xl items-center justify-between gap-2">
          {plan !== "outros" && (
            <button
              type="button"
              onClick={() =>
                requestHandoff(messages, "solicitado_pelo_usuario", "Usuário solicitou falar com atendente.")
              }
              className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11.5px] font-medium text-primary hover:bg-primary/10 transition"
            >
              Falar com atendente
            </button>
          )}
          <p className="text-[10.5px] text-muted-foreground">
            Respostas geradas por IA. Em caso de dúvida, ligue{" "}
            <a href="tel:3138996550" className="underline underline-offset-2 hover:text-primary transition">
              (31) 3899-6550
            </a>.
          </p>
        </div>
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
