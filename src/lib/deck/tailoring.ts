/**
 * Proposta tailored — 7 blocos fixos, texto feito a partir do que sabemos do
 * cliente (perfil + serviços + 4 respostas). Sem AI: nunca inventa números; o
 * preço vem de `pricingFor()` e o ajuste manual é registado no próprio deck.
 */
import type { OfficeSettings } from '../officeSettings';
import { calcularProposta, type HonorariosConfig } from '../honorarios';
import { pricingFor, eur, type DeckCliente } from './build';
import { newCardId, type DeckCard, type DeckDoc, type DeckTheme } from './types';

export interface BriefingCliente {
  setor?: string;
  dimensao?: string;
  faturacao?: string;
  objetivo?: string;
}

export interface AjustePreco {
  /** Diferença em €/mês (negativo = desconto). */
  mensal: number;
  motivo: string;
  por?: string;
}

export interface PropostaTailoredInput {
  id: string;
  office: OfficeSettings;
  honorarios: HonorariosConfig;
  cliente: DeckCliente | null;
  briefing: BriefingCliente;
  servicosIds?: string[];
  tema?: DeckTheme;
  ownerUid: string;
  gabineteId: string;
  ajuste?: AjustePreco;
}

const hoje = () => new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' }).format(new Date());

const limpo = (s?: string) => (s || '').trim();

export function buildPropostaTailored(input: PropostaTailoredInput): DeckDoc {
  const { office, honorarios, cliente, briefing, servicosIds, tema = 'claro' } = input;
  const nome = limpo(cliente?.nome) || 'o cliente';
  const preco = pricingFor({ office, honorarios, cliente, servicosIds });

  // Preço base e ajuste (a AI nunca escreve isto).
  const base = (() => {
    if (!cliente?.profile && !cliente?.nif) return null;
    const p = (cliente?.profile ?? {}) as Record<string, unknown>;
    const r = calcularProposta({
      tipoEntidade: (p.tipoEntidade as string) ?? 'eni',
      faturaçaoAnualPrevista: (p.faturaçaoAnualPrevista as number) ?? 0,
      nrFuncionarios: (p.nrFuncionarios as number) ?? 0,
      regimeContabilidade: (p.regimeContabilidade as string) ?? '',
    } as never, honorarios, servicosIds);
    return r;
  })();

  const ajuste = input.ajuste?.mensal ?? 0;
  const mensalBase = base?.mensalSemIVA ?? 0;
  const mensalFinal = Math.max(0, mensalBase + ajuste);
  const ajusteTxt = ajuste
    ? `Ajuste ${ajuste > 0 ? 'positivo' : 'negativo'} de ${eur(Math.abs(ajuste))}/mês${input.ajuste?.motivo ? ` — ${input.ajuste.motivo}` : ''}.`
    : '';

  const setor = limpo(briefing.setor) || 'não indicado';
  const dimensao = limpo(briefing.dimensao) || (cliente?.profile?.nrFuncionarios ? `${cliente.profile.nrFuncionarios} pessoa(s)` : 'não indicada');
  const faturacao = limpo(briefing.faturacao) || (cliente?.profile?.faturaçaoAnualPrevista ? eur(cliente.profile.faturaçaoAnualPrevista) : 'não indicada');
  const objetivo = limpo(briefing.objetivo) || 'ter as obrigações em dia e decidir com números';

  const ambito = (base?.itens ?? []).map((i) => ({
    label: i.descricao,
    value: `${eur(i.valorMensal)}/mês`,
  }));

  const cards: DeckCard[] = [
    {
      id: newCardId(),
      kind: 'cover',
      title: 'Proposta de Serviços de Contabilidade',
      subtitle: `${nome} · ${hoje()}`,
      body: office.nome || 'Estudo 360',
    },
    {
      id: newCardId(),
      kind: 'bullets',
      title: 'Diagnóstico',
      subtitle: `${nome}: o ponto de partida`,
      items: [
        { label: 'Setor', value: setor },
        { label: 'Dimensão', value: dimensao },
        { label: 'Faturação', value: faturacao },
        { label: 'Objetivo a 12 meses', value: objetivo },
      ],
      body: `Com este retrato, o acompanhamento é desenhado para ${objetivo}.`,
    },
    {
      id: newCardId(),
      kind: 'bullets',
      title: 'Âmbito da proposta',
      subtitle: 'O que está incluído',
      items: ambito.length ? ambito : [{ label: 'Contabilidade e impostos', value: 'incluído' }],
      body: 'Serviços extra e trabalhos pontuais são orçamentados à parte, sempre com aprovação prévia.',
    },
    {
      id: newCardId(),
      kind: 'stats',
      title: 'Equipa e prova',
      subtitle: 'Quem acompanha e com que experiência',
      items: [
        { label: 'Responsável dedicado', value: '1' },
        { label: 'Resposta a pedidos', value: '24h' },
        { label: 'Reuniões de acompanhamento', value: 'trimestral' },
      ],
      body: county(office),
    },
    {
      id: newCardId(),
      kind: 'pricing',
      title: 'Investimento',
      subtitle: preco.subtitle,
      items: preco.items,
      body: [
        mensalBase ? `Mensalidade de tabela: ${eur(mensalBase)}/mês.` : '',
        ajuste ? `Valor acordado: ${eur(mensalFinal)}/mês. ${ajusteTxt}` : '',
        'IVA à taxa legal em vigor. 60 dias de aviso prévio para alterações.',
      ].filter(Boolean).join(' '),
    },
    {
      id: newCardId(),
      kind: 'timeline',
      title: 'Plano de arranque',
      subtitle: 'Primeiros 90 dias',
      items: [
        { label: 'Dias 1–30', value: 'Documentos, acessos e calendário de obrigações' },
        { label: 'Dias 31–60', value: 'Primeiro fecho mensal e afinação do circuito' },
        { label: 'Dias 61–90', value: 'Reunião de reporte e plano do trimestre' },
      ],
    },
    {
      id: newCardId(),
      kind: 'contact',
      title: 'Próximo passo',
      subtitle: 'Basta responder a esta proposta.',
      items: [
        { label: 'Email', value: office.email || 'geral@escritorio.pt' },
        { label: 'Telefone', value: office.telefone || '—' },
      ],
      body: office.nome || 'Estudo 360',
    },
  ];

  return {
    v: 1,
    id: input.id,
    titulo: `Proposta — ${nome}`,
    clienteId: cliente?.id ?? null,
    clienteNome: cliente?.nome,
    tema,
    cards,
    ownerUid: input.ownerUid,
    gabineteId: input.gabineteId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    respostas: briefing,
    ajuste: input.ajuste ? { ...input.ajuste, em: Date.now() } : undefined,
  };
}

function county(office: OfficeSettings): string {
  const partes = [
    office.contabilistaResponsavel ? `Contabilista responsável: ${office.contabilistaResponsavel}.` : '',
    office.cedulaProfissional ? `Cédula profissional ${office.cedulaProfissional}.` : '',
    office.numeroInscricaoOCC ? `Inscrição OCC ${office.numeroInscricaoOCC}.` : '',
  ].filter(Boolean);
  return partes.join(' ') || 'Equipa certificada, com acompanhamento próximo e ferramentas digitais.';
}
