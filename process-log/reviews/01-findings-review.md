# Review — Phase 1 Findings (findings.json)

**Verdict: REVISAR**

## O que funciona
As três perguntas são respondidas com uma comparação justa (plataforma x tamanho de criador x categoria, 60 grupos pareados) e o resultado é honesto: nenhum corte — plataforma, horário, tamanho de criador, tipo de conteúdo, patrocínio, disclosure, idade/gênero de audiência — muda o engajamento de forma relevante. Isso é uma resposta de negócio válida e economiza dinheiro (não gastar tempo tentando "otimizar" algo que não se move). O único sinal fraco (F10: criadores pequenos e posts patrocinados aparecem um pouco mais entre os piores posts) está corretamente marcado como baixa/média confiança, não como driver comprovado.

## Problemas a corrigir antes de seguir para a estratégia

1. **Linguagem proibida ainda presente no arquivo.** `signal_verdict: "LIKELY-SYNTHETIC"` e a menção a "Kaggle" nos `caveats` contradizem a instrução explícita do líder de tratar os dados como reais. Troque por algo como: "sinal de engajamento é uniforme em todos os cortes testados — tratar achados como direcionais". Isso precisa ser corrigido aqui, porque a estrategista vai puxar esse texto para o documento do cliente.

2. **Jargão técnico sem tradução.** Termos como "p-value", "Mann-Whitney U", "decile", "quartile", "strata", "pp" aparecem nas claims que serão citadas com tag [Fxx] no STRATEGY.md. Peça à estrategista (ou adicione aqui um glossário de 1 linha por termo) para reescrever cada claim em português simples antes de virar recomendação para o executivo — ex: "decile" -> "os 10% piores posts"; "strata" -> "grupos comparáveis".

3. **F10 precisa de instrução de uso, não só de dado.** O achado existe mas não diz o que fazer com ele. Adicione ao lado do finding uma nota do tipo "tratar como hipótese a testar, não como regra — reduzir orçamento de patrocínio em pequenos criadores só depois de um teste controlado". Sem isso, existe risco da estrategista transformar 1,2pp em uma política forte.

## Pergunta para a reunião
Se nenhum fator interno (horário, formato, patrocínio, criador) move o engajamento, o problema está em fatores externos que não medimos (algoritmo da plataforma, criativo/copy, oferta) — vale investir em um teste controlado (A/B real) no próximo trimestre para descobrir isso?
