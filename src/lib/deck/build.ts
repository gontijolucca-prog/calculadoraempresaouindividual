/**
 * Construção determinística da proposta — o "fallback" que nunca falha.
 *
 * Recebe os dados que já existem na app (Definições do Escritório, honorários,
 * perfil do cliente) e devolve um deck completo e bonito. É usado tal e qual
 * quando a AI falha, e como fonte de verdade do preço quando a AI responde.
 */
import type { OfficeSettings } from '../officeSettings';
import { calcularProposta, type HonorariosConfig, type TipoEntidadeCliente } from '../honorarios';
import { newCardId, type DeckCard, type DeckDoc, type DeckTheme } from './types';

export interface DeckCliente {
  id: string;
  nome: string;
  nif?: string;
  profile?: {
    tipoEntidade?: string;
    faturaçaoAnualPrevista?: number;
    nrFuncionarios?: number;
    regimeContabilidade?: string;
  };
}

export interface DeckInput {
  office: OfficeSettings;
  honorarios: HonorariosConfig;
  cliente?: DeckCliente | null;
  servicosIds?: string[];
}

const TIPO_LABEL: Record<TipoEntidadeCliente, string> = {
  eni: 'ENI / Recibos Verdes',
  unipessoal: 'Unipessoal Lda',
  socio_unico: 'Unipessoal Lda (Sócio Único)',
  lda: 'Sociedade por Quotas (Lda)',
  sa: 'Sociedade Anónima (SA)',
};

export function eur(v: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
}

export interface PricingCardData {
  items: { label: string; value: string }[];
  subtitle: string;
}

/** Preço sempre calculado por nós — a AI só pode repetir estes valores. */
export function pricingFor(input: DeckInput): PricingCardData {
  const { office, honorarios, cliente, servicosIds } = input;
  if (cliente?.profile || cliente?.nif) {
    const p = cliente?.profile ?? {};
    const profile = {
      tipoEntidade: p.tipoEntidade ?? 'eni',
      faturaçaoAnualPrevista: p.faturaçaoAnualPrevista ?? 0,
      nrFuncionarios: p.nrFuncionarios ?? 0,
      regimeContabilidade: p.regimeContabilidade ?? '',
    } as unknown as Parameters<typeof calcularProposta>[0];
    const r = calcularProposta(profile, honorarios, servicosIds);
    return {
      items: r.itens.map((i) => ({ label: i.descricao, value: `${eur(i.valorMensal)}/mês` })),
      subtitle: `${eur(r.mensalSemIVA)} / mês + IVA${r.iva > 0 ? ` (${eur(r.mensalComIVA)} com IVA)` : ''} · ${eur(r.anualComIVA)}/ano`,
    };
  }
  void office;
  const items = (Object.keys(TIPO_LABEL) as TipoEntidadeCliente[])
    .map((t) => ({ label: TIPO_LABEL[t], value: `${eur(honorarios.baseMensal[t] ?? 0)}/mês` }))
    .slice(0, 5);
  return { items, subtitle: 'Mensalidade base por tipo de entidade — IVA não incluído' };
}

function contactItems(office: OfficeSettings) {
  const items: { label: string; value: string }[] = [];
  const contacto = [office.email, office.telefone].filter(Boolean).join(' · ');
  if (contacto) items.push({ label: 'Contacto', value: contacto });
  if (office.website) items.push({ label: 'Website', value: office.website });
  const sede = [office.morada, office.codigoPostal, office.localidade].filter(Boolean).join(', ');
  if (sede) items.push({ label: 'Sede', value: sede });
  if (office.cedulaProfissional) items.push({ label: 'Cédula profissional', value: office.cedulaProfissional });
  return items;
}

/** Setor dos serviços: usa o catálogo real de honorários, não texto inventado. */
function serviceItems(honorarios: HonorariosConfig) {
  return honorarios.servicosExtra
    .filter((s) => s.precoMensal > 0)
    .slice(0, 6)
    .map((s) => ({ label: s.nome, note: s.descricao, value: `${eur(s.precoMensal)}/mês` }));
}

export function buildTemplateCards(input: DeckInput): DeckCard[] {
  const { office, honorarios, cliente } = input;
  const nome = office.nome || 'o nosso escritório';
  const paraQuem = cliente?.nome ? ` para ${cliente.nome}` : '';
  const pricing = pricingFor(input);

  const sobre =
    office.historia?.trim() ||
    `${nome} ${office.tipo === 'individual' ? 'é contabilista certificado' : 'é um escritório de contabilidade certificado'} em Portugal. Trabalhamos com proximidade, rigor e ferramentas digitais — da contabilidade do dia a dia ao apoio à decisão.`;

  const cards: DeckCard[] = [
    {
      id: newCardId(),
      kind: 'cover',
      title: 'Proposta de Serviços de Contabilidade',
      subtitle: `${nome}${paraQuem}`,
    },
    {
      id: newCardId(),
      kind: 'section',
      title: 'Sobre nós',
      body: sobre + (office.anoFundacao ? ` A acompanhar clientes desde ${office.anoFundacao}.` : ''),
    },
    {
      id: newCardId(),
      kind: 'bullets',
      title: 'O que está incluído',
      items: serviceItems(honorarios).length
        ? serviceItems(honorarios)
        : [
            { label: 'Contabilidade organizada', note: 'Lançamentos, conciliação e relatórios mensais.' },
            { label: 'Obrigações fiscais', note: 'IVA, SAF-T, Modelo 22 e IES dentro dos prazos.' },
            { label: 'Apoio à decisão', note: 'Reuniões de acompanhamento e planeamento fiscal.' },
          ],
    },
    {
      id: newCardId(),
      kind: 'stats',
      title: 'Como trabalhamos',
      items: [
        { label: 'Resposta', value: '24h' },
        { label: 'Reuniões', value: 'Trimestrais' },
        { label: 'Documentos', value: 'Digitais' },
        { label: 'Responsável', value: 'Dedicado' },
      ],
    },
    {
      id: newCardId(),
      kind: 'pricing',
      title: 'Investimento',
      subtitle: pricing.subtitle,
      items: pricing.items,
    },
    {
      id: newCardId(),
      kind: 'timeline',
      title: 'Arranque',
      items: [
        { label: 'Semana 1', value: 'Reunião inicial e recolha de documentos' },
        { label: 'Semana 2', value: 'Acessos, contas e calendário fiscal' },
        { label: 'Semana 3', value: 'Primeira entrega e acompanhamento' },
      ],
    },
    {
      id: newCardId(),
      kind: 'bullets',
      title: 'Porque nós',
      items: [
        { label: 'Proximidade', note: 'Um responsável dedicado, que conhece o seu negócio.' },
        { label: 'Rigor', note: 'Prazos cumpridos e informação tratada com confidencialidade.' },
        { label: 'Digital', note: 'Documentos por foto, plataforma online e sem papel.' },
      ],
    },
    {
      id: newCardId(),
      kind: 'contact',
      title: 'Próximo passo',
      subtitle: 'Responda a esta proposta e tratamos do arranque.',
      items: contactItems(office),
    },
  ];
  return cards;
}

/** Contexto compacto para o modelo. Sem dados internos que não interessem. */
export function buildBrief(input: DeckInput) {
  const { office, honorarios, cliente } = input;
  const pricing = pricingFor(input);
  const profile = cliente?.profile ?? {};
  return {
    escritorio: {
      nome: office.nome || '',
      tipo: office.tipo,
      historia: office.historia?.trim() || '',
      anoFundacao: office.anoFundacao || null,
      valores: (office as unknown as { valoresTexto?: string }).valoresTexto || '',
    },
    cliente: cliente
      ? {
          nome: cliente.nome,
          nif: cliente.nif || '',
          tipoEntidade: profile.tipoEntidade || 'eni',
          faturacaoAnual: profile.faturaçaoAnualPrevista || 0,
          funcionarios: profile.nrFuncionarios || 0,
          regimeContabilidade: profile.regimeContabilidade || '',
        }
      : null,
    servicos: honorarios.servicosExtra.slice(0, 8).map((s) => ({ nome: s.nome, preco: s.precoMensal })),
    totais: {
      mesSemIva: pricing.subtitle,
      linhas: pricing.items,
    },
  };
}

export function buildDeck(args: DeckInput & { id: string; ownerUid: string; gabineteId: string; tema?: DeckTheme }): DeckDoc {
  const now = Date.now();
  const cards = buildTemplateCards(args);
  return {
    v: 1,
    id: args.id,
    titulo: args.cliente?.nome ? `Proposta — ${args.cliente.nome}` : 'Proposta de Serviços',
    clienteId: args.cliente?.id ?? null,
    clienteNome: args.cliente?.nome,
    tema: args.tema ?? 'claro',
    cards,
    ownerUid: args.ownerUid,
    gabineteId: args.gabineteId,
    createdAt: now,
    updatedAt: now,
  };
}
