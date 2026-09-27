import type { LlmRecommendation } from "@/app/api/recommendations/route";

// ---------------------------------------------------------------------
// "Gerar prompt de apresentação" -- pure client-side string templating,
// ZERO LLM calls. Assembles a ready-to-paste prompt (PT-BR) that the user
// takes to ANY other LLM tool (ChatGPT, Gemini, Claude, etc.) to generate
// a PowerPoint. This dashboard never generates the deck itself.
//
// Input is exactly the data already rendered on screen by the existing
// "Gerar LLM Report" flow (executive summary text + recommendation
// objects) -- nothing new is fetched, computed, or sent anywhere. This
// keeps the feature free, instant, and failure-proof by construction.
// ---------------------------------------------------------------------

const TIPO_LABEL: Record<string, string> = {
  oportunidade: "Oportunidade",
  parar: "Parar",
  testar: "Testar",
};

function formatRecommendation(rec: LlmRecommendation, index: number): string {
  const tipo = TIPO_LABEL[rec.tipo] ?? rec.tipo;
  return [
    `${index + 1}. [Prioridade ${rec.prioridade} -- ${tipo} -- Confiança: ${rec.confianca}]`,
    `   Título: ${rec.titulo}`,
    `   Observação (evidência): ${rec.observacao}`,
    `   Ação recomendada: ${rec.acao}`,
  ].join("\n");
}

/**
 * Build the full presentation-generation prompt from data already on
 * screen (segment description, post count, executive summary text, and
 * the list of recommendation cards). Pure function, no side effects.
 */
export function buildPresentationPrompt(
  segment: string,
  posts: number,
  execSummaryText: string,
  recommendations: LlmRecommendation[]
): string {
  const recommendationsBlock =
    recommendations.length > 0
      ? recommendations.map(formatRecommendation).join("\n\n")
      : "(Nenhuma recomendação disponível para este recorte.)";

  return `Você vai me ajudar a criar uma apresentação de PowerPoint para apresentar à liderança, propondo ações de marketing baseadas em dados.

CONTEXTO: Analisamos dados de posts em redes sociais (Instagram, TikTok, YouTube, Bilibili, RedNote) para o seguinte recorte: ${segment}. Total de posts analisados neste recorte: ${posts.toLocaleString()}. O objetivo desta apresentação é conseguir aprovação/patrocínio da liderança para testar as ações recomendadas abaixo.

AUDIÊNCIA E TOM: a audiência é a liderança executiva, que não é especialista em dados. A apresentação precisa ser direta, visualmente clara e convincente -- mas honesta: não infle os números além do que os dados sustentam.

REGRAS IMPORTANTES (siga rigorosamente):
- Use APENAS os dados fornecidos abaixo. Não invente números, benchmarks, comparações ou estatísticas que não estejam aqui.
- Recomendações marcadas com confiança "baixa" ou "média" devem ser apresentadas como HIPÓTESES A TESTAR, não como resultados garantidos -- deixe isso explícito nos slides (ex.: "recomendamos testar X" em vez de "X vai funcionar"). Isso é essencial: prometer um resultado que os dados não garantem prejudica a credibilidade de quem apresenta.
- Recomendações marcadas como "parar" devem ser apresentadas como uma mudança de investimento/foco, com a evidência de por que faz sentido parar.
- Seja específico: cada recomendação deve deixar claro o quê fazer, para qual segmento/público, e qual evidência (número real, abaixo) sustenta isso.

ESTRUTURA SUGERIDA DA APRESENTAÇÃO:
1. Capa (título + recorte analisado)
2. Contexto e objetivo (por que analisamos isso, o que buscamos)
3. O que os dados mostram (resumo executivo)
4. Recomendações priorizadas (um slide por recomendação ou agrupadas por tipo -- oportunidade / parar / testar -- cada uma com: o quê, para quem, evidência, nível de confiança)
5. Próximos passos (o que estamos pedindo à liderança: aprovação, recursos, prazo sugerido para os testes)
6. Limitações (transparência sobre o que os dados NÃO mostram / incertezas)

Gere o conteúdo completo, slide por slide (título de cada slide + bullets do conteúdo), pronto para eu colar em um editor de apresentações ou pedir para uma ferramenta de geração de PPT montar visualmente.

===== DADOS =====

Recorte analisado: ${segment}
Total de posts: ${posts.toLocaleString()}

Resumo executivo:
${execSummaryText}

Recomendações:
${recommendationsBlock}`;
}
