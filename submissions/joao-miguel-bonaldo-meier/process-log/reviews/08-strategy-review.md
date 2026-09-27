# Review — STRATEGY.md (rodada 3, revisão independente)

**Veredito: APROVADO**

| Item | Status | Comentário |
|---|---|---|
| Segunda-feira | OK | Seção 5 (Quick wins) e seção 2 dizem exatamente o que fazer, com prazo em dias. |
| Além do óbvio | OK | O achado central (tamanho de criador não move alcance/engajamento) é contraintuitivo e testado à exaustão (F17-F19). |
| Comparação justa | OK | F11/F12/F13 comparam patrocinado vs. orgânico dentro de 60 grupos controlados por plataforma x tamanho x categoria — sem misturar contextos. |
| Prioridade | OK | Seção 2 ordenada por impacto x confiança; seção 4 lista o que parar, do maior desperdício ao menor. |
| Clareza | OK | Parte 1 é lida sem abrir o anexo; termos técnicos (mediana, taxa de engajamento, "1,00x") explicados em uma linha na seção 1. Nenhum jargão solto (p-valor, correlação) aparece na Parte 1. |
| Confiança | QUASE — ver ressalva | O benchmark do brief é respondido de frente (F21: 1,00x, não 3,2x, com honestidade sobre n=20 baixo). Mas há um número inconsistente entre o texto ("nenhuma... mais de 1,3%") e o glossário F19, que na verdade registra um pior caso de -1,4% no findings.json. |

**Mudança obrigatória (única, pequena):**
1. Linha 14 e F19: o texto diz "nenhuma se afastou mais de 1,3% do típico", mas o próprio findings.json (F19) registra pior caso de -1,4%. Troque por "não passou de 1,4%" (ou peça ao data-scientist para reconciliar o campo `effect_size` de F19, que hoje contradiz o texto do `claim`). Não é um problema criado pelo strategist, mas precisa ser corrigido antes de fechar, pois a rubrica exige todo número batendo com a fonte.

Fora isso: nenhuma linguagem "sintético/dummy/Kaggle", nenhum ROI em R$ inventado, F10 tratado estritamente como "testar, não agir", e todas as 21 tags usadas na Parte 1 estão explicadas no Anexo. Aprovar após o ajuste do 1,3%→1,4% (correção trivial, não exige nova rodada completa).

**Pergunta para a reunião:** Já que o próprio benchmark do brief e a busca em 6.760 combinações não acharam nenhum driver forte, quanto tempo/verba estamos dispostos a gastar nos 3 testes controlados antes de admitir que "não há fórmula" e redirecionar o orçamento para custo-por-post puro?
