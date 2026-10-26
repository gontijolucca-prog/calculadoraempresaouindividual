/**
 * Texto da proposta no formato Gamma (estrutura Ativiwise).
 *
 * É a cópia que se usava no Gamma, agora dentro do Estudo 360: gera o texto,
 * copia e abre gamma.app → "Paste text". Sem API, sem chave, custo zero.
 *
 * O preço NUNCA é escrito à mão aqui: vem de `pricingFor()` — a mesma função
 * que o editor usa — para o papel e o ecrã dizerem o mesmo número.
 */
import type { OfficeSettings } from './officeSettings';
import type { HonorariosConfig } from './honorarios';
import { pricingFor, type DeckCliente } from './deck/build';

export const GAMA_URL = 'https://gamma.app/create';

export interface GamaPromptOpcoes {
  /** As 4 respostas do briefing — a mesma estrutura da proposta da app. */
  briefing?: {
    setor?: string;
    dimensao?: string;
    faturacao?: string;
    objetivo?: string;
  };
  observacoes?: string;
}

export function buildGamaPrompt(
  office: OfficeSettings,
  honorarios: HonorariosConfig,
  cliente?: DeckCliente | null,
  opcoes: GamaPromptOpcoes = {},
): string {
  const o = office || ({} as OfficeSettings);
  const b = opcoes.briefing || {};
  const linhas: string[] = [];

  // Mesma estrutura da proposta da app: 7 blocos, preço do motor.
  const nome = (cliente?.nome || '').trim() || 'o cliente';
  const preco = pricingFor({ office: o, honorarios, cliente: cliente ?? null });

  const setor = (b.setor || '').trim() || 'não indicado';
  const dimensao = (b.dimensao || '').trim() || (cliente?.profile?.nrFuncionarios ? `${cliente.profile.nrFuncionarios} pessoa(s)` : 'não indicada');
  const faturacao = (b.faturacao || '').trim() || (cliente?.profile?.faturaçaoAnualPrevista ? `${Number(cliente.profile.faturaçaoAnualPrevista).toLocaleString('pt-PT')} €` : 'não indicada');
  const objetivo = (b.objetivo || '').trim() || 'ter as obrigações em dia e decidir com números';

  linhas.push(`# Proposta de Serviços de Contabilidade — ${o.nome || 'Estudo 360'}`);
  linhas.push(`${nome} · ${new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' }).format(new Date())}`);
  linhas.push('');

  linhas.push('## Diagnóstico');
  linhas.push(`- Setor: ${setor}`);
  linhas.push(`- Dimensão: ${dimensao}`);
  linhas.push(`- Faturação: ${faturacao}`);
  linhas.push(`- Objetivo a 12 meses: ${objetivo}`);
  linhas.push(`Com este retrato, o acompanhamento é desenhado para ${objetivo}.`);
  linhas.push('');

  linhas.push('## Âmbito da proposta — serviços incluídos');
  for (const item of preco.items) linhas.push(`- ${item.label}: ${item.value}`);
  linhas.push('Serviços extra e trabalhos pontuais são orçamentados à parte, com aprovação prévia.');
  linhas.push('');

  linhas.push('## Equipa e prova');
  const equipa = [
    o.contabilistaResponsavel ? `Contabilista responsável: ${o.contabilistaResponsavel}.` : '',
    o.cedulaProfissional ? `Cédula profissional ${o.cedulaProfissional}.` : '',
    o.numeroInscricaoOCC ? `Inscrição OCC ${o.numeroInscricaoOCC}.` : '',
  ].filter(Boolean).join(' ');
  linhas.push(equipa || 'Equipa certificada, com acompanhamento próximo e ferramentas digitais.');
  linhas.push('- Responsável dedicado por cliente');
  linhas.push('- Resposta a pedidos em 24 horas úteis');
  linhas.push('- Reunião de acompanhamento trimestral');
  linhas.push('');

  linhas.push('## Investimento');
  linhas.push(preco.subtitle);
  for (const item of preco.items) linhas.push(`- ${item.label}: ${item.value}`);
  linhas.push('IVA à taxa legal em vigor. 60 dias de aviso prévio para alterações.');
  linhas.push('');

  linhas.push('## Plano de arranque (90 dias)');
  linhas.push('- Dias 1–30: documentos, acessos e calendário de obrigações');
  linhas.push('- Dias 31–60: primeiro fecho mensal e afinação do circuito');
  linhas.push('- Dias 61–90: reunião de reporte e plano do trimestre');
  linhas.push('');

  if (opcoes.observacoes?.trim()) {
    linhas.push('');
    linhas.push(opcoes.observacoes.trim());
  }

  linhas.push('## Próximo passo');
  linhas.push('Basta responder a esta proposta por email ou telefone.');
  const contacto = [o.email, o.telefone].filter(Boolean).join(' · ');
  if (contacto) linhas.push(`Contacto: ${contacto}${o.website ? ` · ${o.website}` : ''}`);
  const sede = [o.morada, o.codigoPostal, o.localidade].filter(Boolean).join(', ');
  if (sede) linhas.push(`Sede: ${sede}`);
  const ids = [o.nif ? `NIF: ${o.nif}` : '', o.cedulaProfissional ? `Cédula: ${o.cedulaProfissional}` : '', o.numeroInscricaoOCC ? `OCC: ${o.numeroInscricaoOCC}` : ''].filter(Boolean).join(' · ');
  if (ids) linhas.push(ids);
  linhas.push('');
  linhas.push('---');
  linhas.push('_Proposta gerada no Estudo 360° — conteúdo editável no Gamma._');

  return linhas.join('\n');
}
