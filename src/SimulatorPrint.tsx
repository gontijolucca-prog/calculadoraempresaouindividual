import React, { createContext, useContext } from 'react';
import { Printer } from 'lucide-react';
import { printHtmlViaPaged } from './lib/printPaged';
import { detailSimulacao, type SimView } from './lib/simSummary';
import { resultSimulacao } from './lib/simResults';
import { calcViatura } from './lib/viaturas';
import { calcIMT, type TipoImovel, type Localizacao } from './lib/imt';
import type { ClientProfile } from './ClientProfile';
import type { OfficeSettings } from './lib/officeSettings';

export interface SimulatorPrintContextValue {
  view: SimView | null;
  state: unknown;
  profile: ClientProfile;
  office: OfficeSettings;
}

const PrintContext = createContext<SimulatorPrintContextValue | null>(null);

export function SimulatorPrintProvider({ value, children }: { value: SimulatorPrintContextValue; children: React.ReactNode }) {
  return <PrintContext.Provider value={value}>{children}</PrintContext.Provider>;
}

const PRINT_TITLES: Record<SimView, string> = {
  tax: 'Simulação Fiscal — ENI vs Sociedade',
  vehicle: 'Simulação de Viaturas',
  ticket: 'Simulação de Tickets e Benefícios',
  selfss: 'Simulação de Segurança Social — Independente',
  diagnostico: 'Diagnóstico de Gestão e Autonomia',
  imoveis: 'Simulação de Imóveis na Empresa',
  imt: 'Simulação de IMT e Imposto do Selo',
  salario: 'Simulação de Salário Líquido',
  irs: 'Simulação de IRS — Modelo 3',
  previsa: 'Simulação Previsa — IRC Modelo 22',
};

const num = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const eur = (value: number): string => new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number.isFinite(value) ? value : 0);
const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
const esc = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

function diagnosticScores(s: any): number[] {
  const autonomia = num(s.ativoTotal) > 0 ? num(s.capitaisProprios) / num(s.ativoTotal) : 0;
  const endividamento = num(s.ativoTotal) > 0 ? num(s.passivoTotal) / num(s.ativoTotal) : 0;
  const p1 = ((autonomia >= 0.40 ? 5 : autonomia >= 0.25 ? 3 : 1) + (endividamento <= 0.50 ? 5 : endividamento <= 0.75 ? 3 : 1)) / 2;
  const liquidez = num(s.passivoCorrente) > 0 ? num(s.ativoCorrente) / num(s.passivoCorrente) : 5;
  const meses = num(s.custoFixoMensal) > 0 ? num(s.disponibilidades) / num(s.custoFixoMensal) : Infinity;
  const p2 = ((liquidez >= 1.5 ? 5 : liquidez >= 1 ? 3 : 1) + (meses >= 6 ? 5 : meses >= 3 ? 3 : 1)) / 2;
  const margem = num(s.volumeNegocios) > 0 ? num(s.resultadoLiquido) / num(s.volumeNegocios) : 0;
  const p3 = ((margem >= 0.15 ? 5 : margem >= 0.05 ? 3 : 1) + (s.ebitda === 'positivo' ? 5 : s.ebitda === 'marginal' ? 3 : 1)) / 2;
  const concentracao = num(s.volumeNegocios) > 0 ? num(s.faturacaoMaiorCliente) / num(s.volumeNegocios) : 0;
  const depFinanc = num(s.totalFinanciamento) > 0 ? num(s.financiamentoExterno) / num(s.totalFinanciamento) : 0;
  const p4 = ((concentracao <= 0.20 ? 5 : concentracao <= 0.40 ? 3 : 1) + (depFinanc <= 0.30 ? 5 : depFinanc <= 0.60 ? 3 : 1)) / 2;
  const p5 = [s.processosDefinidos, s.softwareGestao, s.equipaAutonoma, s.baixaDependenciaGerente, s.controlFinanceiro].filter(Boolean).length;
  return [p1, p2, p3, p4, p5];
}

function extraInputs(view: SimView, state: unknown): { label: string; valor: string }[] {
  const s = state as any;
  if (view === 'diagnostico') {
    return [
      { label: 'Capitais próprios', valor: eur(num(s.capitaisProprios)) },
      { label: 'Ativo total', valor: eur(num(s.ativoTotal)) },
      { label: 'Passivo total', valor: eur(num(s.passivoTotal)) },
      { label: 'Resultado líquido', valor: eur(num(s.resultadoLiquido)) },
      { label: 'EBITDA', valor: String(s.ebitda || '—') },
    ].filter((item) => item.valor !== eur(0) && item.valor !== '—');
  }
  return [];
}

function extraResults(view: SimView, state: unknown, profile: ClientProfile): { label: string; valor: string }[] {
  const s = state as any;
  try {
    if (view === 'vehicle' && (num(s.price) > 0 || num(s.maintenanceCost) > 0 || num(s.fuelCost) > 0)) {
      const r = calcViatura({
        category: s.category === 'comercial' ? 'comercial' : 'passageiros',
        engineType: String(s.engineType || 'diesel'), price: num(s.price),
        ivaRegime: String(s.ivaRegime || 'normal'), activity: String(s.activity || 'other'),
        maintenanceCost: num(s.maintenanceCost), insuranceCost: num(s.insuranceCost), fuelCost: num(s.fuelCost),
        exemptTA: !!s.exemptTA, phevCompliant: !!s.phevCompliant, agravamentoTA: !!s.agravamentoTA,
      });
      return [
        { label: 'IVA total dedutível', valor: eur(r.ivaTotalDedutivel) },
        { label: 'Taxa de Tributação Autónoma', valor: pct(r.taRate) },
        { label: 'Tributação Autónoma estimada', valor: eur(r.taValue) },
        { label: 'Depreciação não aceite', valor: eur(r.depNaoAceite) },
      ];
    }
    if (view === 'diagnostico') {
      const labels = ['Autonomia financeira', 'Tesouraria', 'Rentabilidade', 'Dependência', 'Operacional'];
      const scores = diagnosticScores(s);
      return [
        { label: 'Score global', valor: `${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)} / 5` },
        ...scores.map((score, index) => ({ label: labels[index], valor: `${score.toFixed(1)} / 5` })),
      ];
    }
    if (view === 'imoveis' && num(s.valorImovel) > 0) {
      const imt = calcIMT(num(s.valorImovel), 'urbano_outros', 'continente', false, 99);
      const impostoSelo = num(s.valorImovel) * 0.008;
      const escritura = num(s.valorImovel) * 0.007;
      const custoEspecies = impostoSelo + imt.imt + escritura;
      const renda = num(s.valorImovel) * 0.04;
      const scoreArr = 3 + (s.horizonteInvestimento === 'curto' ? 2 : 0) + (s.precisaLiquidezMensal ? 2 : 0) + (s.precisaReforcoCE ? -1 : 0) + (s.tipoAtividade === 'turismo' || s.tipoAtividade === 'alojamento_local' ? 1 : 0) + (profile.tipoEntidade === 'eni' ? -1 : 0);
      const scoreEsp = 3 + (s.horizonteInvestimento === 'curto' ? -2 : 0) + (s.precisaLiquidezMensal ? -1 : 0) + (s.precisaReforcoCE ? 2 : 0) + (num(s.valorImovel) > 500000 ? 1 : 0) + (profile.tipoEntidade === 'eni' ? -1 : 0);
      return [
        { label: 'Recomendação', valor: scoreArr > scoreEsp ? 'Arrendamento / Comodato' : scoreEsp > scoreArr ? 'Entrada em espécie' : 'Análise neutra' },
        { label: 'Custo inicial — entrada em espécie', valor: eur(custoEspecies) },
        { label: 'Renda anual estimada', valor: eur(renda) },
        { label: 'Depreciação fiscal anual', valor: eur(num(s.valorImovel) * 0.02) },
      ];
    }
    if (view === 'imt' && num(s.valor) > 0) {
      const r = calcIMT(num(s.valor), (s.tipo || 'hpp') as TipoImovel, (s.localizacao || 'continente') as Localizacao, !!s.primeiraHabitacao, num(s.idadeComprador));
      return [
        { label: 'IMT', valor: eur(r.imt) },
        { label: 'Imposto de Selo', valor: eur(r.impostoSelo) },
        { label: 'Total de impostos', valor: eur(r.total) },
        { label: 'Taxa aplicada', valor: pct(r.taxaAplicada) },
        { label: 'Benefício IMT Jovem', valor: r.isentoJovem ? (r.isento ? 'Isenção total' : 'Redução parcial') : 'Não aplicável' },
      ];
    }
  } catch {
    return [];
  }
  return [];
}

function rowsHtml(rows: { label: string; valor: string }[]): string {
  if (!rows.length) return '<p class="empty">Não foram introduzidos dados suficientes para apresentar valores calculados.</p>';
  return `<div class="rows">${rows.map((row) => `<div class="row"><span>${esc(row.label)}</span><strong>${esc(row.valor)}</strong></div>`).join('')}</div>`;
}

function buildReport(ctx: SimulatorPrintContextValue): string {
  if (!ctx.view) return '';
  const title = PRINT_TITLES[ctx.view];
  const profile = ctx.profile || ({} as ClientProfile);
  const office = ctx.office || ({} as OfficeSettings);
  const inputRows = [...detailSimulacao(ctx.view, ctx.state), ...extraInputs(ctx.view, ctx.state)];
  const resultRows = [...resultSimulacao(ctx.view, ctx.state, profile), ...extraResults(ctx.view, ctx.state, profile)];
  const officeName = office.nome?.trim() || 'Estudo 360';
  const clientName = profile.nomeCliente?.trim() || 'Cliente não identificado';
  const clientNif = profile.nif?.trim() || '—';
  const date = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' }).format(new Date());
  const color = /^#[0-9A-Fa-f]{6}$/.test(office.corPrimaria || '') ? office.corPrimaria : '#0677FF';
  const logo = office.logoDataUrl
    ? `<img class="logo" src="${esc(office.logoDataUrl)}" alt="${esc(officeName)}">`
    : `<div class="logo-fallback" style="background:${esc(color)}">360</div>`;
  const legal = 'Cálculos indicativos — confirme os valores e o enquadramento com o seu Contabilista Certificado.';

  return `
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #0B1D2D; font-family: Montserrat, Arial, sans-serif; font-size: 10pt; line-height: 1.45; }
  .sim-report { max-width: 180mm; margin: 0 auto; }
  .report-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16mm; padding: 0 0 8mm; border-bottom: 2px solid ${esc(color)}; }
  .brand { display:flex; align-items:center; gap:4mm; min-width:0; }
  .logo { max-width: 42mm; max-height: 18mm; object-fit: contain; object-position:left center; }
  .logo-fallback { width: 18mm; height: 18mm; border-radius: 5mm; color:#fff; display:flex; align-items:center; justify-content:center; font-size:16pt; font-weight:800; }
  .office { font-size:8pt; color:#64748B; margin-top:1mm; }
  .doc-meta { text-align:right; color:#64748B; font-size:8pt; white-space:nowrap; }
  .kicker { color:${esc(color)}; font-size:8pt; font-weight:800; letter-spacing:1.4px; text-transform:uppercase; margin: 9mm 0 1.5mm; }
  h1 { font-size: 22pt; line-height:1.12; letter-spacing:-.4px; margin:0; }
  .subtitle { margin:2mm 0 7mm; color:#64748B; font-size:10pt; }
  .client-box { display:grid; grid-template-columns: 1fr 42mm; gap:6mm; background:#F5F7FA; border:1px solid #E2E8F0; border-radius:4mm; padding:4mm 5mm; margin-bottom:8mm; }
  .meta-label { color:#64748B; font-size:7.5pt; font-weight:800; letter-spacing:.7px; text-transform:uppercase; }
  .meta-value { margin-top:1mm; font-size:10.5pt; font-weight:700; }
  .section { break-inside:avoid; page-break-inside:avoid; margin: 0 0 7mm; }
  .section-title { display:flex; align-items:center; gap:2mm; color:${esc(color)}; font-size:9pt; font-weight:800; letter-spacing:1px; text-transform:uppercase; border-bottom:1px solid #DCE7F2; padding-bottom:2mm; margin-bottom:3mm; }
  .section-title:before { content:''; width:3mm; height:3mm; border-radius:50%; background:${esc(color)}; }
  .rows { border:1px solid #E2E8F0; border-radius:3mm; overflow:hidden; }
  .row { display:flex; justify-content:space-between; align-items:baseline; gap:8mm; padding:2.8mm 4mm; border-bottom:1px solid #EEF2F7; }
  .row:last-child { border-bottom:0; }
  .row:nth-child(even) { background:#FAFCFE; }
  .row span { color:#475569; min-width:0; }
  .row strong { text-align:right; color:#0F172A; font-weight:700; white-space:nowrap; }
  .result-box { border:2px solid ${esc(color)}; border-radius:4mm; padding:5mm; background:linear-gradient(135deg, #F5FAFF, #fff); }
  .result-box .row strong { color:${esc(color)}; font-size:10.5pt; }
  .result-box .row:first-child { background:${esc(color)}; color:#fff; border-radius:2mm; margin:-1mm -1mm 2mm; padding:3.5mm 4mm; }
  .result-box .row:first-child span, .result-box .row:first-child strong { color:#fff; }
  .empty { color:#64748B; background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:3mm; padding:5mm; margin:0; }
  .note { border-left:3px solid #F59E0B; background:#FFFBEB; color:#92400E; padding:3.5mm 4mm; border-radius:0 3mm 3mm 0; font-size:8.5pt; break-inside:avoid; }
  .report-foot { margin-top:12mm; padding-top:4mm; border-top:1px solid #E2E8F0; color:#64748B; font-size:7.5pt; display:flex; justify-content:space-between; gap:8mm; }
  @media (max-width: 700px) { .report-head { gap:5mm; } .client-box { grid-template-columns:1fr; } .doc-meta { text-align:left; } h1 { font-size:19pt; } }
</style>
<article class="sim-report">
  <header class="report-head">
    <div class="brand">${logo}<div><strong>${esc(officeName)}</strong><div class="office">Estudo 360 · Análise · Estratégia · Decisão</div></div></div>
    <div class="doc-meta">RELATÓRIO DE SIMULAÇÃO<br>${esc(date)}</div>
  </header>
  <div class="kicker">Estudo 360</div>
  <h1>${esc(title)}</h1>
  <p class="subtitle">Relatório resumido da simulação efetuada na plataforma Estudo 360.</p>
  <div class="client-box">
    <div><div class="meta-label">Cliente / Empresa</div><div class="meta-value">${esc(clientName)}</div></div>
    <div><div class="meta-label">NIF</div><div class="meta-value">${esc(clientNif)}</div></div>
  </div>
  <section class="section">
    <div class="section-title">Parâmetros da simulação</div>
    ${rowsHtml(inputRows)}
  </section>
  <section class="section">
    <div class="section-title">Resultado da simulação</div>
    <div class="result-box">${rowsHtml(resultRows)}</div>
  </section>
  <div class="note">${esc(legal)}</div>
  <footer class="report-foot"><span>${esc(officeName)}</span><span>Estudo 360 · ${esc(title)}</span></footer>
</article>`;
}

export function SimulatorPrintButton({ compact = false }: { compact?: boolean }) {
  const ctx = useContext(PrintContext);
  if (!ctx?.view) return null;
  const onPrint = () => {
    printHtmlViaPaged(buildReport(ctx), {
      title: PRINT_TITLES[ctx.view],
      footerLeft: ctx.office.nome?.trim() || 'Estudo 360',
      footerRight: 'Estudo 360 · Simulação',
    });
  };
  return (
    <button
      type="button"
      onClick={onPrint}
      title="Imprimir esta simulação em A4 / Guardar PDF"
      aria-label="Imprimir simulação em A4"
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[9px] border border-[#D7E2EE] bg-white px-3 py-2.5 text-[12px] font-[700] text-[#475569] transition-colors hover:border-[var(--brand-bordeaux-neon)] hover:bg-[var(--brand-bordeaux-soft)] hover:text-[var(--brand-bordeaux)] ${compact ? 'sm:px-2.5' : ''}`}
    >
      <Printer className="h-4 w-4 text-[#0677FF]" />
      <span className="hidden sm:inline">Imprimir A4</span>
    </button>
  );
}
