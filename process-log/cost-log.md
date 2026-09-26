# Custo por fase (colar saída do /cost)
| Fase | Agentes | Tokens entrada | Tokens saída | Custo | Observação |
|---|---|---|---|---|---|
| 0-1 (Setup + Análise, até GATE 1) | data-scientist (sonnet, 66% do uso) + head-of-marketing (sonnet, 4%) + documenter (haiku) | 80.6k input / 20.8m cache read / 627.3k cache write (sonnet); 1.2k input / 77.8k cache read (haiku) | 217.6k (sonnet) / 3.7k (haiku) | $8.28 total sessão | 5 rounds de revisão + 1 auditoria independente + 1 loop de correção de gráfico; 98% do custo veio de subagentes, 66% só do data-scientist (esperado — várias re-execuções por pedido do líder: auditoria, novos gráficos, busca de 6.760 combinações) |
