import type {
  AlertaGabinete,
  ContactoGabinete,
  GabineteCliente,
  Obrigacao,
  Tarefa,
} from './gabinete';
import type { OfficeSettings } from './officeSettings';
import { RelatorioPdf } from './reportPdf';

export function exportarFichaGabinetePdf(input: {
  cliente: GabineteCliente | null;
  contactos: ContactoGabinete[];
  alertas: AlertaGabinete[];
  tarefas: Tarefa[];
  obrigacoes: Obrigacao[];
  office: OfficeSettings;
}): boolean {
  const { cliente, contactos, alertas, tarefas, obrigacoes, office } = input;
  if (!cliente) return false;
  const fmt = (ms?: number) => (ms ? new Intl.DateTimeFormat('pt-PT').format(new Date(ms)) : '—');
  const pdf = new RelatorioPdf({
    titulo: 'Ficha do cliente',
    subtitulo: 'Visão 360 · resumo operacional do gabinete',
    cliente: cliente.nome,
    nif: cliente.nif,
    escritorio: { nome: office.nome, corPrimaria: office.corPrimaria, logoDataUrl: office.logoDataUrl },
    nomeFicheiro: `Ficha-${cliente.nome}`,
  });
  pdf.seccao('Identificação').tabela([
    { label: 'Nome', valor: cliente.nome },
    { label: 'NIF', valor: cliente.nif || '—' },
    { label: 'CAE', valor: cliente.caes ? `${cliente.caes}${cliente.caeDescricao ? ` – ${cliente.caeDescricao}` : ''}` : '—' },
    { label: 'Regime de IVA', valor: cliente.regimeIva || '—' },
    { label: 'IRC', valor: cliente.regimeIrc || '—' },
    { label: 'Tipo de sociedade', valor: cliente.tipoSociedade || '—' },
    { label: 'Início de atividade', valor: fmt(cliente.inicioAtividade) },
    { label: 'N.º trabalhadores', valor: cliente.nrTrabalhadores != null ? String(cliente.nrTrabalhadores) : '—' },
    { label: 'Gerentes', valor: Array.isArray(cliente.gerentes) ? cliente.gerentes.join(', ') : '—' },
    { label: 'Responsável interno', valor: cliente.responsavelInterno?.nome || '—' },
    { label: 'Supervisor', valor: cliente.supervisor?.nome || '—' },
    { label: 'Apoio administrativo', valor: cliente.apoioAdministrativo?.nome || '—' },
  ]);
  const obrs = obrigacoes
    .filter((o) => o.clienteId === cliente.id && !o.deletedAt)
    .sort((a, b) => a.vencimento - b.vencimento);
  pdf.seccao('Obrigações').tabela(obrs.map((o) => ({
    label: `${fmt(o.vencimento)} · ${o.titulo}`,
    valor: o.estado === 'entregue' ? 'Entregue' : o.estado === 'atrasada' ? 'Atrasada' : o.estado === 'dispensada' ? 'Dispensada' : 'Pendente',
  })));
  const abertos = alertas.filter((a) => a.clienteId === cliente.id && (a.estado ?? 'aberto') === 'aberto');
  pdf.seccao('Alertas abertos').tabela(abertos.map((a) => ({
    label: a.texto,
    valor: a.vencimento ? fmt(a.vencimento) : 'sem prazo',
  })));
  pdf.seccao('Contactos').tabela(contactos.filter((c) => c.clienteId === cliente.id).map((c) => ({
    label: `${c.nome}${c.cargo ? ` · ${c.cargo}` : ''}`,
    valor: [c.telefone, c.email].filter(Boolean).join(' · ') || '—',
  })));
  const abertas = tarefas.filter((t) => t.clienteId === cliente.id && t.estado !== 'done');
  pdf.seccao('Tarefas em aberto').tabela(abertas.map((t) => ({
    label: t.titulo,
    valor: t.dataVencimento ? fmt(t.dataVencimento) : t.estado,
  })));
  if (cliente.situacaoAtual?.length) {
    pdf.seccao('Situação atual').tabela(cliente.situacaoAtual.map((s) => ({ label: s.texto, valor: '' })));
  }
  if (cliente.orientacoes?.trim()) pdf.seccao('Orientações à equipa').paragrafo(cliente.orientacoes);
  pdf.nota('Documento interno do gabinete. Dados pessoais e fiscais - trate conforme o RGPD.');
  pdf.save();
  return true;
}
