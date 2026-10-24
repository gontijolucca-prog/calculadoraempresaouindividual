/**
 * Dados de cliente que não podem seguir para providers free (Kilo, OpenRouter
 * `:free`, OmniRoute): esses podem registar os pedidos. O contexto da app já vai
 * sem nomes; aqui apanham-se NIF/NIPC e IBAN escritos na pergunta ou em qualquer
 * mensagem do histórico.
 */

export interface MensagemParaAnalise {
  role: string;
  content: string;
}

// NIF/NIPC: 9 dígitos, com ou sem pontos/espaços (ex.: 501 234 567).
const RE_NIF = /\b\d{3}[ .]?\d{3}[ .]?\d{3}\b/;

// IBAN português: PT50 + 21 dígitos (com ou sem espaços).
const RE_IBAN = /\bPT\d{2}(?:[ ]?\d{4}){5}(?:[ ]?\d{1,3})\b/i;

export function pareceTerDadosCliente(mensagens: MensagemParaAnalise[], contexto = ''): boolean {
  const textos = mensagens.map((m) => m.content);
  if (contexto) textos.push(contexto);
  return textos.some((t) => RE_NIF.test(t) || RE_IBAN.test(t));
}

/**
 * Mascara os dados de cliente antes de enviar para providers gratuitos.
 * A resposta raramente precisa do número em si; o modelo continua a perceber a
 * pergunta ("o cliente [NIF] tem IVA em atraso?").
 */
export function mascararDados(texto: string): string {
  return texto
    .replace(/\bPT\d{2}(?:[ ]?\d{4}){5}(?:[ ]?\d{1,3})\b/gi, '[IBAN]')
    .replace(/\b\d{3}[ .]?\d{3}[ .]?\d{3}\b/g, '[NIF]');
}

export function mascararMensagens<T extends { content: string }>(mensagens: T[]): T[] {
  return mensagens.map((m) => ({ ...m, content: mascararDados(m.content) }));
}
