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

### Onde a IA errou e como corrigi

**Erros da IA (registrados em process-log/DECISIONS.md):**

1. **IA rotulou dataset "LIKELY-SYNTHETIC", propôs framing de "demo"** → Líder corrigiu: dados são reais de negócio; entregáveis client-facing devem tratar como tal, nunca mencionar "Kaggle/sintético". Achado nulo é resultado legítimo, não desculpa.

2. **IA usou jargão estatístico (p-value, decile, Mann-Whitney U)** em findings → Líder exigiu linguagem de marketing clara (percentuais, "efeito de X%", "confiança alta/média/baixa").

3. **Gráfico 02 com eixo y amplificado** (parecia mostrar diferença grande sendo <0,2%) → Detectado na revisão round 2; reconstruído com escala honesta.

4. **Pooling ingênuo patrocinado-vs-orgânico** no dashboard (violava GATE 0) → Corrigido para mediana de razões por grupo (controlada por plataforma × categoria × tier), igual à metodologia F11.

5. **LLM recomendações classificou 0,02pp como "alta confiança"** → Piso de materialidade adicionado (diferenças <3pp forçadas a "baixa confiança").

6. **Modelo tentou subtrair percentuais** (reportou 0,032pp como 3,2pp) → Corrigido pré-calculando todas as contas em código, proibindo modelo de refazer.

### O que eu adicionei que a IA sozinha não faria

1. **Decisão de rigor antes de analisar:** Segmentar obrigatoriamente; nunca reportar taxa isolada; testar 6.760 combinações; estabelecer linha de 5% para "efeito real"; separar explicitamente "alta confiança" de "hipótese a testar".

2. **Reframing de achado nulo:** Transformar "não encontramos driver" em recomendação de negócio (parar de pagar mais caro, testar nichos em paralelo, estruturar contrato por desempenho) — nada de "dados fracos, desculpa".

3. **Teste proativo do benchmark do brief:** Líder teve hipótese ("vídeo 30-60s tech, criadores 10K-50K, 3,2x") → pediu teste mesmo (resultado: 1,00x, n=20, não suporta). Isso validou o rigor da metodologia.

4. **Auditoria independente:** Pediu novo agente isolado confirmar F01, F11, F17. Resultado: confirmado.

5. **Dashboard acionável:** Não apenas gráficos; filtros self-service, indicador de lift, recomendações por IA — permitindo o Head de Marketing explorar dados sem depender de análise ad hoc.

6. **Julgamento de confiança:** Decisão de incluir F10 como "monitorar, não agir" (sinal fraco <1,5pp) e F06/F07/F08/F09 como "teste 4–6 semanas antes de escalar" (ambas +0,9%, mas poucas replicações).

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
