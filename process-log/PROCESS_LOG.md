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
