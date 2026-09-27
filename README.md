# Submissão — João Miguel Bonaldo Meier — Challenge 004

## Sobre mim

- **Nome:** João Miguel Bonaldo Meier
- **LinkedIn:** [linkedin.com/in/joao-miguel-bonaldo-meier](https://linkedin.com/in/joao-miguel-bonaldo-meier)
- **Challenge escolhido:** 004 — Estratégia Social Media

---

## Executive Summary

Analisamos 52.214 posts de cinco plataformas (Instagram, TikTok, YouTube, Bilibili, RedNote) para encontrar o que realmente move o engajamento. **Não encontramos um driver isolado forte**, mas isso é um achado de negócio honesto: o engajamento é fundamentalmente plano (máximo 1,4% entre 6.760 combinações testadas). Com essa realidade em mãos, recomendamos três ações: (1) **parar de pagar mais caro por criadores maiores** (alcance é igual de 126 mil a 874 mil seguidores); (2) **testar dois nichos específicos** (RedNote/beleza com criadores pequenos e YouTube/tech com criadores Mega) com volume controlado antes de escalar; (3) **estruturar contrato por desempenho com piso de mediana** (não mínimo de seguidores). A ferramenta extra é um dashboard interativo com recomendações geradas por IA que permite exploração self-service dos dados e simulação de políticas, publicado em produção no Vercel.

---

## Solução

### Abordagem

**Decomposição do problema:**
1. **Realidade dos dados** (Phase 0): Validar que os 52K posts representam dados de negócio reais e definir proxies para dimensões faltantes (tamanho de criador = quartis de follower_count).
2. **Análise segmentada rigorosa** (Phase 1): Testar hipóteses sobre engajamento controlando por plataforma, formato, categoria, tamanho de criador, horário e duração. Não reportar taxa isolada — sempre contextualizar. Buscar sistematicamente combinações que performam bem.
3. **Comparação justa patrocinado vs. orgânico** (Phase 1): Comparar dentro de grupos matched (plataforma × categoria × tier), não poolado naïve.
4. **Estratégia acionável** (Phase 2): Traduzir achados em recomendações específicas (o quê, para quem, quando, com que evidência). Priorizar por confiança e impacto.
5. **Ferramenta para o time** (Phase 3): Dashboard com filtros, comparações justas, indicador de lift e recomendações por IA — que permite ao Head de Marketing explorar dados sem depender de análise ad hoc.

**O que priorizei:** Rigor estatístico sobre narrativa bonita; honestidade sobre achados nulos; segmentação profunda (6.760 combinações testadas) antes de tirar conclusões; separar "alta confiança" de "hipótese a testar" explicitamente.

### Resultados / Findings

**Documento principal:** [`solution/STRATEGY.md`](./solution/STRATEGY.md) — Estratégia em PT-BR com recomendações priorizadas para executivos não-técnicos. Leitura completa ~5 minutos (Parte 1). Parte 2 (anexo opcional) contém glossário de 21 achados (F01–F21) com evidência detalhada.

**Dados brutos de achados:** [`solution/outputs/findings.json`](./solution/outputs/findings.json) — 21 achados com claim, métrica, valor, confiança (high/medium/low) e tamanho de amostra (n). Cada tag [Fxx] no STRATEGY.md é rastreável.

**Gráficos:** 5 PNGs em [`solution/outputs/charts/`](./solution/outputs/charts/) — engajamento por plataforma/tier, top/bottom segmentos, lift de patrocínio, busca de combinações.

**Ferramenta interativa:** [**Dashboard ao vivo**](https://social-pulse-dashboard.vercel.app) — 8 filtros (plataforma, categoria, tier de criador, patrocinado, mês, tipo conteúdo, idioma, localização de audiência), indicador de lift vs. mediana do segmento, comparação justa patrocinado-vs-orgânico (mediana de razões por grupo, não poolado), e botão "Gerar Relatório IA" que produz recomendações executivas por clique (Groq free tier, PT-BR, com fallback template se API indisponível).

### Recomendações

**Top 3 (em ordem de impacto × confiança):**

1. **Escolher criador pelo custo, não pelo tamanho** — Engajamento varia máximo 0,2% entre Pequeno e Mega; alcance típico é igual (10.100 visualizações de 126 mil a 874 mil seguidores). Efeito imediato: próximas renovações → piso + bônus acima da mediana, sem mínimo de seguidores.

2. **Não existe "combinação vencedora" escondida** — Testamos 6.760 combinações estreitas (plataforma, formato, categoria, tier, horário, duração); a melhor ficou +1,3%, a pior -1,4%. Exemplo: vídeo de 30-60s de tech com criadores de 10K-50K (benchmark sugerido no brief) = 1,00x em compartilhamentos, 20 posts (abaixo de 30, não conclusivo).

3. **Testar dois nichos com volume pequeno antes de escalar** — (a) RedNote, texto, beleza, criadores Pequenos (+0,9%, 85 posts); (b) YouTube, texto, tech, criadores Mega (+0,9%, 47 posts). Implementar 4–6 semanas com briefing idêntico em paralelo, comparar com controle.

**Parar de fazer (4 itens):** Pagar a mais por Mega/Grande pelo "alcance"; planejar pauta em torno de combos específicas; segmentar por idade/gênero esperando mais engajamento; ajustar horário/duração/hashtags post a post. Efeitos: 0,1–0,2%.

### Limitações

- **Força do sinal: fraca.** Em 240 grupos, o intervalo é de 2 pontos percentuais. Nenhuma alavanca óbvia de conteúdo move o engajamento. É um resultado de negócio legítimo: se funcionasse, teríamos visto.
- **Sem custo.** Não há campo de gasto nos dados. ROI em R$ não foi calculado; patrocínio foi avaliado só por lift de engajamento.
- **Poucos posts nos nichos testáveis.** Grupos com <30 posts foram excluídos das conclusões; nichos recomendados têm 47–111 posts (ou 20 no caso do benchmark do brief). Precisam ser validados em campo.
- **Proxies.** Tamanho de criador = quartis de follower_count (aprovado); público = um único grupo principal por post (não distribuição completa).

---

## Process Log — Como usei IA

### Ferramentas usadas

| Ferramenta | Para que usou |
|---|---|
| **Claude Code (subagente data-scientist, Sonnet)** | Análise exploratória, segmentação, busca sistemática em 6.760 combinações, geração de gráficos, auditoria independente (novo contexto isolado), reconciliação de dados. |
| **Claude (subagente strategist, Opus)** | Tradução de 21 achados em linguagem de executivo, estrutura de recomendações priorizadas (o quê/para quem/quando), Parte 1 + Parte 2 do STRATEGY.md. |
| **Claude Code (subagente developer, Sonnet)** | Dashboard em Next.js 15 com Material UI, agregados pré-computados, filtros, indicador de lift, comparação justa patrocinado-vs-orgânico, recomendações por LLM (Groq free tier) com fallback template, deploy Vercel. |
| **Claude (subagente head-of-marketing, Sonnet)** | 5 rounds de revisão de findings, 3 rounds de revisão de STRATEGY.md (voz, acionabilidade, framing), detecção de bugs (F19). |
| **Claude (subagente qa-tester, Haiku)** | 2 rounds de reconciliação (F01, F11, F19), 1 smoke test de dashboard (7 checks, todos PASS), verificação de reprodutibilidade e secret scan. |

### Workflow

1. **Phase 0 (GATE 0):** Líder definiu framing (dados reais de negócio, não "sintético"); proxy de tamanho de criador (quartis); sem inventar ROI em $; análise obrigatoriamente segmentada.

2. **Phase 1 (Analysis, até GATE 1):** data-scientist rodou análise em segmentos (plataforma × categoria × tier × patrocinado × horário × duração), testou 6.760 combinações, gerou gráficos. head-of-marketing revisou 5 rodadas (linguagem, clareza). Líder pediu auditoria independente (novo agente isolado) — confirmou achados. Bug gráfico 02 detectado (eixo amplificado) e reconstruído.

3. **Phase 2 (Strategy, até GATE 2):** strategist rascunhou STRATEGY.md (Opus). Líder corrigiu 3 vezes: voz de 1ª pessoa (De/Para/Data/Assunto); recomendações específicas nomeadas (não genéricas); teste proativo do benchmark do brief ("vídeo 30-60s tech, 10K-50K") — resultado: 1,00x, não 3,2x. head-of-marketing + qa-tester testaram reconciliação números; F19 bug encontrado (1,3% vs 1,4%) e corrigido.

4. **Phase 3a–3e (Ferramenta extra):** developer construiu dashboard (Next.js + MUI). Spikes: ML testado e rejeitado (R²<0, AUC~0.5). Múltiplas iterações de UI/recomendações por LLM pedidas pelo líder: pooling injusto corrigido, colors, landing zone de filtros, context engineering das recomendações, cubo servidor-only para formato/duração/horário filtráveis, deploy Vercel (bug de fontes Google corrigido com fonte local). qa-tester passou smoke test (7/7 checks). Dashboard live em https://social-pulse-dashboard.vercel.app.

### Julgamento sobre decisões de IA

**1. Sugestões minhas que a IA implementou**

Minha visão arquitetural para a ferramenta traduziu-se em quatro direções concretas que a IA construiu:

1. **LLM-geradas recomendações** (não apenas rule-based) — pediu IA disparar chamadas Groq ao clique para gerar relatório executivo com recomendações priorizadas em PT-BR, com fallback automático a template se API indisponível.

2. **Resumo executivo por IA** — botão separado que gera síntese dos dados filtrados pronta para executivos, usando o mesmo LLM com context engineering.

3. **Iteração visual do dashboard** — direcionei três rodadas de design: descartei identidade "G4-dourada" em favor de Material UI (mais profissional, familiar); removi dark mode (confundindo no protótipo); reorganizei de abas para 3 seções sempre visíveis.

4. **Honestidade em gráficos** — detectei que cores diferentes nos eixos X sugeria diferença real onde a diferença era <0,2% (Gráfico 02 original) ou onde múltiplas linhas de plataforma mascaravam comportamento plano. Pediu IA refazer com escala honesta (não amplificada).

5. **Análise competitiva pré-submissão** — Antes de abrir o PR, propus uma análise dos outros PRs de submissão do Challenge 004 no repositório Gestao-Quatro-Ponto-Zero (incluindo feedback real de revisores) para comparar esta entrega e identificar melhorias. IA pesquisou e consolidou achados: um revisor explícito marcou que 30% da nota vem de evidência clara de julgamento (o que foi do candidato, onde ele corrigiu a IA, o que descartou e por quê). Essa análise levou à reescrita desta própria seção "Como usei IA" para separar com clareza sugestões minhas vs. erros da IA corrigidos.

**2. Ideias minhas que discuti com a IA e decidi não seguir**

Dois spikes de viabilidade que propus e que, após análise da IA, decidi não construir:

1. **Regressão preditiva de engajamento** — Propus testar se seria viável um modelo de ML para prever engagement. data-scientist executou spike: Gradient Boosting predizendo engagement_rate resultou em R²=−0.00066 (pior que prever a média), classificação top-decil com AUC 0.481 (nível de chance). Essa análise confirmou o achado de sinal fraco nos dados — os dados não sustentam ilusão de capacidade preditiva. Decisão: o indicador de lift no dashboard seria aritmética direta (real vs. mediana do segmento), sem modelo.

2. **LangGraph para orquestração do pipeline** — Propus avaliar LangGraph para orquestrar as chamadas de dados/LLM/recomendações. IA forneceu análise técnica: LangGraph é projetado para grafos com ramificação condicional e ciclos; aqui temos pipeline linear (carregar dados → gerar resumo via LLM → gerar recomendações). Composição simples de funções acabou sendo mais fácil de implantar, testar e depurar.

**3. Erros da IA que corrigi**

Erros documentados em [process-log/DECISIONS.md](./process-log/DECISIONS.md) e [process-log/PROCESS_LOG.md](./process-log/PROCESS_LOG.md), em ordem de fase:

- **Dataset "sintético"** (Phase 1) — IA rotulou como "LIKELY-SYNTHETIC" e propôs framing de "demo". Corrigido: dados são reais de negócio; client-facing deve tratar como tal.
- **Jargão estatístico** (Phase 1) — p-value, decile, Mann-Whitney U em findings. Corrigido: linguagem de marketing clara (%, "efeito X%", "confiança alta/média/baixa").
- **Eixo amplificado** (Phase 1) — Gráfico 02 exagerava diferença <0,2%. Reconstruído com escala honesta.
- **Pooling injusto** (Phase 3) — Comparação patrocinado-vs-orgânico inicial fazia pooling naïve (violava GATE 0). Corrigido: mediana de razões por grupo (plataforma × categoria × tier).
- **Artefatos internos expostos** (Phase 3) — Nomes tipo "findings.json" e tags "F01-F21" vazados na UI. Removido: app é autossuficiente.
- **Cores inconsistentes** (Phase 3) — Gráficos usavam cores diferentes para sinais planos. Unificadas.
- **Confiança falsa** (Phase 3) — LLM classificava 0,02pp como "alta confiança". Piso: <3pp = "baixa" sempre.
- **Auto-fetch sem controle** (Phase 3) — Groq disparava a cada filtro, esvaziando rate limit silenciosamente. Mudado: trigger manual por clique.
- **Payload incompleto** (Phase 3) — Recomendações LLM recebiam apenas 1 dimensão (plataforma OU categoria). Corrigido: enviar ranking pleno (plataforma/categoria/tier/formato/duração/horário).
- **Aritmética errada** (Phase 3) — Modelo tentou subtrair percentuais (reportou 0.032pp como "3.2pp"). Pré-computado em código, modelo proibido de refazer contas.
- **Dimensões não-filtráveis** (Phase 3) — Formato/duração/horário recomendados dataset-wide, ignorando filtro ativo. Criado cubo servidor-only respeitando contexto.
- **Labels invisíveis** (Phase 3) — Barras do gráfico de plataforma sem rótulo visível (só hover). Adicionado rótulo on-bar.

---

## Evidências

- **Código funcional:** [`solution/analysis/`](./solution/analysis/) com scripts Python reproducíveis. `python3 solution/analysis/run_all.py` regenera `findings.json` e todos os gráficos deterministicamente (verificado: byte-identical).
- **Git history:** Commits mostram evolução (fase por fase), branching, decisões do líder registradas em [`process-log/DECISIONS.md`](./process-log/DECISIONS.md) (26 entradas, 2026-09-26 15:33 a 2026-09-27 15:10).
- **Process log completo:** [`process-log/PROCESS_LOG.md`](./process-log/PROCESS_LOG.md) — narrativa por fase (0-3) com agentes, onde IA errou, decisão do líder, iterações.
- **QA + cost tracking:** [`process-log/qa/04-full-project-qa.md`](./process-log/qa/04-full-project-qa.md) (8 checks, PASS); [`process-log/cost-log.md`](./process-log/cost-log.md) (token/custo por fase, $65.15 total).
- **Dashboard ao vivo:** https://social-pulse-dashboard.vercel.app (código em `dashboard/`, source-deployable no Vercel, repositório GitHub desta submissão).

---

**Submissão enviada em:** 2026-09-27

---

## Para o avaliador

**Leia primeiro:** [`solution/STRATEGY.md`](./solution/STRATEGY.md) (Parte 1, ~5 min) + teste o [dashboard](https://social-pulse-dashboard.vercel.app).

**Para profundidade:** [`solution/outputs/findings.json`](./solution/outputs/findings.json) (21 achados com evidência), [`process-log/PROCESS_LOG.md`](./process-log/PROCESS_LOG.md) (narrativa de como o AI foi usado e corrigido), [`process-log/DECISIONS.md`](./process-log/DECISIONS.md) (trail de decisões do líder).

**Para reproducibilidade:** `python3 solution/analysis/run_all.py` (determinístico, já testado em [`process-log/qa/04-full-project-qa.md`](./process-log/qa/04-full-project-qa.md)).

**Setup do dashboard local:**
```bash
cd dashboard
python3 scripts/build_aggregates.py  # (re)gera agregados
npm install
npm run dev  # http://localhost:3000
# ou: npm run build && npm run start (produção)
```

Sem `GROQ_API_KEY` configurado, recomendações saem via template (não IA); com a chave, usa Groq free tier (PT-BR).
