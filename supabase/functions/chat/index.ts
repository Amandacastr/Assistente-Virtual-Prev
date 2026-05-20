// Agros Prev — Chat edge function (Groq proxy)
// Replicates the Flask /chat behavior: keeps a per-user/per-plan history
// (last 10 messages) in memory and forwards to Groq.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// =============================================================
// BASES DE CONHECIMENTO (extraídas literalmente do app.py)
// =============================================================

const CONHECIMENTO_INVESTPREV = `
=== INVESTPREV — VISÃO GERAL ===
O InvestPrev é um plano de previdência complementar na modalidade Contribuição Definida (CD),
criado em 2008 com o nome de Agros CD-01. Em 2020 passou por revisão e teve o nome alterado
para InvestPrev. CNPB: nº 2008.0010-83. CNPJ: 48.307.394/0001-51.

Plano de Contribuição Definida (CD): o valor do benefício é calculado no momento da concessão,
com base nas contribuições acumuladas. O benefício não é pré-definido — será proporcional ao
saldo existente na data da concessão.

No InvestPrev o participante escolhe um valor fixo (mínimo R$ 100,00) para investir
mensalmente. No futuro, após cumprir as exigências do Regulamento, poderá usufruir de
benefícios proporcionais ao saldo acumulado.

=== TAXAS ===
O Agros cobra apenas a taxa de administração: 0,066667% ao mês (0,8% ao ano).
Não há cobrança de taxa de carregamento.

=== RENTABILIDADE ACUMULADA (07/2008 a 12/2025) ===
InvestPrev: 435,69% | SELIC: 417,48% | Poupança: 200,24% | INPC: 159,89% | IBOV: 170,79%
A rentabilidade histórica do InvestPrev superou a SELIC no período acumulado.

=== VANTAGENS DO INVESTPREV ===
1. Sem finalidade lucrativa: toda a rentabilidade líquida reverte para o participante.
2. Dedução de IR: contribuições ao InvestPrev podem ser deduzidas da base de cálculo do IRRF,
   inclusive contribuições em nome de filhos de até 16 anos (dependentes econômicos).
3. Opção entre regime progressivo ou regressivo de tributação.
4. Baixa taxa administrativa.
5. Renda continuada a partir dos 18 anos (cumpridas as regras).
6. Resgates parciais: a cada 2 anos, até 20% das contribuições normais.
7. Benefício temporário: renda mensal por 24 a 60 meses, mantendo as contribuições.
8. Sucessão patrimonial: transferência direta aos beneficiários, sem inventário.

=== CONTRIBUIÇÃO ===
Valor mínimo: R$ 100,00/mês.
Alteração: somente em junho e dezembro de cada ano (por e-mail, telefone ou autoatendimento).
Suspensão: possível por até 24 meses não consecutivos dentro de um período de 60 meses.

=== FORMAS DE PAGAMENTO ===
- Débito em conta (bancos conveniados)
- Desconto em folha (somente UFV e Agros)
- Depósito, transferência ou Pix para conta do Agros
- Boleto bancário

=== QUEM PODE SE INSCREVER ===
Qualquer pessoa vinculada a um instituidor. Cônjuge, companheiro(a) e dependentes econômicos
de participante já inscrito também podem aderir, sem vínculo direto com o instituidor.

=== INSTITUIDORES DO INVESTPREV ===
1. Agros - Instituto UFV de Seguridade Social* (inscrição aberta a qualquer interessado)
2. UFVCredi
3. Fecon - Federação dos Contabilistas de Minas Gerais
4. Sindisec - Sindicato dos Securitários de Minas Gerais
5. Associação Atlética Acadêmica Monetária - UFV
6. Associação dos Ex-alunos da UFV (AEA)

=== BENEFÍCIOS DO INVESTPREV ===
O plano oferece três tipos de benefício:

1. BENEFÍCIO DE RENDA MENSAL
Requisitos: idade mínima de 18 anos E (acumulação mínima de 60 meses OU saldo mínimo de 10.000 quotas).
Opções de pagamento:
  - Renda por Prazo Certo: mínimo de 60 meses.
  - Renda por Prazo Indeterminado: percentual de 0,2% a 2% do saldo por mês.
Ao solicitar, o participante pode retirar até 25% do Saldo Total em pagamento único.
Opção de 13ª parcela (abono anual, pago em dezembro).

2. PENSÃO POR MORTE
Paga aos beneficiários em caso de falecimento do participante ativo ou assistido.
Opções: prazo certo (mínimo 12 meses) ou prazo indeterminado (0,2% a 2%).
Beneficiário de participante ativo falecido pode retirar até 25% do saldo em pagamento único.

3. BENEFÍCIO TEMPORÁRIO
Para quem tem pelo menos 18 anos e ainda não cumpriu os requisitos da Renda Mensal.
- 5 a 9 anos de acumulação: até 50% do saldo.
- 10 anos ou mais: até 70% do saldo.
Duração: mínimo de 24 meses, máximo de 60 meses.
Obrigatório manter contribuições durante o período.

4. BENEFÍCIO DE RISCO (facultativo)
Cobertura para invalidez e/ou morte, mediante contratação de seguro pelo Agros.

=== CANCELAMENTO DA INSCRIÇÃO ===
A inscrição pode ser cancelada por: solicitação do participante, falecimento, recebimento
integral dos benefícios, realização de resgate total, portabilidade, ou inadimplência de
3 meses consecutivos após notificação.

=== INSTITUTOS LEGAIS ===
- Benefício Proporcional Diferido (BPD): para quem cessou o vínculo com o instituidor e tem
  pelo menos 3 anos no plano. Cessa contribuições, mas pode fazer aportes voluntários.
- Portabilidade: transfere o saldo para outro plano. Carência mínima de 36 meses.
- Resgate: carência mínima de 36 meses. Parcial: até 20% a cada 2 anos. Total: 100% do saldo.
- Autopatrocínio: participante mantém contribuições após perder o vínculo com o instituidor.

=== CARTILHA INVESTPREV — INFORMAÇÕES ADICIONAIS ===
O Agros não possui finalidade lucrativa: toda a rentabilidade retorna ao participante.
O saldo pode ser acompanhado no autoatendimento em www.agros.org.br → Autoatendimento.
Se o participante optar pelo autopatrocínio e tiver familiares inscritos, eles também
passam automaticamente para a condição de autopatrocinados.
Ao se desligar do plano de previdência, o plano de saúde do Agros é cancelado automaticamente.
`;

const CONHECIMENTO_CARTILHA_VIDAPREV = `
=== CARTILHA DO PARTICIPANTE VIDAPREV 2025 — INFORMAÇÕES COMPLEMENTARES ===

--- SOBRE O AGROS ---
O Agros – Instituto UFV de Seguridade Social é uma Entidade Fechada de Previdência
Complementar (EFPC), criada em 1980 pela Universidade Federal de Viçosa (UFV).
Em setembro de 1994, o Agros ampliou sua atuação e se tornou também operadora de plano de saúde.
Os planos de saúde podem ser oferecidos exclusivamente aos grupos familiares dos participantes
dos Planos Previdenciários vinculados às Patrocinadoras de Saúde.

MISSÃO: Gerir planos de previdência e de saúde com eficiência, segurança e sustentabilidade,
proporcionando aos beneficiários condições para melhor qualidade de vida.
VISÃO: Ser referência em qualidade e rentabilidade nos segmentos em que atua, com crescimento
do número de beneficiários e custos competitivos.

--- CATEGORIAS DE PARTICIPANTES DO VIDAPREV ---
- Participante Ativo: ainda não solicitou o recebimento de benefícios no plano.
- Assistido: participante ou beneficiário que recebe algum benefício programado pelo Plano.
- Participante Optante pelo BPD: cessou o vínculo associativo com o Instituidor antes de
  preencher as condições para o Benefício de Renda Mensal e não está em gozo de benefício.
- Participante Autopatrocinado: não tem mais vínculo com um Instituidor, mas permanece
  inscrito no Plano (mantém contribuições voluntariamente).

--- SOBRE AS CONTRIBUIÇÕES NO VIDAPREV ---
Os participantes do VidaPrev JÁ POSSUEM reserva individual constituída (transferida do Plano B).
Portanto, NÃO há contribuição obrigatória — todos já têm direito aos benefícios.
A contribuição ao VidaPrev é opcional e pode ser usada como ferramenta de dedução fiscal no IR
e para aumentar a reserva individual.

Contribuição Facultativa (periódica/mensal):
  - Caráter opcional e periódico.
  - Valor mínimo: 20% do Benefício Mínimo Mensal de Referência (atualizado anualmente em
    janeiro pelo IPCA).
  - Compromisso mínimo de 12 meses, com renovação automática.
  - Para cancelar: solicitar ao Agros; será interrompida no mês seguinte à solicitação.

Contribuição Voluntária (esporádica):
  - Feita quando o participante desejar.
  - Valor mínimo: 2x o Benefício Mínimo Mensal de Referência (atualizado em janeiro pelo IPCA).

ATENÇÃO: Contribuições devem ser pagas até o 5º dia útil do mês.
Pagamento em data posterior gera multa de 2% sobre o valor da contribuição.

--- CONTAS DO VIDAPREV ---
Conta de Participante: em nome do participante ainda não em gozo de benefício. Contém a
reserva transferida do Plano B. Nela são depositadas contribuições facultativas, voluntárias
e de terceiros. O saldo é ajustado pela rentabilidade líquida das aplicações.

Conta Benefício Concedido: em nome do Assistido (quem já recebe benefício). Dessa conta
são deduzidos mensalmente os valores dos benefícios pagos e a taxa de administração.

ATENÇÃO: Quando um participante começa a receber benefícios, a Conta de Participante é
extinta e a Conta Benefício Concedido é criada.
Em caso de falecimento do participante assistido, o Benefício de Renda por Morte é pago
aos beneficiários com os recursos disponíveis na Conta Benefício Concedido.
Se houver mais de um beneficiário, os recursos são divididos em subcontas, uma para cada.
Se não houver beneficiários inscritos, o pagamento é em parcela única para designados ou herdeiros.

--- BENEFÍCIO DE RENDA MENSAL — DETALHES ---
Requisito: idade mínima de 38 anos.
O benefício é calculado com base no saldo da conta individual, prazo escolhido e idade.
Pagamento: até o 5º dia útil do mês seguinte ao da competência.
Opção de receber em 12 ou 13 prestações por ano (13ª em dezembro, título de abono anual).

O participante pode, ao solicitar o benefício, optar por prazo superior ao mínimo regulamentar,
desde que o valor do Benefício resultante seja igual ou superior ao Benefício Mínimo Mensal
de Referência previsto no Regulamento.

--- TAXAS DO VIDAPREV ---
O Agros cobra somente a taxa de administração, definida anualmente pelo Conselho Deliberativo.
Não há taxa de carregamento.
Consulte o valor atual em: www.agros.org.br/previdencia/vidaprev

--- RENTABILIDADE DO VIDAPREV ---
A rentabilidade é dinâmica, variando mensalmente conforme os resultados dos investimentos.
Pode ser acompanhada mensalmente no site do Agros (menu VidaPrev) ou no autoatendimento.
O Agros não possui finalidade lucrativa — toda a rentabilidade líquida retorna ao participante.

--- INSTITUTOS LEGAIS (OUTRAS OPÇÕES DO VIDAPREV) ---
PORTABILIDADE: Permite transferência do Saldo Total para outro plano de previdência.
O participante pode trazer recursos externos para o VidaPrev ou levar seus recursos para
outro plano administrado pelo Agros ou outra Entidade de Previdência Complementar ou seguradora.
Carência mínima de 36 meses.

RESGATE TOTAL:
  - Carência: 60 meses contados da data efetiva de transferência do Plano B para o VidaPrev.
  - O Resgate Total implica desligamento do Plano.
  - ATENÇÃO: Se o participante for titular do plano de saúde do Agros, o resgate total
    também implica desligamento do plano de saúde. Para manter o plano de saúde, deverá
    aderir a outro plano de previdência do Agros (ex.: InvestPrev).

RESGATE PARCIAL:
  - Sem carência, para contribuições facultativas, voluntárias e portabilidades vindas de
    entidades abertas.
  - Não implica desligamento do plano.

--- BENEFÍCIO FISCAL (VidaPrev) ---
Independentemente do regime de tributação escolhido, o participante que optar por fazer
contribuições Facultativas ou Voluntárias ao VidaPrev poderá abater o valor dessas
contribuições da base de cálculo do IR, até o limite de 12% da renda anual tributável.
Para usufruir desse benefício, é necessário declarar o IR pelo formulário completo.

--- INFORMAÇÕES IMPORTANTES ---
- Se você for titular do plano de saúde do Agros, é preciso estar ligado a um plano de
  previdência do Instituto.
- Após receber todas as parcelas do Benefício de Renda Mensal a que tem direito, ou ao
  solicitar o resgate total, o participante deverá estar ativo no InvestPrev para
  permanecer no plano de saúde.
- Acompanhe seu saldo pelo autoatendimento: www.agros.org.br > Autoatendimento (login e senha).

--- GLOSSÁRIO (Entenda os Termos) ---
Assistido: Participante ou Beneficiário em gozo de benefício de renda prevista no Plano CD VidaPrev.
Beneficiário: Dependente reconhecido na Previdência Oficial, inscrito no Plano nos termos
do Regulamento.
Benefício de Renda Mensal: Benefício de prestação continuada pago ao Participante Assistido
por período determinado, conforme estabelecido no Regulamento.
Benefício Mínimo Mensal de Referência: valor mínimo abaixo do qual o VidaPrev não paga
benefícios mensais (atualizado anualmente pelo IPCA).
Data Efetiva: data em que os recursos e participantes foram transferidos do Plano B para o VidaPrev.
Instituidor: Pessoa jurídica que celebrou convênio de adesão com o Agros para oferecer o plano.
Saldo Total: valor total acumulado na conta individual do participante.
`;

const CONHECIMENTO_VIDAPREV = `
=== VIDAPREV — VISÃO GERAL ===
O VidaPrev foi criado para receber os participantes e recursos do Plano B.
CNPB: nº 2023.0016-92. CNPJ: 53.185.264/0001-23.
PLANO FECHADO PARA NOVAS ADESÕES.
Funcionamento iniciado em 1º de abril de 2024.

=== ORIGEM DO VIDAPREV ===
O Plano B era o plano de previdência dos servidores da UFV (regime RJU) administrado pelo Agros.
Em 2021, Agros, AGU, PREVIC, UFV e APAGROS assinaram o Termo de Conciliação nº 005/2021,
que determinou a criação do VidaPrev para receber os participantes e recursos do Plano B.
A transferência foi automática e obrigatória. Não era possível recusar.

=== DIFERENÇA ENTRE PLANO B e VIDAPREV ===
Plano B: modalidade Benefício Definido (mutualista). Todos compartilhavam um fundo comum.
Benefícios eram vitalícios. Havia patrocínio da UFV.
VidaPrev: modalidade Contribuição Definida. Reserva individual. Benefício dura enquanto
houver saldo. Sem patrocinadora. Quando a reserva acaba, o benefício encerra.

=== RENTABILIDADE VIDAPREV ===
Últimos 12 meses (mar/2025 a fev/2026): rentabilidade acumulada 14,02%.
Índice de referência (INPC + 4,65% a.a.): 8,16%. VidaPrev superou o índice.
Desde o início (abr/2024 a fev/2026): rentabilidade da cota 18,99% vs. índice de 18,03%.

=== QUEM SÃO OS PARTICIPANTES ===
São os servidores da UFV que ingressaram no Agros até 20 de abril de 2007 e seus pensionistas.
A UFV NÃO patrocina mais o VidaPrev (continua patrocinando apenas os planos de saúde).

=== BENEFICIÁRIOS E DESIGNADOS ===
Beneficiário Grupo 1: cônjuge, companheiro(a), filho inválido, ex-cônjuge/ex-companheiro com
pensão alimentícia.
Beneficiário Grupo 2: filho e enteado até 21 anos, ou até 24 anos se matriculado em ensino superior.
Designado: qualquer pessoa indicada pelo participante para receber saldo na inexistência de beneficiários.

=== CONTRIBUIÇÕES NO VIDAPREV ===
Contribuição Facultativa: mínimo de 20% do Benefício Mínimo Mensal de Referência, por prazo
mínimo de 12 meses.
Contribuição Voluntária: valor esporádico, mínimo de 2x o Benefício Mínimo Mensal de Referência.
Contribuição Administrativa: destinada ao custeio do plano, definida anualmente no Plano de Custeio.
Multa por atraso: 2%.

=== BENEFÍCIOS DO VIDAPREV ===
O plano oferece dois benefícios:

1. BENEFÍCIO DE RENDA MENSAL
Requisito: idade mínima de 38 anos.
Prazos mínimos de recebimento por faixa de idade:
  - Até 69 anos:   180 meses (15 anos)
  - 70 a 74 anos:  144 meses (12 anos)
  - 75 a 79 anos:  120 meses (10 anos)
  - 80 a 84 anos:   96 meses  (8 anos)
  - 85 a 89 anos:   72 meses  (6 anos)
  - 90 anos e +:    36 meses  (3 anos)

O benefício é recalculado anualmente em janeiro.
O participante pode alterar o prazo residual até setembro de cada ano (vigência no ano seguinte).

Opções ao solicitar (Art. 52 do Regulamento):
  a) Retirar 5% do saldo no primeiro pagamento.
  b) Receber em 13 parcelas (abono anual em dezembro).
  c) Escolher prazo superior ao mínimo para sua idade.

2. BENEFÍCIO DE RENDA POR MORTE
Pago aos beneficiários do participante falecido.
Situações: falecimento de participante ativo, falecimento de participante assistido, ou
beneficiário já em gozo de pensão por morte na Data Efetiva.
Rateado em partes iguais entre os beneficiários.
Na falta de beneficiários, o saldo vai para os designados ou herdeiros legais.

=== INSTITUTOS LEGAIS DO VIDAPREV ===
- Portabilidade: carência mínima de 36 meses. Permitida entre planos do próprio Agros.
- Resgate Total: carência de 60 meses da Data Efetiva. Implica desligamento.
- Resgate Parcial: sem carência, para contribuições facultativas/voluntárias e portabilidades
  vindas de entidades abertas. Não implica desligamento.
- Autopatrocínio: manter contribuições após cessar o vínculo com o Agros.
- BPD (Benefício Proporcional Diferido): carência mínima de 3 meses.

=== ACOMPANHAR SALDO E CONTRACHEQUE ===
Acesse www.agros.org.br → Autoatendimento → Login e senha.
Para emitir contracheque: Demonstrativo de Pagamento → Emitir → escolha ano e mês.

=== PERGUNTAS FREQUENTES — VIDAPREV ===
P: O que é o VidaPrev?
R: Plano de Contribuição Definida criado para receber participantes e recursos do Plano B,
conforme o Termo de Conciliação nº 005/2021. Fechado para novas adesões.

P: A transferência do Plano B era obrigatória?
R: Sim. Era obrigatória para todos os participantes, assistidos e pensionistas do Plano B.

P: A UFV ainda patrocina o VidaPrev?
R: Não. O VidaPrev não tem patrocinadora. A UFV continua patrocinando apenas os planos de saúde.

P: O VidaPrev tem empréstimo?
R: Inicialmente não. O Agros estuda a possibilidade e informará os participantes se isso mudar.

P: Posso ter o plano de saúde do Agros sendo participante do VidaPrev?
R: Sim, desde que mantenha o vínculo com o plano de previdência.

P: O que acontece com o saldo após o falecimento do último beneficiário?
R: O saldo remanescente vai para os designados ou, na falta deles, para os herdeiros legais.
`;

const CONHECIMENTO_IR = `
=== IMPOSTO DE RENDA NA PREVIDÊNCIA COMPLEMENTAR ===
Ao solicitar benefício mensal ou resgate, o participante deve escolher o regime de tributação.
A escolha é OBRIGATÓRIA, INDIVIDUAL e IRRETRATÁVEL — não pode ser alterada depois.
No InvestPrev: a opção deve ser feita até o último dia útil do mês seguinte à data de inscrição.

Há dois regimes:

--- REGIME PROGRESSIVO ---
Mesmo critério usado nos salários. A alíquota depende do valor da renda mensal recebida.

Tabela IRPF 2025 (vigente a partir de maio):
  Até R$ 2.428,80         → 0% (isento)
  R$ 2.428,81 a 2.826,65 → 7,5% (deduz R$ 182,16)
  R$ 2.826,66 a 3.751,05 → 15%  (deduz R$ 394,16)
  R$ 3.751,06 a 4.664,68 → 22,5% (deduz R$ 675,49)
  Acima de R$ 4.664,68   → 27,5% (deduz R$ 908,73)

Deduções permitidas:
  - R$ 189,59 por dependente legal.
  - R$ 1.903,98 para contribuintes com 65 anos ou mais (limite: R$ 22.847,76 anual).

Para resgate no regime progressivo: alíquota fixa de 15% na fonte, com ajuste na
Declaração Anual (pode chegar a 27,5% ou gerar restituição).

Características:
  - Benefício: alíquota varia conforme o valor recebido. Sujeito ao ajuste anual.
  - Resgate: 15% na fonte + possível complementação até 27,5% na declaração anual.
  - Permite compensação na Declaração de Ajuste Anual.

--- REGIME REGRESSIVO ---
A alíquota diminui quanto mais tempo os recursos ficam no plano.

Tabela por prazo de acumulação:
  Até 2 anos:          35%
  2 a 4 anos:          30%
  4 a 6 anos:          25%
  6 a 8 anos:          20%
  8 a 10 anos:         15%
  Acima de 10 anos:    10%

Para benefícios não programados (ex.: pensão por morte): alíquota mínima de 10%.

Características:
  - Tributação definitiva — não vai para a declaração anual.
  - Não há deduções por dependente ou idade.
  - Cada contribuição tem sua própria "data de aniversário" para contagem do prazo.
  - Quanto mais tempo o dinheiro fica no plano, menor o imposto.

--- QUAL REGIME ESCOLHER? ---
Não existe resposta única. Considere:
  - Valor estimado do benefício ou resgate.
  - Outras fontes de renda (soma com aposentadoria, salário etc.).
  - Tempo que o dinheiro vai ficar no plano (prazo de acumulação).
  - Deduções disponíveis (dependentes, idade, pensão alimentícia).
  - Planos futuros (quando pretende resgatar ou receber benefício).

Em caso de dúvida, consulte seu contador ou entre em contato com o Agros.

--- DEDUÇÃO DE CONTRIBUIÇÕES ---
Independente do regime escolhido: as contribuições feitas ao plano podem ser abatidas
da base de cálculo do IR, até o limite de 12% da renda bruta anual tributável.
Para isso, é necessário fazer a Declaração no modelo completo (não simplificado).

Para o VidaPrev: se você tem dependentes, certifique-se de que o cadastro deles está
atualizado no Agros para garantir a dedução correta.

Se você tem isenção por moléstia grave: certifique-se de que essa informação está
atualizada no Agros para evitar desconto indevido de imposto.
`;

const CONHECIMENTO_POLITICA = `
=== POLÍTICA DE INVESTIMENTOS VIDAPREV 2024-2028 ===
Meta: INPC + 4,65% ao ano.

Alocação dos recursos:
  Renda Fixa:         70% (objetivo) | limite legal: 100%
  Renda Variável:      4% (objetivo) | limite legal: 70%
  Estruturado:        15% (objetivo) | limite legal: 20%
  Imobiliário:         5% (objetivo) | limite legal: 20%
  Operações c/ Part.:  5% (objetivo) | limite legal: 15%
  Exterior:            1% (objetivo) | limite legal: 10%

Gestão de riscos: VaR máximo de 3% (95% de confiança, 21 dias úteis).
Crédito: somente ativos com grau de investimento (mínimo BBB- nas agências Fitch, S&P, Moody's, etc.).

Perfil do VidaPrev (dados base dez/2023):
  Participantes ativos: 3.257 | Assistidos/beneficiários: 567
  Patrimônio Total: R$ 774.467.288,69
`;

const BASE_INVESTPREV = `${CONHECIMENTO_INVESTPREV}\n\n${CONHECIMENTO_IR}`;
const BASE_VIDAPREV = `${CONHECIMENTO_VIDAPREV}\n\n${CONHECIMENTO_CARTILHA_VIDAPREV}\n\n${CONHECIMENTO_IR}\n\n${CONHECIMENTO_POLITICA}`;

const CONHECIMENTO_OUTROS = `
=== OUTROS ASSUNTOS — ÁREAS DE APOIO DO AGROS ===
Este contexto cobre demandas administrativas gerais: plano de saúde, emissão de boletos,
mensalidades, segunda via, atualização cadastral, notícias e comunicados.

--- PLANO DE SAÚDE AGROS ---
- O Agros é operadora de plano de saúde desde 1994.
- Os planos de saúde são oferecidos exclusivamente aos grupos familiares dos participantes
  dos Planos Previdenciários vinculados às Patrocinadoras de Saúde.
- Para manter o plano de saúde é obrigatório estar vinculado a um plano de previdência
  do Agros (InvestPrev ou VidaPrev). Se o vínculo previdenciário cessar, o plano de saúde
  é cancelado automaticamente.
- Dúvidas operacionais (rede credenciada, autorizações, reembolsos, carteirinha) devem ser
  tratadas diretamente com a equipe do Agros pelos canais oficiais.

--- BOLETOS E MENSALIDADES ---
- Vencimento padrão: até o 5º dia útil do mês.
- Atraso gera multa de 2% sobre o valor da contribuição/mensalidade.
- Segunda via de boleto e demonstrativos: pelo Autoatendimento em www.agros.org.br
  (Autoatendimento → login e senha).
- Demonstrativo de pagamento / contracheque: Autoatendimento → Demonstrativo de
  Pagamento → Emitir → escolher ano e mês.

--- NOTÍCIAS E COMUNICADOS ---
- Página oficial de notícias: https://www.agros.org.br/noticias
- FAQ / Perguntas frequentes: https://www.agros.org.br/faq
- Sempre que o usuário perguntar sobre prazos recentes, cobranças do mês atual, comunicados
  novos ou imprevistos operacionais, use a ferramenta fetch_url para consultar essas páginas
  antes de responder.

--- ATENDIMENTO HUMANO ---
- Telefone / WhatsApp: (31) 3899-6550
- Site: www.agros.org.br
- Instagram: @agrosprevsaude
`;

const BASE_INVESTPREV = `${CONHECIMENTO_INVESTPREV}\n\n${CONHECIMENTO_IR}`;
const BASE_VIDAPREV = `${CONHECIMENTO_VIDAPREV}\n\n${CONHECIMENTO_CARTILHA_VIDAPREV}\n\n${CONHECIMENTO_IR}\n\n${CONHECIMENTO_POLITICA}`;
const BASE_OUTROS = `${CONHECIMENTO_OUTROS}\n\n${CONHECIMENTO_INVESTPREV}\n\n${CONHECIMENTO_VIDAPREV}\n\n${CONHECIMENTO_IR}`;

type Contexto = "invest" | "vida" | "outros";

function regrasPorContexto(ctx: Contexto): string {
  if (ctx === "invest") {
    return `CONTEXTO ATUAL: InvestPrev (o usuário entrou pelo cartão InvestPrev).
LIMITE ESTRITO: responda APENAS sobre o regulamento, contribuições, benefícios, resgate, IR e regras do InvestPrev.
Se o usuário perguntar sobre VidaPrev, plano de saúde, boletos ou outros assuntos, responda com educação:
"Como estamos na aba do InvestPrev, meu foco é este plano. Para dúvidas de [VidaPrev / Saúde / Outros Assuntos], por favor, retorne à tela inicial e escolha o cartão correspondente."`;
  }
  if (ctx === "vida") {
    return `CONTEXTO ATUAL: VidaPrev (o usuário entrou pelo cartão VidaPrev).
LIMITE ESTRITO: responda APENAS sobre o regulamento, contribuições, benefícios, resgate, IR e regras do VidaPrev.
Se o usuário perguntar sobre InvestPrev, plano de saúde, boletos ou outros assuntos, responda com educação:
"Como estamos na aba do VidaPrev, meu foco é este plano. Para dúvidas de [InvestPrev / Saúde / Outros Assuntos], por favor, retorne à tela inicial e escolha o cartão correspondente."`;
  }
  return `CONTEXTO ATUAL: Outros Assuntos (o usuário entrou pelo cartão Outros Assuntos).
ESCOPO: você é universal aqui. Responda sobre plano de saúde, boletos, mensalidades, notícias e demandas administrativas usando a base e a ferramenta fetch_url quando necessário (FAQ e Notícias do Agros).
EXCEÇÃO IMPORTANTE: se o usuário perguntar sobre InvestPrev ou VidaPrev, NÃO o mande mudar de aba. Consulte a base de previdência, responda perfeitamente a dúvida e adicione ao final, em itálico, a nota sutil:
"_(Dica: temos cartões específicos para o seu plano na tela inicial para consultas mais rápidas!)_"
TRANSBORDO: se, após consultar a base e as páginas do Agros, você não tiver certeza da resposta, peça desculpas, informe que é uma IA em treinamento e diga literalmente:
"Vou transferir você agora mesmo para a nossa equipe de atendimento humano continuar de onde paramos, por favor, aguarde um instante." — em seguida, informe o telefone (31) 3899-6550.`;
}

function montarPrompt(ctx: Contexto): string {
  const base = ctx === "vida" ? BASE_VIDAPREV : ctx === "outros" ? BASE_OUTROS : BASE_INVESTPREV;
  const nomeCtx = ctx === "vida" ? "VidaPrev" : ctx === "outros" ? "Outros Assuntos" : "InvestPrev";

  return `Você é a Prev, assistente virtual do Agros.

${regrasPorContexto(ctx)}

ESTILO DE RESPOSTA (OBRIGATÓRIO):
- CURTA, DIRETA E OBJETIVA. Pense em uma mensagem de chat, não em um artigo.
- Limite máximo: 3 parágrafos curtos OU uma lista com até 5 itens enxutos.
- Vá direto ao ponto. SEM introduções, saudações repetidas, agradecimentos ou frases de preenchimento.
- SEM repetir a pergunta. SEM resumos finais.
- Use linguagem simples, frases curtas. Negrito apenas em números/prazos-chave.
- Quando citar regra, mencione o artigo entre parênteses: "(Art. X)".
- Se a pergunta for vaga, faça UMA pergunta curta de esclarecimento.
- NUNCA invente. Use somente a base abaixo e, quando autorizado, a ferramenta fetch_url.
- Só cite o telefone (31) 3899-6550 quando realmente precisar de atendimento humano.

TRATAMENTO DE LINGUAGEM E ERROS DE DIGITAÇÃO (CRÍTICO):
- O público é diverso em idade e familiaridade com tecnologia. Seja EXTREMAMENTE TOLERANTE a erros de digitação, ortografia, gramática, falta de acentuação e abreviações informais (ex.: "vc", "tbm", "q", "pq", "tb", "obg", "blz", "invest previ", "vida preve", "previdencia", "aposentadoria compl").
- Sempre analise o CONTEXTO para entender a intenção real, mesmo que a frase esteja mal escrita, confusa ou incompleta.
- REGRA DE OURO: NUNCA corrija o usuário, NUNCA aponte erro ortográfico, NUNCA peça para reescrever. Interprete silenciosamente e responda com naturalidade, clareza e empatia.

FERRAMENTA fetch_url (LEITURA DE WEB EM TEMPO REAL):
- Use a ferramenta fetch_url quando o usuário perguntar sobre informações que podem ter mudado recentemente: prazos do mês atual, cobranças, comunicados, notícias, datas de assembleia, novidades operacionais.
- URLs permitidas: somente dentro do domínio agros.org.br (ex.: https://www.agros.org.br/noticias, https://www.agros.org.br/faq, https://www.agros.org.br/previdencia/vidaprev).
- Use no máximo 2 chamadas por resposta. Se a página não trouxer a informação, não invente — siga o fluxo de transbordo.

CONTATOS DO AGROS:
- Telefone / WhatsApp: (31) 3899-6550
- Site: www.agros.org.br
- Instagram: @agrosprevsaude

BASE DE CONHECIMENTO — ${nomeCtx.toUpperCase()}:
${base}`.trim();
}

// Histórico em memória por (user_id + contexto). Reinicia a cada cold start.
const conversationStore = new Map<string, Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown; name?: string }>>();

// ------------ Ferramenta: fetch_url (apenas agros.org.br) ------------
const TOOLS = [
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Busca o conteúdo textual de uma página pública do site do Agros (agros.org.br). Use para consultar notícias, FAQ ou páginas oficiais quando precisar de dados atualizados.",
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
    // Extrai texto bruto (remove tags, scripts e estilos)
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
    const ctx: Contexto =
      body.assistant === "vida" ? "vida" : body.assistant === "outros" ? "outros" : "invest";

    if (!userId || !mensagem) {
      return new Response(
        JSON.stringify({ error: "user_id e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    mensagem = mensagem.slice(0, 500);

    const chave = `${userId}_${ctx}`;
    const historico = conversationStore.get(chave) ?? [];
    historico.push({ role: "user", content: mensagem });
    // Mantém últimas 10 trocas (mas preserva pares tool-call/tool-response)
    const ultimas = historico.slice(-12);

    const mensagensIA: Array<Record<string, unknown>> = [
      { role: "system", content: montarPrompt(ctx) },
      ...ultimas.map((m) => ({ ...m })),
    ];

    let textoResposta = "";
    // Loop de tool-calls (máx. 3 iterações)
    for (let iter = 0; iter < 4; iter++) {
      const payload: Record<string, unknown> = {
        model: GROQ_MODEL,
        messages: mensagensIA,
        max_tokens: 400,
        temperature: 0.2,
      };
      // Só oferecemos a ferramenta no contexto "outros"
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
        // Adiciona resposta do assistente (com tool_calls) ao histórico de execução
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
        // continua loop para que o modelo gere a resposta final usando o resultado
        continue;
      }

      textoResposta = msg?.content ?? "";
      break;
    }

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
