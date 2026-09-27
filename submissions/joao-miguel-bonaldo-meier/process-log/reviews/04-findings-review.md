# Review 04 — findings.json (Round 3, post-audit + F18-F20 + rebuilt charts)

**Veredito: REVISAR** (uma correção obrigatória, rápida)

## Rubrica

| Item | Status | Nota |
|---|---|---|
| Segunda-feira | OK | F18-F20 fecham o assunto: não existe combo mágico, nem no cenário exato que eu pedi (vídeo longo, noite, tech, 100K+). Ação clara: parar de caçar fórmula, focar em consistência/volume. |
| Além do óbvio | OK | Buscar 6.760 combinações e achar no máximo +1,3% é um resultado forte e contraintuitivo — a maioria dos decks de marketing venderia "o combo perfeito". Aqui está provado que não existe. |
| Comparação justa | OK | F11-F13 comparam patrocinado vs. orgânico dentro de 60 grupos pareados por plataforma x tamanho x categoria. F18 confirma via auditoria independente. |
| Prioridade | OK | Fica claro: pare de otimizar micro-segmento/horário/formato; sponsorship não paga por si só sem condição favorável comprovada; foco devia ir para volume/consistência (ainda que isso devesse estar mais explícito como recomendação, não é papel do findings.json). |
| Clareza | REVISAR | 4 dos 5 gráficos (01, 03, 04, 05) têm título com o "e daí" pronto e eixo compatível com a mensagem "quase não há diferença". O gráfico 02 (day-part) ficou para trás: eixo Y vai de 0,1988 a 0,1992, o que faz um "pico" de noite parecer dramático visualmente, embora o texto (F02/F03) diga que a diferença é <0,2%. Em 5 minutos, um executivo olha esse gráfico e pode concluir "publicar à noite funciona" — o oposto da mensagem do resto do documento. |
| Confiança | OK | Todo número tem n, método, e technical_detail separado do claim. F18 (auditoria) reforça robustez. Nenhum jargão de ciência de dados nas claims (Mann-Whitney/p-valor ficam isolados em technical_detail, como já aprovado na rodada 2). |

## Mudanças obrigatórias
1. **Corrija o gráfico 02** — troque o eixo/título por algo que comunique a mesma conclusão dos outros 4 gráficos (ex.: título "Horário do dia não muda o resultado" + eixo com escala que não exagere 0,2% de diferença, ou anotação "todas as diferenças <0,2%"). É o único gráfico dos 5 que hoje contradiz visualmente o texto.

## Pergunta para a reunião
Se nem tamanho de criador, nem horário, nem patrocínio, nem a combinação exata que eu pedi movem o ponteiro — o que exatamente vamos medir daqui pra frente para saber se a estratégia está funcionando, já que "engajamento" parece ser uma métrica saturada nesse dataset?
