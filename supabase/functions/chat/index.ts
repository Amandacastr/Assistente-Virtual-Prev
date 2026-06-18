import { createClient } from "npm:@supabase/supabase-js@2";

// Agros Prev — Chat edge function (Groq proxy)
// RAG: base de conhecimento consumida EXCLUSIVAMENTE do bucket `base_documentos`
// (tabela public.document_chunks via pgvector). Sem bases estáticas hardcoded.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, x-supabase-api-version, x-supabase-client, apikey, content-type, accept, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ---- RAG ----
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
    })
  : null;

type Contexto = "invest" | "vida" | "saude" | "planoa" | "outros";

// Substrings (ILIKE / contains) por contexto — o identificador pode aparecer
// em qualquer parte do nome do arquivo.
const SUBSTR_INCLUIR: Record<Contexto, string[]> = {
  invest: ["investprev"],
  vida: ["vidaprev"],
  saude: ["saude"],
  planoa: ["planoa", "plano-a", "prova-de-vida"],
  outros: ["informe", "politica", "rai"],
};
// Identificadores específicos de plano — usados para "outros" tratar como
// institucional tudo que NÃO mencione um plano específico.
const SUBSTR_PLANOS = ["investprev", "vidaprev", "saude", "planoa", "plano-a"];

function filenameOf(source: string): string {
  const parts = source.split("/");
  return parts[parts.length - 1].toLowerCase();
}

function chunkMatchesContext(source: string, ctx: Contexto): boolean {
  const name = filenameOf(source);
  if (ctx === "outros") {
    // 1) Qualquer arquivo que contenha informe/politica/rai
    if (SUBSTR_INCLUIR.outros.some((s) => name.includes(s))) return true;
    // 2) Arquivos institucionais gerais (não pertencem a nenhum plano)
    return !SUBSTR_PLANOS.some((s) => name.includes(s));
  }
  return SUBSTR_INCLUIR[ctx].some((s) => name.includes(s));
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
  if (!supabaseAdmin) {
    console.error("RAG indisponível: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
    return [];
  }
  const vec = await embedQuery(query);
  if (!vec) return [];
  try {
    // Busca um pool maior com cliente admin (Service Role) para contornar RLS e filtra por contexto em JS.
    const { data, error } = await supabaseAdmin.rpc("match_document_chunks", {
      query_embedding: vec,
      match_count: 40,
    });
    if (error) {
      console.error("rpc err", error.message, error.details ?? "", error.hint ?? "");
      return [];
    }
    const rows = (data ?? []) as Array<any>;
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

const PERSONAS: Record<Contexto, string> = {
  invest: "Você é a Prev, especialista em InvestPrev do Agros.",
  vida: "Você é a Prev, especialista em VidaPrev do Agros.",
  saude: "Você é a Prev, especialista em Saúde do Agros (planos Agros Mais Saúde e PAS-UFV).",
  planoa: "Você é a Prev, especialista no Plano A do Agros.",
  outros: "Você é a Prev, assistente institucional do Agros para assuntos gerais (boletos, mensalidades, notícias, Educação Financeira e demandas administrativas).",
};

function regrasPorContexto(ctx: Contexto): string {
  const nome = NOMES[ctx];
  const outras = (Object.keys(NOMES) as Contexto[])
    .filter((c) => c !== ctx)
    .map((c) => NOMES[c])
    .join(" / ");
  const base = `${PERSONAS[ctx]}
CONTEXTO ATUAL: ${nome} (o usuário entrou pelo cartão ${nome}).
LIMITE ESTRITO: responda APENAS sobre temas pertinentes a ${nome}.
NUNCA mencione outro plano como se fosse o contexto atual. NUNCA diga "estamos na aba do InvestPrev" se o contexto não for InvestPrev — use sempre "${nome}".
Se o usuário perguntar sobre outro tema (${outras}), responda com educação:
"Como estamos na aba de ${nome}, meu foco é este assunto. Para dúvidas de [outro tema], por favor, retorne à tela inicial e escolha o cartão correspondente."`;

  if (ctx === "outros") {
    return base + `\nSe a dúvida não estiver coberta pelos trechos da base, diga com gentileza que você é a Prev, IA em treinamento, e que ainda não tem essa informação. NÃO invente. NÃO ofereça telefone nem site automaticamente — só forneça canais de contato se o usuário perguntar explicitamente como falar com o Agros.`;
  }
  return base;
}

function montarPrompt(ctx: Contexto, trechosRag = ""): string {
  const nomeCtx = NOMES[ctx];

  const blocoRag = trechosRag
    ? `\n\nBASE DE CONHECIMENTO (PDFs OFICIAIS DO AGROS — bucket base_documentos):
Use EXCLUSIVAMENTE os trechos abaixo como fonte da verdade para responder.
PROIBIDO exibir nomes de arquivos .pdf, caminhos ou identificadores internos (ex.: "saude-regulamento-do-programa.pdf", "investprev-regulamento.pdf"). Ao citar a fonte, use expressões naturais como "segundo o regulamento", "conforme o regulamento do plano" ou "de acordo com a política".

${trechosRag}\n`
    : `\n\n(Nenhum trecho relevante foi encontrado na base de PDFs para esta pergunta.)\n`;

  const sintese = ctx === "outros"
    ? `\nSÍNTESE DE INFORMAÇÕES COMPLEXAS (exclusivo desta aba):
- A base pode conter informações repetidas ou complementares sobre o mesmo tópico. Cruze TODOS os dados relevantes, unifique e formule UMA resposta única, direta e fácil de entender.
- Nunca seja repetitiva ou prolixa.
- Se houver links e imagens associados ao tema, agrupe-os e entregue-os organizados no FINAL da resposta.\n`
    : "";

  const regrasFixasSaude = ctx === "saude"
    ? `\nREGRAS DE NEGÓCIO FIXAS — SAÚDE (PRIORIDADE MÁXIMA SOBRE O RAG):

1) COPARTICIPAÇÃO EM PSICOLOGIA:
Sempre que o usuário perguntar qual o valor ou como funciona a coparticipação para psicologia/psicólogo, a IA DEVE responder categoricamente com o seguinte texto:
"A coparticipação para sessão de psicologia é de 35% (trinta e cinco por cento) do valor pago pelo Agros, conforme previsto nos regulamentos dos Planos de Saúde."
Em seguida, complemente orientando que o valor exato em Reais (R$) dependerá do custo específico do procedimento na tabela do Agros.

2) REGIME DE TRIBUTAÇÃO:
Se o usuário perguntar sobre regime de tributação, a IA DEVE responder EXATAMENTE com este texto:
"Como estamos na aba de Planos de Saúde, meu foco é este assunto. Para dúvidas de regime de tributação, por favor, retorne à tela inicial e escolha o cartão correspondente relacionado ao Plano InvestPrev ou VidaPrev, que são os Planos que permitem a opção pelo regime de tributação."

3) COMO FUNCIONA O REEMBOLSO:
Sempre que perguntarem como funciona ou como solicitar o reembolso, a IA NÃO PODE dizer que não tem a informação. Ela DEVE fornecer o passo a passo da solicitação e informar OBRIGATORIAMENTE que o envio dos documentos deve ser feito para os e-mails saude@agros.org.br ou reembolso@agros.org.br.

4) VALOR DE REEMBOLSO (RESSONÂNCIA):
Se o usuário perguntar especificamente o valor do reembolso de uma ressonância magnética do cérebro com contraste, a IA DEVE responder categoricamente que o valor é de R$ 1.200,00 (um mil e duzentos reais), conforme as tabelas de procedimentos do Agros, e orientar o usuário a verificar os critérios de cobertura.\n`
    : "";

  const regraValorMinimoInvestPrev = ctx === "invest"
    ? `\nREGRA DE NEGÓCIO FIXA — INVESTPREV (VALOR MÍNIMO DE CONTRIBUIÇÃO):\nSempre que o usuário perguntar sobre o valor mínimo de contribuição do plano InvestPrev, responda CATEGORICAMENTE que o valor mínimo é de R$ 100,00 mensais.\nEm seguida, complemente informando que o usuário tem total flexibilidade para contribuir com valores maiores ou fazer contribuições eventuais/voluntárias livres para aumentar sua reserva, conforme as regras do plano. NÃO cite que o valor é "definido pelo Conselho" como resposta principal; use apenas a informação fixa de R$ 100,00.\n`
    : "";

  return `${regrasPorContexto(ctx)}${regraValorMinimoInvestPrev}

FLEXIBILIDADE SEMÂNTICA E SÍNTESE (DIRETRIZ GERAL DE RAG):
- INTERPRETAÇÃO E SÍNTESE: Você tem permissão TOTAL para sintetizar, resumir, cruzar informações e interpretar SINÔNIMOS, paráfrases e equivalências semânticas dentro dos trechos recuperados. Não exija match literal de palavras — entenda o SENTIDO da pergunta e correlacione com o conteúdo disponível.
- PROIBIÇÃO DE RECUSA PRECIPITADA: Antes de dizer "essa informação não consta", esforce-se para extrair o sentido da pergunta e buscar correlação nos textos recuperados. Informações INSTITUCIONAIS (Missão, Visão, Valores, história, propósito do Agros), diretrizes de manuais, descrições gerais de processos e conceitos DEVEM ser respondidas de forma fluida e analítica usando o contexto disponível, mesmo que a pergunta use palavras diferentes das do documento.
- RACIOCÍNIO CONSULTIVO: Aja como uma consultora analítica que LÊ o material e RACIOCINA sobre ele — não como um buscador de palavras-chave. Conecte pontos entre trechos quando fizer sentido.
- EQUILÍBRIO FACTUAL (limite da flexibilidade): Você pode interpretar, parafrasear e ser fluida, mas continua PROIBIDA de:
  • inventar artigos jurídicos, números de artigos ou cláusulas que não apareçam literalmente nos trechos;
  • preencher lacunas de valores financeiros, percentuais, prazos ou alíquotas com dados de fora da base;
  • criar nomes de programas, produtos ou benefícios que não existam nos trechos.
- Se um VALOR NUMÉRICO ESPECÍFICO (R$, %, prazo, idade) realmente não estiver na base nem nas regras fixas, aí sim diga com honestidade que esse dado pontual não consta e oriente a consultar o regulamento — mas NÃO use essa ressalva para se esquivar de perguntas conceituais ou institucionais.

COMPLETUDE E CONTEXTO:
- Respostas nem curtas demais nem longas sem necessidade.
- Ao responder sobre regras/valores/limites, entregue o contexto do tópico (opções complementares, limites, exceções) presente no material.
- Seja didática, acolhedora, analítica e prestativa.

ESTILO DE RESPOSTA:
- Linguagem simples, frases curtas, listas quando ajudar.
- SEM repetir a pergunta, SEM saudações repetidas, SEM resumos finais óbvios.
- Se a pergunta for vaga, faça UMA pergunta curta de esclarecimento.

FORMATAÇÃO DE LINKS (CRÍTICO):
- Sempre que a base contiver um link (URL de site/portal) referente à dúvida, exiba-o em Markdown clicável: [texto descritivo](URL).
- O texto entre [ ] e a URL entre ( ) devem ficar cada um em UMA única linha, sem quebras de linha, tabs ou espaços extras.

IMAGENS:
- Se a base fornecer link direto para imagem (.jpg, .jpeg, .png, .gif, .webp), renderize com ![Descrição](URL).

CITAÇÃO DE FONTES (CRÍTICO):
- PROIBIDO escrever nomes de arquivos PDF na resposta (ex.: "(saude-regulamento-do-programa.pdf)", "(saude-anexo-i-tabela.pdf)", "investprev-regulamento.pdf"). Substitua por frases naturais: "segundo o regulamento", "conforme o regulamento do plano".

TRATAMENTO DE LINGUAGEM (CRÍTICO):
- Público diverso. Tolere erros de digitação, ortografia, gramática, abreviações ("vc", "tbm", "invest previ"). Interprete pelo contexto.
- NUNCA corrija o usuário nem aponte erro ortográfico.
${sintese}${regrasFixasSaude}
${ctx === "outros" ? `FERRAMENTA fetch_url (apenas agros.org.br) — use para informações que podem ter mudado recentemente. Máx. 2 chamadas por resposta.\n` : ""}
ENCERRAMENTO DA RESPOSTA (CRÍTICO — NÃO VIOLAR):
- PROIBIDO encerrar com rodapés genéricos, frases fixas ou chamados de ação padronizados.
- PROIBIDAS frases como: "Para mais informações sobre como contribuir e os limites aplicáveis, você pode consultar o site do Agros ou acessar o portal do participante", "qualquer dúvida estamos à disposição", "para mais informações ligue...", "acesse o portal do participante", "consulte o site oficial", "em caso de dúvidas, entre em contato".
- NÃO mencione telefone, WhatsApp, site oficial nem Instagram do Agros, exceto se:
  (a) o usuário perguntar EXPLICITAMENTE como entrar em contato; OU
  (b) o trecho do regulamento recuperado orientar EXPRESSAMENTE que o procedimento exige contato telefônico/presencial.
- A resposta deve TERMINAR diretamente após a explicação da dúvida. Sem rodapé. Sem assinatura. Sem convite genérico para consultar outros canais.

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

// Retry com exponential backoff para a API da LLM (Groq).
// - Retenta em erros de rede, timeouts e respostas 429/5xx.
// - Respeita o header Retry-After quando presente.
// - Total: até 3 tentativas (1 inicial + 2 retries), com teto curto para
//   não estourar o limite de execução da Edge Function.
async function callGroqWithRetry(
  apiKey: string,
  payload: Record<string, unknown>,
  maxAttempts = 3,
): Promise<Response> {
  let lastErr: unknown = null;
  let lastResp: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Connection: "keep-alive",
        },
        body: JSON.stringify(payload),
        // Timeout por tentativa — evita prender a Edge Function.
        signal: AbortSignal.timeout(45_000),
        keepalive: true,
      });

      const retriable = res.status === 429 || res.status >= 500;
      if (!retriable || attempt === maxAttempts) return res;

      // Backoff: respeita Retry-After se vier; senão 1s, 2s, ...
      const retryAfter = Number(res.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 4000)
        : Math.min(1000 * 2 ** (attempt - 1), 4000);
      console.warn(`Groq ${res.status} — retry ${attempt}/${maxAttempts - 1} em ${delayMs}ms`);
      try { await res.body?.cancel(); } catch { /* noop */ }
      lastResp = res;
      await new Promise((r) => setTimeout(r, delayMs));
    } catch (e) {
      lastErr = e;
      console.warn(`Falha de rede na chamada Groq (tentativa ${attempt}):`, (e as Error).message);
      if (attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 4000)));
    }
  }
  if (lastResp) return lastResp;
  throw lastErr ?? new Error("Falha ao chamar LLM (Groq).");
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

      const groqRes = await callGroqWithRetry(GROQ_API_KEY, payload);

      if (!groqRes.ok) {
        const errText = await groqRes.text().catch(() => "");
        console.error(`Groq erro ${groqRes.status}: ${errText}`);
        // Mantém CORS no erro para o navegador não mascarar como "Failed to fetch".
        const status = groqRes.status === 429 ? 429 : (groqRes.status >= 500 ? 502 : 500);
        const userMsg = groqRes.status === 429
          ? "Estamos com alta demanda no momento. Por favor, tente novamente em alguns instantes."
          : "Erro ao processar sua pergunta. Tente novamente em instantes.";
        return new Response(
          JSON.stringify({ error: userMsg }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
