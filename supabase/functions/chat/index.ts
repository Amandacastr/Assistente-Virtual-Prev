// Agros Prev — Chat edge function (Groq proxy)
// RAG: base de conhecimento consumida EXCLUSIVAMENTE do bucket `base_documentos`
// (tabela public.document_chunks via pgvector). Sem bases estáticas hardcoded.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ---- RAG ----
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims

type Contexto = "invest" | "vida" | "saude" | "planoa" | "outros";

// Prefixos de arquivo por contexto (roteamento de RAG por metadata).
const PREFIXOS_INCLUIR: Record<Contexto, string[]> = {
  invest: ["investprev"],
  vida: ["vidaprev"],
  saude: ["saude"],
  planoa: ["planoa", "prova-de-vida"],
  outros: ["educacaofinanceira"],
};
// Para "outros" aceitamos também tudo que NÃO se enquadre nos demais.
const TODOS_PREFIXOS_CONHECIDOS = [
  "investprev", "vidaprev", "saude", "planoa", "prova-de-vida",
];

function filenameOf(source: string): string {
  const parts = source.split("/");
  return parts[parts.length - 1].toLowerCase();
}

function chunkMatchesContext(source: string, ctx: Contexto): boolean {
  const name = filenameOf(source);
  if (ctx === "outros") {
    if (name.startsWith("educacaofinanceira")) return true;
    return !TODOS_PREFIXOS_CONHECIDOS.some((p) => name.startsWith(p));
  }
  return PREFIXOS_INCLUIR[ctx].some((p) => name.startsWith(p));
}

async function embedQuery(text: string): Promise<number[] | null> {
  if (!LOVABLE_API_KEY) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    });
    if (!res.ok) {
      console.error("embed err", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return json?.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("embed fail", e);
    return null;
  }
}

async function retrieveDocs(
  query: string,
  ctx: Contexto,
  k = 6,
): Promise<Array<{ source: string; page: number | null; content: string; similarity: number }>> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [];
  const vec = await embedQuery(query);
  if (!vec) return [];
  try {
    // Busca um pool maior e filtra por prefixo do arquivo em JS (metadata filtering).
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_document_chunks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query_embedding: vec, match_count: 40 }),
    });
    if (!res.ok) {
      console.error("rpc err", res.status, await res.text());
      return [];
    }
    const rows = (await res.json()) as Array<any>;
    return rows
      .filter((r) => typeof r?.similarity === "number" && r.similarity > 0.2)
      .filter((r) => chunkMatchesContext(String(r.source ?? ""), ctx))
      .slice(0, k)
      .map((r) => ({ source: r.source, page: r.page, content: r.content, similarity: r.similarity }));
  } catch (e) {
    console.error("retrieve fail", e);
    return [];
  }
}

function formatRetrieved(docs: Array<{ source: string; page: number | null; content: string }>): string {
  if (!docs.length) return "";
  return docs
    .map((d, i) => `[Trecho ${i + 1} — ${d.source}${d.page ? `, p.${d.page}` : ""}]\n${d.content}`)
    .join("\n\n");
}

const NOMES: Record<Contexto, string> = {
  invest: "InvestPrev",
  vida: "VidaPrev",
  saude: "Saúde (Agros Mais Saúde e PAS-UFV)",
  planoa: "Plano A",
  outros: "Outros Assuntos",
};

function regrasPorContexto(ctx: Contexto): string {
  const nome = NOMES[ctx];
  const outras = (Object.keys(NOMES) as Contexto[])
    .filter((c) => c !== ctx)
    .map((c) => NOMES[c])
    .join(" / ");
  const base = `CONTEXTO ATUAL: ${nome} (o usuário entrou pelo cartão ${nome}).
LIMITE ESTRITO: responda APENAS sobre temas pertinentes a ${nome}.
Se o usuário perguntar sobre outro tema (${outras}), responda com educação:
"Como estamos na aba do ${nome}, meu foco é este assunto. Para dúvidas de [outro tema], por favor, retorne à tela inicial e escolha o cartão correspondente."`;

  if (ctx === "outros") {
    return base + `\nSe a dúvida não estiver coberta pelos trechos da base, diga com gentileza que você é a Prev, IA em treinamento, e oriente a ligar para (31) 3899-6550 (dias úteis, 7h às 19h). NÃO invente.`;
  }
  return base;
}

function montarPrompt(ctx: Contexto, trechosRag = ""): string {
  const nomeCtx = NOMES[ctx];

  const blocoRag = trechosRag
    ? `\n\nBASE DE CONHECIMENTO (PDFs OFICIAIS DO AGROS — bucket base_documentos):
Use EXCLUSIVAMENTE os trechos abaixo como fonte da verdade para responder. Cite o documento de origem entre parênteses quando relevante.

${trechosRag}\n`
    : `\n\n(Nenhum trecho relevante foi encontrado na base de PDFs para esta pergunta.)\n`;

  const sintese = ctx === "outros"
    ? `\nSÍNTESE DE INFORMAÇÕES COMPLEXAS (exclusivo desta aba):
- A base pode conter informações repetidas ou complementares sobre o mesmo tópico. Cruze TODOS os dados relevantes, unifique e formule UMA resposta única, direta e fácil de entender.
- Nunca seja repetitiva ou prolixa.
- Se houver links e imagens associados ao tema, agrupe-os e entregue-os organizados no FINAL da resposta.\n`
    : "";

  return `Você é a Prev, assistente virtual do Agros.

${regrasPorContexto(ctx)}

COMPLETUDE E CONTEXTO (OBRIGATÓRIO):
- Suas respostas NÃO devem ser curtas demais (monossilábicas) e nem extensas sem necessidade.
- Ao responder sobre regras, valores ou limites (ex.: valor mínimo de contribuição), NUNCA dê apenas o número seco. Entregue o contexto completo daquele tópico presente no regulamento, mencionando opções complementares (contribuições adicionais/eventuais, limites máximos, exceções) e sempre indicando links e caminhos para o usuário agir.
- Seja didática, acolhedora e prestativa — uma verdadeira mentora do participante.

ESTILO DE RESPOSTA:
- Linguagem simples, frases curtas, organização clara (listas quando ajudar).
- SEM repetir a pergunta, SEM saudações repetidas, SEM resumos finais óbvios.
- Quando citar regra, mencione o artigo entre parênteses: "(Art. X)".
- Se a pergunta for vaga, faça UMA pergunta curta de esclarecimento.
- NUNCA invente. Use somente os trechos da base de conhecimento abaixo.

FORMATAÇÃO DE LINKS (CRÍTICO):
- Sempre que a base contiver um link (URL de site/portal) referente à dúvida, exiba-o OBRIGATORIAMENTE em formato Markdown clicável: [texto descritivo](URL). Os links são renderizados em azul.
- O "texto" entre colchetes [ ] DEVE estar em UMA única linha, sem quebras de linha (\\n) e sem espaços no começo ou fim.
- A URL dentro dos parênteses ( ) também deve ficar em uma única linha, sem espaços.
- Antes de devolver a resposta, releia cada [ ... ]( ... ) e remova qualquer \\n, \\r, tab ou espaço extra de dentro dos colchetes/parênteses.

IMAGENS:
- Se a base fornecer um link direto para uma imagem (URL terminada em .jpg, .jpeg, .png, .gif, .webp), renderize a imagem diretamente no chat usando Markdown nativo: ![Descrição da imagem](URL).

TRATAMENTO DE LINGUAGEM (CRÍTICO):
- Público diverso em idade e familiaridade com tecnologia. Seja EXTREMAMENTE tolerante a erros de digitação, ortografia, gramática, falta de acentuação e abreviações (ex.: "vc", "tbm", "q", "pq", "invest previ", "vida preve").
- Analise sempre o CONTEXTO para entender a intenção real.
- NUNCA corrija o usuário, NUNCA aponte erro ortográfico, NUNCA peça para reescrever. Interprete silenciosamente.
${sintese}
${ctx === "outros" ? `FERRAMENTA fetch_url (apenas agros.org.br) — use para informações que podem ter mudado recentemente (prazos do mês, comunicados, notícias). Máx. 2 chamadas por resposta.\n` : ""}
CONTATOS DO AGROS:
- Telefone / WhatsApp: (31) 3899-6550
- Site: www.agros.org.br
- Instagram: @agrosprevsaude

CONTEXTO ATIVO: ${nomeCtx.toUpperCase()}.${blocoRag}`.trim();
}

// Histórico em memória por (user_id + contexto). Fallback se cliente não enviar histórico.
const conversationStore = new Map<string, Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown; name?: string }>>();

// Ferramenta fetch_url (apenas agros.org.br) — usada só na aba "outros".
const TOOLS = [
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Busca o conteúdo textual de uma página pública do site do Agros (agros.org.br).",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL completa começando com https://www.agros.org.br ou https://agros.org.br",
          },
        },
        required: ["url"],
      },
    },
  },
];

async function executarFetchUrl(url: string): Promise<string> {
  try {
    const u = new URL(url);
    if (!/(^|\.)agros\.org\.br$/i.test(u.hostname)) {
      return "Erro: somente URLs de agros.org.br são permitidas.";
    }
    const res = await fetch(u.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (PrevBot Agros)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return `Erro HTTP ${res.status} ao acessar ${u.toString()}.`;
    const html = await res.text();
    const limpo = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return limpo.slice(0, 4000);
  } catch (e) {
    return `Erro ao acessar a URL: ${(e as Error).message}`;
  }
}

function normalizarAssistant(raw: unknown): Contexto {
  const v = String(raw ?? "").toLowerCase();
  if (v === "vida" || v === "vidaprev") return "vida";
  if (v === "saude" || v === "saúde") return "saude";
  if (v === "planoa" || v === "plano_a" || v === "plano-a") return "planoa";
  if (v === "outros") return "outros";
  return "invest";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY não configurada no servidor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const userId = String(body.user_id ?? "").trim();
    let mensagem = String(body.message ?? "").trim();
    const ctx: Contexto = normalizarAssistant(body.assistant);
    const clientHistory = Array.isArray(body.history) ? body.history : [];

    if (!userId || !mensagem) {
      return new Response(
        JSON.stringify({ error: "user_id e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    mensagem = mensagem.slice(0, 500);

    const chave = `${userId}_${ctx}`;
    let historico: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown; name?: string }> = [];
    if (clientHistory.length > 0) {
      historico = clientHistory
        .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
      if (!historico.length || historico[historico.length - 1].role !== "user" || historico[historico.length - 1].content !== mensagem) {
        historico.push({ role: "user", content: mensagem });
      }
    } else {
      historico = conversationStore.get(chave) ?? [];
      historico.push({ role: "user", content: mensagem });
    }
    const ultimas = historico.slice(-20);

    // RAG com filtro de prefixo por contexto.
    const retrieved = await retrieveDocs(mensagem, ctx, 6);
    const trechosRag = formatRetrieved(retrieved);

    const mensagensIA: Array<Record<string, unknown>> = [
      { role: "system", content: montarPrompt(ctx, trechosRag) },
      ...ultimas.map((m) => ({ ...m })),
    ];

    let textoResposta = "";
    for (let iter = 0; iter < 4; iter++) {
      const payload: Record<string, unknown> = {
        model: GROQ_MODEL,
        messages: mensagensIA,
        max_tokens: 600,
        temperature: 0.2,
      };
      if (ctx === "outros") {
        payload.tools = TOOLS;
        payload.tool_choice = "auto";
      }

      const groqRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        console.error(`Groq erro ${groqRes.status}: ${errText}`);
        return new Response(
          JSON.stringify({ error: "Erro ao processar. Tente novamente." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await groqRes.json();
      const msg = data?.choices?.[0]?.message;
      const toolCalls = msg?.tool_calls;

      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        mensagensIA.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: toolCalls,
        });
        for (const tc of toolCalls) {
          if (tc?.function?.name === "fetch_url") {
            let url = "";
            try {
              url = JSON.parse(tc.function.arguments ?? "{}").url ?? "";
            } catch { /* ignore */ }
            const resultado = await executarFetchUrl(url);
            mensagensIA.push({
              role: "tool",
              tool_call_id: tc.id,
              name: "fetch_url",
              content: resultado,
            });
          } else {
            mensagensIA.push({
              role: "tool",
              tool_call_id: tc.id,
              name: tc?.function?.name ?? "unknown",
              content: "Ferramenta desconhecida.",
            });
          }
        }
        continue;
      }

      textoResposta = msg?.content ?? "";
      break;
    }

    // Normaliza links Markdown: remove quebras/espaços dentro de [ ] e ( ).
    textoResposta = textoResposta.replace(
      /\[([\s\S]*?)\]\(([\s\S]*?)\)/g,
      (_m, txt: string, url: string) =>
        `[${txt.replace(/\s+/g, " ").trim()}](${url.replace(/\s+/g, "")})`,
    );

    historico.push({ role: "assistant", content: textoResposta });
    conversationStore.set(chave, historico);

    return new Response(JSON.stringify({ response: textoResposta }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro inesperado:", e);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
