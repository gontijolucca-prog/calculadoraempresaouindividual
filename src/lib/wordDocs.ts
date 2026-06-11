/**
 * Geração de documentos em Word (.doc) — HTML estilizado que o Word/Pages/
 * LibreOffice abrem como documento editável. Sem bibliotecas externas: cada
 * documento é um HTML A4 que reproduz os modelos enviados pela contabilista
 * (Demonstrações Financeiras do TOConline, Declaração de Responsabilidade e
 * Ata de AG), preenchido com os dados que a app já tem.
 *
 * Regra: NUNCA inventar números. O que a app não sabe (balanço, tesouraria,
 * imposto oficial) fica como traço para a contabilista completar.
 */
import type { EmpresaRecord } from './empresas';
import type { OfficeSettings } from './officeSettings';
import type { ContabilidadeData } from '../ClientProfile';
import type { PreviSaState } from '../previSaState';
import { defaultPreviSaState } from '../previSaState';
import { impostoEstimado } from './previsaCalc';

// ─── Helpers de formatação ──────────────────────────────────────────────────

// Formato pt-PT clássico (igual ao TOConline): milhares com ponto, decimais com
// vírgula, sempre 2 casas. Determinístico — não depende do ICU do browser, que
// usa espaço como separador de milhares e não agrupa números de 4 dígitos.
function fmt(n: number): string {
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + grouped + ',' + dec;
}

/** Valor com sinal contabilístico: negativo entre parêntesis; 0/indef. → vazio. */
function val(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n) || n === 0) return '';
  return n < 0 ? `(${fmt(-n)})` : fmt(n);
}

/** Traço para campo por preencher (mantém a linha visível no documento). */
const DASH = '<span class="dash">&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;</span>';

/** Sublinhado pontilhado curto para placeholders inline (….…). */
const FILL = '<span class="fill">&#8230;&#8230;&#8230;&#8230;&#8230;&#8230;&#8230;</span>';

const esc = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function slug(s: string): string {
  return (s || 'documento')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'documento';
}

// ─── Dados derivados da empresa ───────────────────────────────────────────────

interface Ctx {
  emp: EmpresaRecord;
  office: OfficeSettings;
  prev: PreviSaState;
  cont: Partial<ContabilidadeData>;
  /** Saldos de abertura (= fecho do ano anterior), quando o SAF-T os trouxe. */
  contAb: Partial<ContabilidadeData>;
  nome: string;
  nif: string;
  ano: number;
  anoAnt: number;
  contabilista: string;
  cedula: string;
  localEscritorio: string;
}

function ctx(emp: EmpresaRecord, office: OfficeSettings): Ctx {
  const prev = { ...defaultPreviSaState(), ...(emp.previsa ?? {}) } as PreviSaState;
  const cont = (emp.profile?.contabilidade ?? {}) as Partial<ContabilidadeData>;
  const contAb = (emp.profile?.contabilidadeAbertura ?? {}) as Partial<ContabilidadeData>;
  const nome = (emp.nome || emp.profile?.nomeCliente || 'Empresa').trim();
  const nif = (emp.nif || emp.profile?.nif || '').trim();
  const ano = prev.periodo || new Date().getFullYear() - 1;
  const sociedade = office.tipo === 'sociedade';
  const contabilista = (sociedade ? (office.contabilistaResponsavel || office.nome) : office.nome) || '';
  return {
    emp, office, prev, cont, contAb, nome, nif, ano, anoAnt: ano - 1,
    contabilista,
    cedula: office.cedulaProfissional || '',
    localEscritorio: office.localidade || '',
  };
}

/** Valor de contabilidade: número (mesmo 0 explícito) → formatado; ausente → null (traço). */
function cv(cont: Partial<ContabilidadeData>, key: keyof ContabilidadeData): number | null {
  const v = cont[key];
  return typeof v === 'number' && Number.isFinite(v) && v !== 0 ? v : null;
}

const MESES_PT = ['janeiro', 'fevereiro', 'mar&ccedil;o', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Data de hoje por extenso ("5 de junho de 2026") — data de emissão dos documentos. */
function hojePorExtenso(): string {
  const d = new Date();
  return `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Imposto sobre o rendimento do período: o valor REAL da contabilidade (conta
 * 812 do SAF-T / perfil) quando existe; senão a ESTIMATIVA do motor Previsa
 * (IRC liquidado + tributações autónomas) calculada dos dados desta empresa.
 * Devolve também a origem, para o documento assinalar estimativas.
 */
function impostoPeriodo(c: Ctx): { valor: number | null; estimado: boolean } {
  const real = cv(c.cont, 'impostoRendimento');
  if (real != null) return { valor: real, estimado: false };
  const est = impostoEstimado(c.prev);
  return { valor: est != null && est !== 0 ? est : null, estimado: est != null && est !== 0 };
}

/** Resultado líquido do período: contabilidade (818) ou RAI − imposto (estimado). */
function resultadoLiquido(c: Ctx): { valor: number | null; estimado: boolean } {
  const real = cv(c.cont, 'resultadoLiquido');
  if (real != null) return { valor: real, estimado: false };
  const { valor: imposto } = impostoPeriodo(c);
  const rai = drLinhas(c.prev).rai;
  if (imposto != null && Number.isFinite(rai)) return { valor: rai - imposto, estimado: true };
  return { valor: null, estimado: false };
}

// ─── Demonstração de Resultados por Naturezas (a partir do Previsa) ───────────

function drLinhas(p: PreviSaState) {
  const vendas = p.rai_711 + p.rai_712 + p.rai_72;
  const subsidios = p.rai_75;
  const trabProprios = p.rai_74;
  const cmvCmc = p.rai_cmv + p.rai_cmc;
  const fse = p.rai_62;
  const pessoal = p.rai_63;
  const imparidade = p.rai_65;
  const provisoes = p.rai_67;
  const outrosRend = p.rai_76 + p.rai_77 + p.rai_78;
  const outrosGastos = p.rai_66 + p.rai_68;
  const ebitda = vendas + subsidios + trabProprios + outrosRend
    - cmvCmc - fse - pessoal - imparidade - provisoes - outrosGastos;
  const deprec = p.rai_64;
  const operacional = ebitda - deprec;
  const jurosObtidos = p.rai_79;
  const jurosSuportados = p.rai_69;
  const rai = operacional + jurosObtidos - jurosSuportados;
  return { vendas, subsidios, trabProprios, cmvCmc, fse, pessoal, imparidade, provisoes,
    outrosRend, outrosGastos, ebitda, deprec, operacional, jurosObtidos, jurosSuportados, rai };
}

// ─── Embrulho Word-HTML ───────────────────────────────────────────────────────

const STYLE = `
  @page { size: 21cm 29.7cm; margin: 1.8cm 1.4cm; }
  * { box-sizing: border-box; }
  html { background: #ffffff; }
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; margin: 0; background: #ffffff; }
  .hdr { display: table; width: 100%; margin-bottom: 4pt; }
  .hdr .l { display: table-cell; text-align: left; font-weight: bold; color: #0B1D2D; font-size: 11pt; }
  .hdr .r { display: table-cell; text-align: right; font-weight: bold; color: #1f4e79; font-size: 11pt; }
  h1.title { color: #1f4e79; font-size: 14pt; margin: 2pt 0 2pt; padding-bottom: 4pt; border-bottom: 1.5pt solid #1f4e79; page-break-after: avoid; }
  .em-euros { text-align: right; color: #1f4e79; font-size: 8pt; font-weight: bold; margin: 2pt 0 8pt; }
  table { border-collapse: collapse; width: 100%; max-width: 100%; page-break-inside: auto; }
  table.dr { table-layout: fixed; }
  table.dr td, table.dr th { padding: 3pt 4pt; font-size: 9.5pt; border-bottom: 0.5pt solid #e2e2e2; overflow-wrap: break-word; word-break: break-word; }
  table.dr th { color: #0B1D2D; border-bottom: 1pt solid #999; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tot td { font-weight: bold; border-top: 0.75pt solid #999; }
  .sec { font-weight: bold; text-align: center; color: #0B1D2D; }
  .ind { padding-left: 10pt !important; }
  .dash { color: #b0b0b0; letter-spacing: 1px; }
  .fill { color: #555; letter-spacing: 1px; }
  p { line-height: 1.5; margin: 6pt 0; text-align: justify; orphans: 2; widows: 2; }
  ul { margin: 4pt 0; page-break-inside: avoid; }
  li { margin: 3pt 0; line-height: 1.45; }
  .sigs { display: table; width: 100%; margin-top: 36pt; page-break-inside: avoid; }
  .sigs .c { display: table-cell; width: 50%; text-align: center; font-size: 9.5pt; padding-top: 24pt; }
  .sigs .line { border-top: 0.75pt solid #333; margin: 0 18pt; padding-top: 3pt; }
  .ftr { margin-top: 18pt; padding-top: 4pt; border-top: 0.5pt solid #ccc; color: #1f4e79; font-size: 8pt; text-align: right; }
  .meta { color: #555; font-size: 9pt; }
  .pgbreak { page-break-before: always; }
  /* Tabela larga (Alterações no Capital Próprio): compacta para caber em A4. */
  table.compact td, table.compact th { padding: 2pt 2.5pt; font-size: 6.5pt; }
  table.compact .num { white-space: normal; }
  table.compact .dash { letter-spacing: 0; }
  /* Ecrã: pré-visualização fluida à largura do painel (nunca corta na horizontal).
     A paginação/medidas A4 reais vêm do @page na impressão e no Word. */
  @media screen {
    body.editing { padding: 1.4cm 1.2cm; max-width: 21cm; margin: 0 auto; }
    body.editing [contenteditable]:focus { outline: 2px solid rgba(6,119,255,0.35); outline-offset: 2px; border-radius: 2px; }
  }
`;

function wordShell(title: string, body: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Estudo 360">
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head>
<body>${body}</body>
</html>`;
}

function cabecalho(c: Ctx, titulo: string, emEuros = true): string {
  // `titulo` é um literal de confiança com entidades HTML (ç, ã…) — NÃO escapar,
  // senão o & das entidades fica duplamente escapado. O nome da empresa (dados do
  // utilizador) continua escapado.
  return `<div class="hdr"><span class="l">${esc(c.nome.toUpperCase())}</span><span class="r">NIF: ${esc(c.nif) || FILL}</span></div>
<h1 class="title">${titulo}</h1>
${emEuros ? '<div class="em-euros">(em euros)</div>' : ''}`;
}

function rodape(): string {
  // Documentos entregues pela contabilista ao cliente — não levam marca do site.
  return '';
}

function assinaturas(): string {
  return `<div class="sigs"><div class="c"><div class="line">(Ger&ecirc;ncia)</div></div><div class="c"><div class="line">(Contabilista Certificado)</div></div></div>`;
}

// ─── Builders ─────────────────────────────────────────────────────────────────

export function buildDemonstracaoResultados(emp: EmpresaRecord, office: OfficeSettings): string {
  const c = ctx(emp, office);
  const d = drLinhas(c.prev);
  const { valor: imposto, estimado: impostoEst } = impostoPeriodo(c);
  const liquido = cv(c.cont, 'resultadoLiquido') ?? (imposto != null && Number.isFinite(d.rai) ? d.rai - imposto : null);
  const r = (label: string, v: number | null, opts: { tot?: boolean; ind?: boolean } = {}) =>
    `<tr class="${opts.tot ? 'tot' : ''}"><td class="${opts.ind ? 'ind' : ''}">${label}</td><td class="num"></td><td class="num">${val(v)}</td><td class="num"></td></tr>`;
  const body = `${cabecalho(c, `Demonstra&ccedil;&atilde;o dos resultados por naturezas em 31 de dezembro de ${c.ano}`)}
<table class="dr">
<tr><th style="text-align:left">Rendimentos e Gastos</th><th class="num">Notas</th><th class="num">${c.ano}</th><th class="num">${c.anoAnt}</th></tr>
${r('Vendas e servi&ccedil;os prestados', d.vendas)}
${r('Subs&iacute;dios &agrave; explora&ccedil;&atilde;o', d.subsidios)}
${r('Varia&ccedil;&atilde;o nos invent&aacute;rios da produ&ccedil;&atilde;o', null)}
${r('Trabalhos para a pr&oacute;pria entidade', d.trabProprios)}
${r('Custo das mercadorias vendidas e das mat&eacute;rias consumidas', d.cmvCmc ? -d.cmvCmc : null)}
${r('Fornecimentos e servi&ccedil;os externos', d.fse ? -d.fse : null)}
${r('Gastos com o pessoal', d.pessoal ? -d.pessoal : null)}
${r('Imparidade (perdas / revers&otilde;es)', d.imparidade ? -d.imparidade : null)}
${r('Provis&otilde;es (aumentos / redu&ccedil;&otilde;es)', d.provisoes ? -d.provisoes : null)}
${r('Outros rendimentos', d.outrosRend)}
${r('Outros gastos', d.outrosGastos ? -d.outrosGastos : null)}
${r('Total resultado antes de deprecia&ccedil;&otilde;es, gastos de financiamento e impostos', d.ebitda, { tot: true })}
${r('Gastos / revers&otilde;es de deprecia&ccedil;&atilde;o e de amortiza&ccedil;&atilde;o', d.deprec ? -d.deprec : null)}
${r('Total resultado operacional (antes de gastos de financiamento e impostos)', d.operacional, { tot: true })}
${r('Juros e rendimentos similares obtidos', d.jurosObtidos)}
${r('Juros e gastos similares suportados', d.jurosSuportados ? -d.jurosSuportados : null)}
${r('Total resultado antes de impostos', d.rai, { tot: true })}
${r('Imposto sobre o rendimento do per&iacute;odo', imposto != null ? -imposto : null)}
${r('Total resultado l&iacute;quido do per&iacute;odo', liquido, { tot: true })}
</table>
${impostoEst && imposto != null ? '<p class="meta">Nota: o imposto sobre o rendimento &eacute; uma estimativa do Previsa (IRC liquidado + tributa&ccedil;&otilde;es aut&oacute;nomas) &mdash; substitua pelo valor da conta 812 ao fechar as contas.</p>' : ''}
${assinaturas()}
${rodape()}`;
  return wordShell(`Demonstracao de Resultados ${c.ano}`, body);
}

export function buildFluxosCaixa(emp: EmpresaRecord, office: OfficeSettings): string {
  const c = ctx(emp, office);
  const k = c.cont;
  // Fluxos pelo método directo, derivados dos diários do SAF-T (classificação
  // por contrapartida dos movimentos de caixa). Convenção: saídas em negativo.
  const receb    = cv(k, 'fcRecebimentosClientes');
  const pagForn  = cv(k, 'fcPagamentosFornecedores');
  const pagPess  = cv(k, 'fcPagamentosPessoal');
  const imposto  = cv(k, 'fcImpostoRendimento');     // positivo = pago
  const outrosOp = cv(k, 'fcOutrosOperacionais');    // líquido (positivo = recebido)
  const pagInv   = cv(k, 'fcPagamentosInvestimento');
  const recInv   = cv(k, 'fcRecebimentosInvestimento');
  const finObt   = cv(k, 'fcFinanciamentosObtidos');
  const pagFin   = cv(k, 'fcPagamentosFinanciamento');
  const realCap  = cv(k, 'fcRealizacoesCapital');
  const temFluxos = [receb, pagForn, pagPess, imposto, outrosOp, pagInv, recInv, finObt, pagFin, realCap].some(v => v != null);
  const z = (v: number | null) => v ?? 0;
  const caixaOper = temFluxos ? z(receb) - z(pagForn) - z(pagPess) : null;
  const totalOp   = caixaOper != null ? caixaOper - z(imposto) + z(outrosOp) : null;
  const totalInv  = temFluxos ? z(recInv) - z(pagInv) : null;
  const totalFin  = temFluxos ? z(finObt) + z(realCap) - z(pagFin) : null;
  // Linha de atividade: valor quando existe, traço quando não (mantém a linha).
  const r = (label: string, v: number | null = null, ind = true) =>
    `<tr><td class="${ind ? 'ind' : ''}">${label}</td><td class="num"></td><td class="num">${v != null ? val(v) : (temFluxos ? '' : DASH)}</td></tr>`;
  // Linha com valor (ou traço se desconhecido) — totais e caixa início/fim/variação.
  const rv = (label: string, v: number | null, tot = false) =>
    `<tr class="${tot ? 'tot' : ''}"><td>${label}</td><td class="num"></td><td class="num">${v != null ? val(v) : DASH}</td></tr>`;
  const sec = (label: string) => `<tr class="tot"><td colspan="3" class="sec">${label}</td></tr>`;
  const caixaFim = cv(c.cont, 'caixaDepositos');
  const caixaIni = cv(c.cont, 'caixaInicio');
  const variacao = caixaFim != null && caixaIni != null ? caixaFim - caixaIni
                 : (totalOp != null ? totalOp + z(totalInv) + z(totalFin) : null);
  const body = `${cabecalho(c, `Fluxos de Caixa de 1 de janeiro de ${c.ano} a 31 de dezembro de ${c.ano}`)}
<table class="dr">
<tr><th style="text-align:left">Rubrica</th><th class="num">Notas</th><th class="num">${c.ano}</th></tr>
${sec('Fluxos de caixa das atividades operacionais')}
${r('Recebimentos de clientes', receb)}
${r('Pagamentos a fornecedores', pagForn != null ? -pagForn : null)}
${r('Pagamentos ao pessoal', pagPess != null ? -pagPess : null)}
${r('Caixa gerada pelas opera&ccedil;&otilde;es', caixaOper)}
${r('Pagamento/recebimento do imposto sobre o rendimento', imposto != null ? -imposto : null)}
${r('Outros recebimentos/pagamentos', outrosOp)}
${rv('Total fluxos de caixa das atividades operacionais', totalOp, true)}
${sec('Fluxos de caixa das atividades de investimento')}
${r('Pagamentos respeitantes a ativos fixos tang&iacute;veis / intang&iacute;veis', pagInv != null ? -pagInv : null)}
${r('Recebimentos provenientes de investimentos', recInv)}
${r('Subs&iacute;dios ao investimento / juros e rendimentos')}
${rv('Total fluxos de caixa das atividades de investimento', totalInv, true)}
${sec('Fluxos de caixa das atividades de financiamento')}
${r('Financiamentos obtidos', finObt)}
${r('Realiza&ccedil;&otilde;es de capital e cobertura de preju&iacute;zos', realCap)}
${r('Pagamentos: financiamentos, juros, dividendos', pagFin != null ? -pagFin : null)}
${rv('Total fluxos de caixa das atividades de financiamento', totalFin, true)}
${rv('Varia&ccedil;&atilde;o de caixa e seus equivalentes', variacao, true)}
${rv('Caixa e seus equivalentes no in&iacute;cio do per&iacute;odo', caixaIni)}
${rv('Caixa e seus equivalentes no fim do per&iacute;odo', caixaFim)}
</table>
<p class="meta">${temFluxos
    ? 'Nota: fluxos derivados automaticamente dos di&aacute;rios do SAF-T pelo m&eacute;todo directo (cada movimento de caixa classificado pela contrapartida) &mdash; reveja a classifica&ccedil;&atilde;o antes de entregar.'
    : 'Nota: a caixa no in&iacute;cio/fim vem da contabilidade (perfil do cliente); os fluxos por atividade s&atilde;o detalhados a partir do balancete.'}</p>
${assinaturas()}
${rodape()}`;
  return wordShell(`Fluxos de Caixa ${c.ano}`, body);
}

export function buildAlteracoesCapitalProprio(emp: EmpresaRecord, office: OfficeSettings): string {
  const c = ctx(emp, office);
  // Capital subscrito: prefere o realizado da contabilidade (SAF-T), senão o capital social da ficha.
  const capital = cv(c.cont, 'capitalRealizado') ?? c.emp.profile?.societaria?.capitalSocial ?? null;
  const reservasRT = cv(c.cont, 'reservasResultadosTransitados');
  const outras = cv(c.cont, 'outrasVariacoesCapital');
  const rl = resultadoLiquido(c).valor;
  // Posição no INÍCIO do período: APENAS saldos de abertura do SAF-T (= fecho
  // do ano anterior). Sem abertura fica traço — copiar o fecho para o início
  // implicaria "zero movimentos no período", o que seria contabilisticamente
  // falso. Exceção: o capital subscrito raramente muda; mantém-se o fallback
  // SÓ para o capital quando não há abertura nenhuma mas há capital na ficha.
  const temAbertura   = cv(c.contAb, 'capitalRealizado') != null
    || cv(c.contAb, 'reservasResultadosTransitados') != null
    || cv(c.contAb, 'outrasVariacoesCapital') != null;
  const capitalIni    = temAbertura ? cv(c.contAb, 'capitalRealizado') : capital;
  const reservasIni   = cv(c.contAb, 'reservasResultadosTransitados');
  const outrasIni     = cv(c.contAb, 'outrasVariacoesCapital');
  // Colunas: 0=Capital, 3=Prémios, ... 6=Result.Transitados, 8=Ajust/Outras, 9=Result.Líquido, 10=Total.
  const cols = ['Capital Subscrito', 'A&ccedil;&otilde;es (quotas) pr&oacute;prias', 'Outros instrum. de Cap. Pr&oacute;prio',
    'Pr&eacute;mios de emiss&atilde;o', 'Reservas Legais', 'Outras Reservas', 'Resultados Transitados',
    'Excedentes de Revaloriza&ccedil;&atilde;o', 'Ajustamentos / Outras Varia&ccedil;&otilde;es', 'Resultado L&iacute;quido', 'Total'];
  const head = `<tr><th style="text-align:left">DESCRI&Ccedil;&Atilde;O</th>${cols.map(x => `<th class="num">${x}</th>`).join('')}</tr>`;
  // overrides: mapa coluna→valor; células sem valor ficam tracejadas (vazio = traço).
  // Tabela larga (12 colunas) — traço curto para não forçar a largura das células.
  const SHORTDASH = '<span class="dash">&#8212;</span>';
  const sumRow = (vals: Record<number, number | null>) =>
    Object.values(vals).reduce((s: number, v) => s + (v ?? 0), 0);
  const row = (label: string, vals: Record<number, number | null>, withTotal = false) => {
    const tot = withTotal ? sumRow(vals) : null;
    return `<tr><td>${label}</td>${cols.map((_, i) => {
      if (i === 10) return `<td class="num">${tot != null ? val(tot) : SHORTDASH}</td>`;
      const v = vals[i];
      return `<td class="num">${v != null ? val(v) : SHORTDASH}</td>`;
    }).join('')}</tr>`;
  };
  const inicio = { 0: capitalIni, 6: reservasIni, 8: outrasIni } as Record<number, number | null>;
  const fim    = { 0: capital, 6: reservasRT, 8: outras, 9: rl } as Record<number, number | null>;
  const anyData = capital != null || reservasRT != null || outras != null || rl != null;
  const body = `${cabecalho(c, `Demonstra&ccedil;&atilde;o das Altera&ccedil;&otilde;es no Capital Pr&oacute;prio &mdash; ${c.ano}`)}
<table class="dr compact" style="table-layout:fixed">
<colgroup><col style="width:16%">${cols.slice(0, -1).map(() => '<col>').join('')}<col></colgroup>
${head}
${row(`Posi&ccedil;&atilde;o no in&iacute;cio do per&iacute;odo ${c.ano}`, inicio, anyData)}
${row('Altera&ccedil;&otilde;es no per&iacute;odo', {})}
${row('Resultado l&iacute;quido do per&iacute;odo', { 9: rl }, rl != null)}
${row('Opera&ccedil;&otilde;es com detentores de capital', {})}
${row(`Posi&ccedil;&atilde;o no fim do per&iacute;odo ${c.ano}`, fim, anyData)}
</table>
<p class="meta">Nota: capital, reservas e resultado l&iacute;quido vêm da contabilidade (perfil do cliente); movimentos do per&iacute;odo a completar.</p>
${assinaturas()}
${rodape()}`;
  return wordShell(`Alteracoes Capital Proprio ${c.ano}`, body);
}

/** Corpo do Balanço — partilhado pelo documento próprio e pelo pacote DF. */
function buildBalancoBody(c: Ctx): string {
  // Preenchido a partir da contabilidade (perfil); totais calculados.
  const k = c.cont;
  const z = (v: number | null) => v ?? 0;
  const aft = cv(k, 'ativoFixoTangivel'), intang = cv(k, 'ativoIntangivel'), invFin = cv(k, 'investimentosFinanceiros');
  const inv = cv(k, 'inventarios'), cli = cv(k, 'clientes'), eoepA = cv(k, 'estadoOutrosAtivo'),
        outrosA = cv(k, 'outrosAtivosCorrentes'), caixa = cv(k, 'caixaDepositos');
  const cap = cv(k, 'capitalRealizado'), resRT = cv(k, 'reservasResultadosTransitados'), outrasV = cv(k, 'outrasVariacoesCapital');
  const rl = resultadoLiquido(c).valor;
  const fin = cv(k, 'financiamentosObtidos'), forn = cv(k, 'fornecedores'), eoepP = cv(k, 'estadoOutrosPassivo'), outrosP = cv(k, 'outrosPassivos');
  const anyAsset = [aft, intang, invFin, inv, cli, eoepA, outrosA, caixa].some(x => x != null);
  const anyCP = [cap, resRT, rl, outrasV].some(x => x != null);
  const anyPass = [fin, forn, eoepP, outrosP].some(x => x != null);
  const totalAtivo = anyAsset ? [aft, intang, invFin, inv, cli, eoepA, outrosA, caixa].reduce((s, x) => s + z(x), 0) : null;
  const totalCP = anyCP ? [cap, resRT, rl, outrasV].reduce((s, x) => s + z(x), 0) : null;
  const totalPass = anyPass ? [fin, forn, eoepP, outrosP].reduce((s, x) => s + z(x), 0) : null;
  const totalCPPass = (totalCP != null || totalPass != null) ? z(totalCP) + z(totalPass) : null;
  // Coluna do ano anterior: saldos de ABERTURA do SAF-T (= fecho do ano anterior).
  const a = c.contAb;
  const aftA = cv(a, 'ativoFixoTangivel'), intangA = cv(a, 'ativoIntangivel'), invFinA = cv(a, 'investimentosFinanceiros');
  const invA = cv(a, 'inventarios'), cliA = cv(a, 'clientes'), eoepAA = cv(a, 'estadoOutrosAtivo'),
        outrosAA = cv(a, 'outrosAtivosCorrentes'), caixaA = cv(a, 'caixaDepositos');
  const capA = cv(a, 'capitalRealizado'), resRTA = cv(a, 'reservasResultadosTransitados'),
        outrasVA = cv(a, 'outrasVariacoesCapital'), rlA = cv(a, 'resultadoLiquido');
  const finA = cv(a, 'financiamentosObtidos'), fornA = cv(a, 'fornecedores'), eoepPA = cv(a, 'estadoOutrosPassivo'), outrosPA = cv(a, 'outrosPassivos');
  const anyAssetA = [aftA, intangA, invFinA, invA, cliA, eoepAA, outrosAA, caixaA].some(x => x != null);
  const anyCPA = [capA, resRTA, rlA, outrasVA].some(x => x != null);
  const anyPassA = [finA, fornA, eoepPA, outrosPA].some(x => x != null);
  const totalAtivoA = anyAssetA ? [aftA, intangA, invFinA, invA, cliA, eoepAA, outrosAA, caixaA].reduce((s, x) => s + z(x), 0) : null;
  const totalCPA = anyCPA ? [capA, resRTA, rlA, outrasVA].reduce((s, x) => s + z(x), 0) : null;
  const totalPassA = anyPassA ? [finA, fornA, eoepPA, outrosPA].reduce((s, x) => s + z(x), 0) : null;
  const totalCPPassA = (totalCPA != null || totalPassA != null) ? z(totalCPA) + z(totalPassA) : null;
  const brow = (label: string, v: number | null, tot = false, vAnt: number | null = null) =>
    `<tr class="${tot ? 'tot' : ''}"><td class="${tot ? '' : 'ind'}">${label}</td><td class="num"></td><td class="num">${v != null ? val(v) : (tot ? '' : DASH)}</td><td class="num">${vAnt != null ? val(vAnt) : ''}</td></tr>`;
  const bsec = (label: string) => `<tr class="tot"><td colspan="4" class="sec">${label}</td></tr>`;
  return `<div class="pgbreak">${cabecalho(c, `Balan&ccedil;o em 31 de dezembro de ${c.ano}`)}
<table class="dr">
<tr><th style="text-align:left">Rubricas</th><th class="num">Notas</th><th class="num">${c.ano}</th><th class="num">${c.anoAnt}</th></tr>
${bsec('ATIVO')}
${bsec('Ativo n&atilde;o corrente')}
${brow('Ativos fixos tang&iacute;veis', aft, false, aftA)}
${brow('Ativos intang&iacute;veis', intang, false, intangA)}
${brow('Investimentos financeiros', invFin, false, invFinA)}
${bsec('Ativo corrente')}
${brow('Invent&aacute;rios', inv, false, invA)}
${brow('Clientes', cli, false, cliA)}
${brow('Estado e outros entes p&uacute;blicos', eoepA, false, eoepAA)}
${brow('Outros ativos correntes', outrosA, false, outrosAA)}
${brow('Caixa e dep&oacute;sitos banc&aacute;rios', caixa, false, caixaA)}
${brow('Total do ativo', totalAtivo, true, totalAtivoA)}
${bsec('CAPITAL PR&Oacute;PRIO E PASSIVO')}
${bsec('Capital pr&oacute;prio')}
${brow('Capital realizado', cap, false, capA)}
${brow('Reservas e resultados transitados', resRT, false, resRTA)}
${brow('Outras varia&ccedil;&otilde;es no capital pr&oacute;prio', outrasV, false, outrasVA)}
${brow('Resultado l&iacute;quido do per&iacute;odo', rl, false, rlA)}
${brow('Total do capital pr&oacute;prio', totalCP, true, totalCPA)}
${bsec('Passivo')}
${brow('Financiamentos obtidos', fin, false, finA)}
${brow('Fornecedores', forn, false, fornA)}
${brow('Estado e outros entes p&uacute;blicos', eoepP, false, eoepPA)}
${brow('Outros passivos', outrosP, false, outrosPA)}
${brow('Total do passivo', totalPass, true, totalPassA)}
${brow('Total do capital pr&oacute;prio e do passivo', totalCPPass, true, totalCPPassA)}
</table>
<p class="meta">Nota: Balan&ccedil;o preenchido a partir da contabilidade (perfil do cliente / SAF-T)${anyAssetA || anyCPA || anyPassA ? `; a coluna de ${c.anoAnt} vem dos saldos de abertura do SAF-T` : ''}; rubricas sem dados ficam por preencher.</p>
${rodape()}</div>`;
}

/** Balanço como documento único (também incluído no pacote DF). */
export function buildBalanco(emp: EmpresaRecord, office: OfficeSettings): string {
  const c = ctx(emp, office);
  return wordShell(`Balanco ${c.ano}`, buildBalancoBody(c));
}

export function buildDemonstracoesFinanceiras(emp: EmpresaRecord, office: OfficeSettings): string {
  const c = ctx(emp, office);
  // Capa
  // Cabeçalho curto no topo da página (antes era uma capa com 9cm de espaço em
  // branco antes do título — o documento parecia começar a meio da folha).
  const capa = `<div class="meta" style="font-size:12pt;color:#555">${esc(c.nome.toUpperCase())}</div>
<div style="font-size:22pt;font-weight:bold;color:#111;margin:4pt 0">Demonstra&ccedil;&otilde;es Financeiras</div>
<div class="meta" style="font-size:12pt">Exerc&iacute;cio de ${c.ano}</div>
<div style="margin:12pt 0 18pt 0;width:7cm;border-top:0.75pt solid #ccc"></div>`;
  const balanco = buildBalancoBody(c);
  // DR + Alterações CP + Fluxos como páginas seguintes (reutiliza os builders, sem <html>)
  const inner = (html: string) => {
    const m = html.match(/<body>([\s\S]*)<\/body>/);
    return m ? m[1] : '';
  };
  const dr = `<div class="pgbreak">${inner(buildDemonstracaoResultados(emp, office))}</div>`;
  const acp = `<div class="pgbreak">${inner(buildAlteracoesCapitalProprio(emp, office))}</div>`;
  const fc = `<div class="pgbreak">${inner(buildFluxosCaixa(emp, office))}</div>`;
  return wordShell(`Demonstracoes Financeiras ${c.ano}`, capa + balanco + dr + acp + fc);
}

export function buildDeclaracaoResponsabilidade(emp: EmpresaRecord, office: OfficeSettings): string {
  const c = ctx(emp, office);
  const nomeCC = c.contabilista ? esc(c.contabilista) : FILL;
  const cedula = c.cedula ? esc(c.cedula) : FILL;
  const entidade = c.nome ? esc(c.nome) : FILL;
  const nif = c.nif ? esc(c.nif) : FILL;
  const local = c.localEscritorio ? esc(c.localEscritorio) : FILL;
  const body = `<p style="text-align:right;color:#777;font-size:8.5pt">(PROPOSTA)</p>
<h1 class="title" style="text-align:center;border:0;color:#0B1D2D">DECLARA&Ccedil;&Atilde;O DE RESPONSABILIDADE FINAL DE EXERC&Iacute;CIO</h1>
<p>Nos termos do disposto no n.&ordm; 6 do Artigo 12.&ordm; do C&oacute;digo Deontol&oacute;gico dos Contabilistas Certificados, emite-se a presente declara&ccedil;&atilde;o a pedido do contabilista certificado ${nomeCC}, c&eacute;dula profissional n.&ordm; ${cedula}, a quem compete planificar, organizar, coordenar a execu&ccedil;&atilde;o da contabilidade e assumir a responsabilidade pela regularidade t&eacute;cnica, nas &aacute;reas contabil&iacute;stica e fiscal de ${entidade} (entidade), NIF/NIPC ${nif}, do exerc&iacute;cio fiscal de ${c.ano}.</p>
<p>Para o efeito, declara-se como &eacute; nosso dever que:</p>
<p>N&atilde;o foram omitidos quaisquer documentos ou informa&ccedil;&otilde;es relevantes com efeitos na contabilidade e na verdade fiscal, designadamente:</p>
<ul>
<li>N&atilde;o foram ocultados, omitidos, viciados ou destru&iacute;dos documentos de suporte contabil&iacute;stico ou sonegada informa&ccedil;&atilde;o que tenha influ&ecirc;ncia direta na situa&ccedil;&atilde;o contabil&iacute;stica e fiscal da entidade;</li>
<li>Foram transmitidos todos os compromissos e todas as responsabilidades, reais ou contingentes que afetam a situa&ccedil;&atilde;o da empresa;</li>
<li>A empresa n&atilde;o tem nenhum lit&iacute;gio ou conflito esperado com qualquer entidade para al&eacute;m dos divulgados nas demonstra&ccedil;&otilde;es financeiras;</li>
<li>N&atilde;o existem acordos em quaisquer institui&ccedil;&otilde;es envolvendo compensa&ccedil;&otilde;es de saldos, restri&ccedil;&otilde;es de movimentos de dinheiro ou linhas de cr&eacute;dito, para al&eacute;m dos divulgados;</li>
<li>As despesas n&atilde;o documentadas ter&atilde;o a correspondente penaliza&ccedil;&atilde;o fiscal;</li>
<li>N&atilde;o existem irregularidades envolvendo os &oacute;rg&atilde;os sociais que possam ter efeito relevante nas demonstra&ccedil;&otilde;es financeiras;</li>
<li>N&atilde;o temos projetos ou a&ccedil;&otilde;es em curso que possam afetar a continuidade das opera&ccedil;&otilde;es da empresa;</li>
<li>Todas as situa&ccedil;&otilde;es que possam afetar as demonstra&ccedil;&otilde;es financeiras e fiscais foram comunicadas em devido tempo;</li>
<li>Foram prestados todos os esclarecimentos solicitados pelo contabilista certificado.</li>
</ul>
<p style="margin-top:20pt">${local}, ${hojePorExtenso()}</p>
<p style="margin-top:24pt"><strong>A Ger&ecirc;ncia/Administra&ccedil;&atilde;o</strong><br>${gerenciaNomes(emp)}</p>
${rodape()}`;
  return wordShell(`Declaracao de Responsabilidade ${c.ano}`, body);
}

function gerenciaNomes(emp: EmpresaRecord): string {
  const soc = emp.profile?.societaria;
  if (soc?.gerenteNome && soc.gerenteNome.trim()) return esc(soc.gerenteNome) + ' (gerente)';
  return `${FILL} (nomes e cargos)`;
}

export function buildActaAG(emp: EmpresaRecord, office: OfficeSettings): string {
  const c = ctx(emp, office);
  const soc = emp.profile?.societaria;
  const capital = soc?.capitalSocial ?? 0;
  const socios = (soc?.socios ?? []).filter(s => s.nome?.trim() || s.percentagem);
  const presidente = soc?.gerenteNome?.trim() || (socios[0]?.nome?.trim() ?? '');
  const quota = (pct: number) => capital > 0 && pct ? `&euro; ${fmt(capital * pct / 100)}` : DASH;
  // Data da AG de aprovação de contas: por defeito o prazo legal (até 3 meses
  // após o fecho — art. 65.º-A CSC), i.e. 31 de março do ano seguinte. Editável.
  const dataAG = `31 de mar&ccedil;o de ${c.ano + 1}`;
  // Resultado líquido a aplicar: contabilidade (818) ou estimativa do Previsa.
  const { valor: rlValor, estimado: rlEstimado } = resultadoLiquido(c);
  const rlTxt = rlValor != null ? `&euro; ${fmt(rlValor)}${rlEstimado ? ' <span class="meta">(estimativa Previsa &mdash; confirmar no fecho)</span>' : ''}` : DASH;
  const linhasSocios = socios.length
    ? socios.map(s => `<li>${s.nome?.trim() ? esc(s.nome) : FILL}; titular de quota social com valor nominal de ${quota(s.percentagem)}${s.percentagem ? ` (${fmt(s.percentagem)}% do capital)` : ''}.</li>`).join('')
    : `<li>${FILL}; titular de quota social com valor nominal de ${DASH}.</li>`;
  const body = `<h1 class="title" style="text-align:center;border:0;color:#0B1D2D">ATA N.&ordm; ${FILL}</h1>
<p>Reuni&atilde;o da Assembleia Geral de S&oacute;cios de <strong>${esc(c.nome)}</strong>${c.nif ? `, NIF ${esc(c.nif)}` : ''}, nos termos previstos no artigo 54.&ordm; do C&oacute;digo das Sociedades Comerciais (CSC).</p>
<p>Data e hora da realiza&ccedil;&atilde;o da AG de s&oacute;cios: ${dataAG}, pelas ${FILL}.<br>
Local da realiza&ccedil;&atilde;o da AG de s&oacute;cios: ${c.localEscritorio ? esc(c.localEscritorio) + ' &mdash; ' : ''}Sede Social da Entidade.</p>
<p>Todos os S&oacute;cios estiveram presentes, representando as seguintes quotas de Capital Social:</p>
<ul>${linhasSocios}</ul>
<p>Totalidade do Capital Social subscrito e realizado pelos S&oacute;cios: ${capital > 0 ? `&euro; ${fmt(capital)}` : DASH}.<br>
Nome do S&oacute;cio que presidiu &agrave; AG de S&oacute;cios: ${presidente ? esc(presidente) : FILL}.</p>
<p>Todos os S&oacute;cios concordaram que a AG re&uacute;na sem observ&acirc;ncia de formalidades pr&eacute;vias, porque est&atilde;o todos os S&oacute;cios presentes; e deliberou-se sobre a ordem de trabalhos seguinte:</p>
<ul>
<li>Aprecia&ccedil;&atilde;o e vota&ccedil;&atilde;o do Relat&oacute;rio de Gest&atilde;o, das Contas e das Demonstra&ccedil;&otilde;es Financeiras do per&iacute;odo econ&oacute;mico ${c.ano};</li>
<li>Aprecia&ccedil;&atilde;o e vota&ccedil;&atilde;o da proposta do Conselho de Ger&ecirc;ncia sobre a aplica&ccedil;&atilde;o a dar ao Resultado L&iacute;quido apurado no per&iacute;odo econ&oacute;mico ${c.ano}.</li>
</ul>
<p><strong>Decis&otilde;es tomadas por unanimidade, por todos os S&oacute;cios presentes:</strong></p>
<ul>
<li>Aprovar o Relat&oacute;rio de Gest&atilde;o, as Contas e as Demonstra&ccedil;&otilde;es Financeiras do per&iacute;odo econ&oacute;mico ${c.ano} apresentadas pelo Conselho de Ger&ecirc;ncia.</li>
<li>Aprovar a proposta do Conselho de Ger&ecirc;ncia sobre a aplica&ccedil;&atilde;o a dar ao Resultado L&iacute;quido apurado no per&iacute;odo econ&oacute;mico ${c.ano}, nos termos seguintes: transferir o montante total de Resultado L&iacute;quido do Exerc&iacute;cio, no valor de ${rlTxt}, para a r&uacute;brica de Resultados Transitados (RT).</li>
</ul>
<p>E nada mais havendo a tratar, o Presidente da AG de S&oacute;cios deu por finda a presente reuni&atilde;o. Foi redigida esta ata, a qual traduz na &iacute;ntegra as incid&ecirc;ncias ocorridas na AG de S&oacute;cios. Em sinal de plena concord&acirc;ncia, vai a presente ata ser assinada por todos os S&oacute;cios que nela estiveram presentes.</p>
<p style="margin-top:18pt">${c.localEscritorio ? esc(c.localEscritorio) + ', ' : ''}${dataAG}.</p>
<p style="margin-top:18pt"><strong>Os S&oacute;cios presentes,</strong></p>
${(socios.length ? socios : [{ nome: '' }, { nome: '' }]).map(s => `<p style="margin-top:22pt">_______________________________<br>${s.nome?.trim() ? esc(s.nome) : ''}</p>`).join('')}
${rodape()}`;
  return wordShell(`Ata Assembleia Geral ${c.ano}`, body);
}

// ─── Registo de tipos de documento (alimenta o radio + o handler) ─────────────

export type DocTypeId = 'dr' | 'declaracao' | 'acta' | 'alteracoes' | 'fluxos' | 'balanco' | 'df';

export interface DocTypeDef {
  id: DocTypeId;
  label: string;
  descricao: string;
  /** 'completo' = preenchido dos dados da app; 'parcial' = identificação + alguns campos; 'modelo' = estrutura em branco. */
  fill: 'completo' | 'parcial' | 'modelo';
  /** Precisa de dados do Previsa para ficar útil. */
  precisaPrevisa: boolean;
  build: (emp: EmpresaRecord, office: OfficeSettings) => string;
  filename: (emp: EmpresaRecord) => string;
}

export const DOC_TYPES: DocTypeDef[] = [
  {
    id: 'dr', label: 'Demonstração dos Resultados por Naturezas',
    descricao: 'Preenchida com os valores do Previsa desta empresa.',
    fill: 'completo', precisaPrevisa: true,
    build: buildDemonstracaoResultados,
    filename: (e) => `Demonstracao_Resultados_${slug(e.nome || '')}`,
  },
  {
    id: 'declaracao', label: 'Declaração de Responsabilidade Final de Exercício',
    descricao: 'Contabilista, entidade, NIF e ano preenchidos. (Código Deontológico dos CC)',
    fill: 'completo', precisaPrevisa: false,
    build: buildDeclaracaoResponsabilidade,
    filename: (e) => `Declaracao_Responsabilidade_${slug(e.nome || '')}`,
  },
  {
    id: 'acta', label: 'Ata de Assembleia Geral de Sócios',
    descricao: 'Sócios, capital social e gerente preenchidos a partir da ficha do cliente.',
    fill: 'completo', precisaPrevisa: false,
    build: buildActaAG,
    filename: (e) => `Ata_Assembleia_Geral_${slug(e.nome || '')}`,
  },
  {
    id: 'alteracoes', label: 'Demonstração das Alterações no Capital Próprio',
    descricao: 'Capital, reservas e resultado preenchidos; movimentos do período para completar.',
    fill: 'parcial', precisaPrevisa: false,
    build: buildAlteracoesCapitalProprio,
    filename: (e) => `Alteracoes_Capital_Proprio_${slug(e.nome || '')}`,
  },
  {
    id: 'fluxos', label: 'Demonstração de Fluxos de Caixa',
    descricao: 'Preenchida com os movimentos de caixa do SAF-T (método directo).',
    fill: 'completo', precisaPrevisa: false,
    build: buildFluxosCaixa,
    filename: (e) => `Fluxos_Caixa_${slug(e.nome || '')}`,
  },
  {
    id: 'balanco', label: 'Balanço',
    descricao: 'Preenchido a partir da contabilidade (perfil/SAF-T); coluna do ano anterior com os saldos de abertura.',
    fill: 'parcial', precisaPrevisa: false,
    build: buildBalanco,
    filename: (e) => `Balanco_${slug(e.nome || '')}`,
  },
  {
    id: 'df', label: 'Demonstrações Financeiras (pacote completo)',
    descricao: 'Capa + Balanço + Resultados + Alterações no Capital Próprio + Fluxos de Caixa.',
    fill: 'parcial', precisaPrevisa: true,
    build: buildDemonstracoesFinanceiras,
    filename: (e) => `Demonstracoes_Financeiras_${slug(e.nome || '')}`,
  },
];

// ─── Estado de preenchimento real (badge dinâmico) ────────────────────────────

/** Há dados contabilísticos no Previsa desta empresa? */
export function hasPrevisaData(emp: EmpresaRecord): boolean {
  const s = (emp.previsa ?? {}) as Record<string, unknown>;
  return Object.entries(s).some(([k, v]) =>
    (k.startsWith('rai_') || k === 'volumeNegocios') && typeof v === 'number' && v !== 0,
  );
}

/**
 * Estado de preenchimento REAL de um documento para uma empresa concreta —
 * o `fill` estático do DOC_TYPES descreve o melhor caso (com todos os dados);
 * aqui verificamos os dados que o builder de facto usa e devolvemos o estado
 * honesto. Sem isto, o badge dizia "Preenchido" mesmo com o documento a sair
 * em branco (Previsa vazio, ficha societária por preencher, etc.).
 */
/** Campos dos fluxos de caixa (método directo) derivados dos diários do SAF-T. */
const FC_KEYS: (keyof ContabilidadeData)[] = [
  'fcRecebimentosClientes', 'fcPagamentosFornecedores', 'fcPagamentosPessoal',
  'fcImpostoRendimento', 'fcOutrosOperacionais', 'fcPagamentosInvestimento',
  'fcRecebimentosInvestimento', 'fcFinanciamentosObtidos', 'fcPagamentosFinanciamento',
  'fcRealizacoesCapital',
];

export function fillStatusFor(id: DocTypeId, emp: EmpresaRecord, office: OfficeSettings): 'completo' | 'parcial' | 'modelo' {
  const soc = emp.profile?.societaria;
  const cont = (emp.profile?.contabilidade ?? {}) as Partial<ContabilidadeData>;
  const temSocios = !!(soc?.socios ?? []).filter(s => s.nome?.trim() || s.percentagem).length;
  const temCapital = (soc?.capitalSocial ?? 0) > 0;
  // O builder das Alterações no CP usa capital da contabilidade (capitalRealizado,
  // ex. importado do SAF-T) com fallback à ficha societária — o badge espelha isso.
  const temCapitalCP = cv(cont, 'capitalRealizado') !== null || temCapital;
  const temGerente = !!soc?.gerenteNome?.trim();
  const temIdent = !!((emp.nome || emp.profile?.nomeCliente) && (emp.nif || emp.profile?.nif));
  const temCC = !!(office.tipo === 'sociedade' ? (office.contabilistaResponsavel || office.nome) : office.nome);
  const previsa = hasPrevisaData(emp);
  const nFc = FC_KEYS.filter(kk => cv(cont, kk) !== null).length;
  const temCaixa = cv(cont, 'caixaDepositos') !== null || cv(cont, 'caixaInicio') !== null;
  const temBalanco = (['ativoFixoTangivel', 'clientes', 'caixaDepositos', 'capitalRealizado', 'fornecedores', 'resultadoLiquido'] as (keyof ContabilidadeData)[])
    .some(kk => cv(cont, kk) !== null);
  switch (id) {
    case 'dr':
      return previsa ? 'completo' : 'modelo';
    case 'declaracao':
      return temCC && !!office.cedulaProfissional && temIdent ? 'completo' : (temIdent || temCC) ? 'parcial' : 'modelo';
    case 'acta':
      return temSocios && temCapital && temGerente ? 'completo' : (temSocios || temCapital) ? 'parcial' : 'modelo';
    case 'alteracoes':
      return temCapitalCP ? 'parcial' : 'modelo';
    case 'fluxos':
      // Derivados dos diários do SAF-T: com 3+ rubricas de fluxos o documento
      // sai utilizável; só caixa início/fim ou poucas rubricas → parcial.
      return nFc >= 3 ? 'completo' : (nFc > 0 || temCaixa) ? 'parcial' : 'modelo';
    case 'balanco': {
      const nBal = (['ativoFixoTangivel', 'ativoIntangivel', 'investimentosFinanceiros', 'inventarios',
        'clientes', 'estadoOutrosAtivo', 'outrosAtivosCorrentes', 'caixaDepositos', 'capitalRealizado',
        'reservasResultadosTransitados', 'outrasVariacoesCapital', 'financiamentosObtidos', 'fornecedores',
        'estadoOutrosPassivo', 'outrosPassivos', 'resultadoLiquido'] as (keyof ContabilidadeData)[])
        .filter(kk => cv(cont, kk) !== null).length;
      return nBal >= 6 ? 'completo' : nBal > 0 ? 'parcial' : 'modelo';
    }
    case 'df':
      return previsa && temBalanco && nFc >= 3 ? 'completo' : (previsa || temBalanco) ? 'parcial' : 'modelo';
    default:
      // Inalcançável com o union atual; protege contra um DocTypeId novo
      // adicionado sem atualizar este switch.
      return 'modelo';
  }
}

// ─── Download (.doc) ──────────────────────────────────────────────────────────

/**
 * Versão do documento para pré-visualização editável dentro de um iframe: o
 * `<body>` fica `contenteditable` para o utilizador corrigir qualquer texto
 * antes de descarregar. A classe `editing` adiciona a margem A4 só no ecrã.
 */
export function makeEditableHtml(html: string): string {
  return html.replace(
    '<body>',
    '<body class="editing" contenteditable="true" spellcheck="false">',
  );
}

/**
 * Reconstrói o HTML final (para download/Word) a partir do documento já editado
 * dentro do iframe, removendo os atributos de edição e a classe de ecrã.
 */
export function serializeEditedDoc(doc: Document): string {
  const root = doc.documentElement.cloneNode(true) as HTMLElement;
  root.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  root.querySelectorAll('[spellcheck]').forEach(el => el.removeAttribute('spellcheck'));
  const body = root.querySelector('body');
  if (body) body.classList.remove('editing');
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
    + root.innerHTML + '</html>';
}

/** Embrulha o HTML como .doc e dispara o download. BOM + charset garantem acentos. */
export function downloadAsWord(html: string, filename: string): void {
  const blob = new Blob(['﻿', html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
