# Process Log — Challenge 004
_Mantido pelo agente documenter a partir de process-log/handoffs/ e DECISIONS.md._

## Fase 1 — Analysis (2026-09-26)

**Entregáveis:** solution/outputs/findings.json (F01–F20, 15.0 KB), 5 gráficos PNG, 3 scripts Python.

**Agentes/Modelos:** data-scientist (sonnet) — análise segmentada, auditoria, correção de gráficos; head-of-marketing (sonnet) — 5 rodadas de revisão.

**IA errou / Corrigido:**
- IA rotulou dataset "LIKELY-SYNTHETIC" e propôs framing de "demo de metodologia" → líder corrigiu: tratar como dados reais de negócio em todos os entregáveis client-facing.
- IA usou jargão estatístico (p-value, decile, Mann-Whitney U) em findings → líder exigiu linguagem de marketing clara.
- Gráfico 02 com eixo y amplificado, exagerando diferença <0.2% → detectado na revisão round 2, reconstruído.

**Decisões do líder:** dataset real (não sintético); patrocínio medido por lift de engajamento apenas (sem ROI $ inventado); proxy de tamanho de criador = quartis de follower_count; análise segmentada obrigatória; auditoria independente solicitada e executada.

**Resultado:** Nenhum driver de engajamento mensurável encontrado após segmentação rigorosa. Patrocínio sem lift. Busca sistemática em 6.760 combinações (n≥30 cada) — nada >1.3%. Um item de observação de baixa confiança: F10 (criadores small e posts patrocinados ligeiramente sobre-representados no decil inferior, efeito <1.5pp).

**Iterações e Custo:** 6 rodadas (5 revisões + 1 auditoria). [Consultar cost-log.md para tokens.]

## Fase 2 — Strategy (2026-09-26)

**Entregáveis:** solution/STRATEGY.md (PT-BR, Parte 1 ~1.237 palavras + Parte 2/anexo), findings.json estendido a F21 (21 achados, 15.0 KB).

**Agentes/Modelos:** strategist (opus) — 5 rodadas de rascunho; head-of-marketing (sonnet) — 4 rodadas de revisão (06-09); qa-tester (haiku) — 2 rodadas de reconciliação (01-02); data-scientist (sonnet) — adicionou F21 e corrigiu 2 bugs.

**IA errou / Corrigido:** (1) Rascunho inicial lido como relatório de IA impessoal → líder exigiu voz de 1ª pessoa, cabeçalho De/Para/Data/Assunto, zero menção a agentes (DECISIONS.md 18:52). (2) Recomendações em nível de política → líder exigiu recomendações estreitas nomeadas (plataforma + formato + categoria + tier de criador, o quê/para quem/quando/evidência). (3) IA misinterpreou exemplo do brief ("30-60s tech, 10K-50K, 3,2x shares") como benchmark a verificar → líder corrigiu: era dica de profundidade para o analista, testamos mesmo (F21: 1,00x, não 3,2x, n=20). (4) Documento cresceu para 2.060 palavras → reestruturado em Parte 1 + Parte 2/anexo. (5) QA e HOM encontraram inconsistência em F19 (1,3% vs. -1,4%) → corrigida na fonte.

**Decisões do líder:** STRATEGY.md em formato memo 1ª pessoa; recomendações específicas nomeadas (o quê/para quem/quando/evidência); exemplo do brief como teste proativo, não fact-check; duas partes (1 autossuficiente em ~5 min + anexo com glossário F01-F21 e premissas).

**Resultado:** 21 achados com todas as alegações rastreáveis; nenhuma combinação passa 1,4% de efeito; patrocínio sem lift (F11: -0,7% a +0,6%, típico 0%); 2 testes controlados, 3 itens "parar", 3 itens "monitorar".

**Iterações e Custo:** 11 rodadas (5 strategist + 4 head-of-marketing + 2 qa-tester) + 1 bug corrigido em F19. [Consultar cost-log.md para tokens.]

## Fase 3 — Ferramenta Extra: Dashboard (2026-09-26 a 2026-09-27)

**Entregáveis:** dashboard/ (Next.js 15 + Material UI, Vercel-ready). Dashboard filtrável com 8 dimensões (plataforma, categoria, tier criador, patrocinado, mês, tipo conteúdo, idioma, localização audiência). Indicador de lift (real vs. mediana segmento, aritmética direta, não ML) + comparação justa patrocinado-vs-orgânico (mediana de razões por grupo, controlada por plataforma/categoria/tier). Taxa de engajamento desagregada por métrica individual (curtidas, compartilhamentos, comentários por visualização). Botão "Gerar LLM Report" (Groq free tier, openai/gpt-oss-120b, PT-BR) gerando resumo executivo + recomendações prioritárias por clique, com fallback rule-based se API indisponível. Botão "Gerar prompt de apresentação" (template, sem LLM) para construir PowerPoint em ferramenta externa. 13 commits, não enviados a origin.

**Agentes/Modelos:** developer (sonnet) — ~20+ rodadas (data layer, design G4→MUI, lift/fairness, rule-based→LLM, filtros/métricas, presentation-prompt, múltiplos passes UX). data-scientist (sonnet) — 2 spikes (ML rejeitado: R²=-0.00066, AUC 0.481; profiling de content_type/language/audience_location).

**IA errou / Corrigido:** (1) Pooling patrocinado-vs-orgânico (violação GATE 0) → mediana de razões por grupo. (2) Nomes internos expostos (findings.json, tags F0-F21) → scrubbed. (3) Cores gráficos inconsistentes → unificadas. (4) LLM 0.02pp como "alta confiança" → piso materialidade 3pp. (5) Auto-fetch Groq a cada filtro → click-triggered. (6) Payload recomendações (plataforma+1 eixo) → ranking completo sempre. (7) Modelo subtraiu percentuais (0.032pp reportado como 3.2pp) → pré-computado em código. (8) Formato/duração/horário dataset-wide → filter-aware (cubo servidor). (9) Barras gráfico sem labels visíveis → on-bar labels.

**Decisões do líder:** ML/LangGraph rejeitados; Material UI adotado; dark mode removido; saída LLM em PT-BR; rule-based+LLM fallback; resumo+recomendações unificados; abas→3 seções sempre visíveis; content_type/language/audience_location como filtros reais; per-view metric rates expostos.

**Status:** Fases 3a–3e concluídas.

**Fase 3e (QA + Deploy):** qa-tester completou smoke test (process-log/qa/03-dashboard-smoketest.md) — PASS em todos 7 checks (reprodutibilidade, exposição dados brutos/segredos, vazamento artefatos, .env, reconciliação números, fallbacks, README). Deploy Vercel via CLI; identificou e corrigiu falha real (next/font/google crashando no build — resolvido com fonts locais via next/font/local). Live em https://social-pulse-dashboard.vercel.app, verificado end-to-end (chamada LLM real confirmada em produção). Proteção SSO desabilitada (líder aprovado) — seguro: scan de segurança confirmou nenhum dado bruto/segredo/artefatos internos expostos.

**Iterações e Custo:** ~22 rodadas (developer + data-scientist). [Consultar cost-log.md para tokens.]
