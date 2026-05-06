import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';
import type { ClientProfile } from './ClientProfile';
import {
  calculateIRS, calcIRSJovem, calcDependentsDeduction,
  calcTicketSavings, calcSelfSSContribution, calculateIRC,
} from './lib/pt2026';

interface TaxSimulatorState {
  profSit: string; currentInc: number; age: number; isMainAct: boolean;
  monthlyNeed: number; isServices: boolean; b2b: boolean; rev: number;
  isSeasonal: boolean; invEquip: number; invLic: number; invWorks: number;
  invFundo: number; fixedMo: number; varYr: number; accMoLda: number;
  accMoEni: number; anosAtividade: number;
}
interface VehicleSimulatorState {
  category: 'comercial' | 'passageiros'; engineType: string; price: number;
  ivaRegime: string; activity: string; maintenanceCost: number;
  insuranceCost: number; fuelCost: number; exemptTA: boolean; phevCompliant: boolean;
}
interface TicketSimulatorState {
  employees: number; ticketValue: number; daysPerMonth: number; months: number;
}
interface SSState {
  income: number; regime: 'general' | 'simplified';
  tipoRendimento: 'servicos' | 'bens'; primeiroAno: boolean;
}

interface Props {
  profile: ClientProfile;
  taxState?: TaxSimulatorState;
  vehicleState?: VehicleSimulatorState;
  ticketState?: TicketSimulatorState;
  ssState?: SSState;
  onClose: () => void;
}

const ptEur = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.max(0, v));

// Editable span — user can click and type. Renders value as text (React escapes it),
// avoiding the XSS risk of dangerouslySetInnerHTML even with profile-derived content.
const E = ({ v, block, bold, size, color }: {
  v: string | number; block?: boolean; bold?: boolean;
  size?: string; color?: string;
}) => {
  const Tag = block ? 'div' : 'span';
  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      style={{
        outline: 'none', cursor: 'text', display: block ? 'block' : 'inline',
        fontWeight: bold ? 700 : undefined,
        fontSize: size ?? undefined,
        color: color ?? undefined,
      }}
    >{String(v)}</Tag>
  );
};

// Two-value data row (label left, value right), both editable
const DR = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', padding: '3px 8px', borderBottom: '1px solid #f1f5f9', fontSize: '8.5pt', gap: 4, alignItems: 'baseline' }}>
    <span style={{ color: '#64748b', fontWeight: 600, minWidth: 100, flexShrink: 0 }}>{label}</span>
    <span
      contentEditable
      suppressContentEditableWarning
      style={{ fontWeight: 500, color: '#0f172a', flex: 1, outline: 'none', cursor: 'text' }}
    >{value}</span>
  </div>
);

// Four-value row (2 cols side by side)
const DR2 = ({ l1, v1, l2, v2 }: { l1: string; v1: string; l2: string; v2: string }) => (
  <div style={{ display: 'flex', padding: '3px 8px', borderBottom: '1px solid #f1f5f9', fontSize: '8.5pt', gap: 4 }}>
    <span style={{ color: '#64748b', fontWeight: 600, width: '20%', flexShrink: 0 }}>{l1}</span>
    <span
      contentEditable suppressContentEditableWarning
      style={{ fontWeight: 500, color: '#0f172a', width: '27%', flexShrink: 0, outline: 'none', cursor: 'text' }}
    >{v1}</span>
    <span style={{ color: '#64748b', fontWeight: 600, width: '20%', flexShrink: 0 }}>{l2}</span>
    <span
      contentEditable suppressContentEditableWarning
      style={{ fontWeight: 500, color: '#0f172a', flex: 1, outline: 'none', cursor: 'text' }}
    >{v2}</span>
  </div>
);

const SecHead = ({ title, bg = '#781D1D' }: { title: string; bg?: string }) => (
  <div style={{ background: bg, color: 'white', padding: '4px 8px', fontSize: '8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 10 }}>
    <span contentEditable suppressContentEditableWarning style={{ outline: 'none', cursor: 'text' }}>{title}</span>
  </div>
);

const PageHeader = ({ title, pageNum }: { title: string; pageNum: number }) => (
  <div style={{ background: '#781D1D', color: 'white', padding: '4px 14mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '8pt' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ background: 'white', borderRadius: 3, padding: '2px 3px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 18 }}>
        <svg viewBox="0 0 100 80" style={{ width: '100%', height: '100%' }} fill="none" aria-hidden="true" focusable="false">
          <path d="M 45 10 A 30 30 0 0 0 45 70" stroke="#333333" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 30 45 L 42 58 L 65 25" stroke="#781D1D" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: '7.5pt' }}>RECOFATIMA</div>
        <div style={{ fontSize: '6pt', opacity: 0.8 }}>Contabilidade</div>
      </div>
    </div>
    <span contentEditable suppressContentEditableWarning
      style={{ outline: 'none', cursor: 'text', fontWeight: 600 }}>{title}</span>
    <span style={{ opacity: 0.8 }}>Pág. {pageNum}</span>
  </div>
);

const PageFooter = () => (
  <div style={{ background: '#781D1D', color: 'white', padding: '4px 14mm', fontSize: '6.5pt', textAlign: 'center', marginTop: 'auto' }}>
    <span contentEditable suppressContentEditableWarning
      style={{ outline: 'none', cursor: 'text' }}
    >Dados atualizados conforme OE 2026 • Este relatório é uma estimativa. Consulte o seu contabilista certificado.</span>
  </div>
);

const MetricCard = ({ label, value, bg, color }: { label: string; value: string; bg: string; color: string }) => (
  <div style={{ flex: 1, background: bg, borderRadius: 4, padding: '6px 8px' }}>
    <div style={{ fontSize: '6.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
    <div contentEditable suppressContentEditableWarning
      style={{ fontSize: '12pt', fontWeight: 800, color, outline: 'none', cursor: 'text' }}>{value}</div>
  </div>
);

const pageStyle: React.CSSProperties = {
  width: '210mm', minHeight: '297mm', background: 'white',
  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  margin: '0 auto 24px auto', display: 'flex', flexDirection: 'column',
  fontFamily: 'Arial, Helvetica, sans-serif', boxSizing: 'border-box',
  pageBreakAfter: 'always', breakAfter: 'page',
};

export default function PDFPreviewEditor({ profile, taxState, vehicleState, ticketState, ssState, onClose }: Props) {

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'pdf-print-css';
    style.textContent = `
      @media print {
        body { visibility: hidden; }
        #pdf-editor-root { visibility: visible; position: fixed; top: 0; left: 0; width: 100%; background: white; overflow: visible; z-index: 99999; }
        #pdf-editor-root * { visibility: visible; }
        .no-print { display: none !important; }
        .pdf-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; break-after: page; }
        .pdf-page:last-child { page-break-after: avoid; break-after: avoid; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        [contenteditable] { outline: none !important; }
        @page { size: A4; margin: 0; }
      }
    `;
    document.head.appendChild(style);
    return () => document.getElementById('pdf-print-css')?.remove();
  }, []);

  // ─── Financial computations ───────────────────────────────────────────────
  const today = new Date();
  const dateStr = today.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });

  let taxR: {
    eniNet: number; ldaNet: number; eniIRS: number; eniSS: number; costsEni: number;
    costsLda: number; eniCashFlow: number; ldaCashFlow: number; irc: number;
    ldaSSComp: number; ldaSSMgr: number; ldaProfit: number; ppc: number;
    winner: 'ENI' | 'LDA'; diff: number; irsJovemDeduction: number; depsDeduction: number;
    beEni: number; beLda: number;
  } | null = null;

  if (taxState) {
    const totalInv = taxState.invEquip + taxState.invLic + taxState.invWorks + taxState.invFundo;
    const invCapex = taxState.invEquip + taxState.invLic + taxState.invWorks;
    const fixedYr = taxState.fixedMo * 12;
    const accYrLda = taxState.accMoLda * 12;
    const accYrEni = taxState.accMoEni * 12;
    const costsEni = fixedYr + taxState.varYr + accYrEni;
    const costsLda = fixedYr + taxState.varYr + accYrLda;
    const dpNaoAceite = invCapex * 0.25;

    let eniSS = 0;
    if (!(taxState.profSit === 'tco' && !taxState.isMainAct && taxState.rev <= 20000)) {
      eniSS = taxState.rev * (taxState.isServices ? 0.70 : 0.20) * 0.214;
    }
    let eniRC = taxState.rev * (taxState.isServices ? 0.75 : 0.15);
    if (taxState.isServices && taxState.rev > 27360) {
      const rj = taxState.rev * 0.15;
      const jd = costsEni + 4104;
      if (jd < rj) eniRC += rj - jd;
    }
    let irsJovemDeduction = 0;
    if (profile.beneficioJovem && profile.idade <= 35) {
      irsJovemDeduction = calcIRSJovem(taxState.anosAtividade || 0, eniRC, profile.idade);
      eniRC = Math.max(0, eniRC - irsJovemDeduction);
    }
    const depsDeduction = calcDependentsDeduction(profile.nrDependentes);
    const eniIRS = Math.max(0, calculateIRS(taxState.currentInc + eniRC) - calculateIRS(taxState.currentInc) - depsDeduction);
    const eniNet = taxState.rev - costsEni - eniSS - eniIRS;
    const eniCashFlow = eniNet - totalInv;
    const ppc = eniIRS * 0.25;

    const rawGross = taxState.monthlyNeed / 0.70;
    const grossSalaryYr = rawGross * 14;
    const ldaSSComp = grossSalaryYr * 0.2375;
    const ldaSSMgr = grossSalaryYr * 0.11;
    const profit = taxState.rev - costsLda - dpNaoAceite - grossSalaryYr - ldaSSComp;
    const irc = calculateIRC(profit);
    const companyNet = profit - irc;
    const ldaNet = companyNet + taxState.monthlyNeed * 12;
    const ldaCashFlow = (companyNet + dpNaoAceite) - totalInv;
    const winner = ldaNet > eniNet ? 'LDA' : 'ENI';
    const diff = Math.abs(ldaNet - eniNet);

    const varMargin = taxState.rev > 0 ? (taxState.rev - taxState.varYr) / taxState.rev : 0.01;
    const beEni = varMargin > 0 ? (fixedYr + accYrEni) / varMargin : 0;
    const beLda = varMargin > 0 ? (fixedYr + accYrLda + grossSalaryYr + ldaSSComp) / varMargin : 0;

    taxR = { eniNet, ldaNet, eniIRS, eniSS, costsEni, costsLda, eniCashFlow, ldaCashFlow, irc, ldaSSComp, ldaSSMgr, ldaProfit: companyNet, ppc, winner, diff, irsJovemDeduction, depsDeduction, beEni, beLda };
  }

  // ─── Vehicle computations ─────────────────────────────────────────────────
  let vehR: { ivaTotalDed: number; ivaAqDed: number; maintIvaDed: number; fuelIvaDed: number; taValue: number; taRate: number; depNaoAceite: number; totalEncsTA: number; limit: number; totalIvaAq: number; ivaAqRate: number } | null = null;
  if (vehicleState) {
    const maintIva = vehicleState.maintenanceCost - vehicleState.maintenanceCost / 1.23;
    const fuelIva = vehicleState.fuelCost - vehicleState.fuelCost / 1.23;
    const isEx = ['public_transport', 'rent_a_car', 'driving_school'].includes(vehicleState.activity);
    let ivaAqRate = 0;
    const totalIvaAq = vehicleState.price * 0.23;
    if (vehicleState.ivaRegime === 'normal') {
      if (isEx) ivaAqRate = 1;
      else if (vehicleState.category === 'passageiros') {
        if (vehicleState.engineType === 'electric') ivaAqRate = vehicleState.price <= 62500 ? 1 : 0;
        else if (vehicleState.engineType === 'phev' && vehicleState.phevCompliant) ivaAqRate = vehicleState.price <= 50000 ? 1 : 0;
        else if (['lpg', 'cng'].includes(vehicleState.engineType)) ivaAqRate = vehicleState.price <= 37500 ? 0.5 : 0;
      } else if (vehicleState.category === 'comercial') {
        ivaAqRate = ['electric', 'phev', 'lpg', 'cng'].includes(vehicleState.engineType) ? 1 : 0.5;
      }
    }
    const ivaAqDed = totalIvaAq * ivaAqRate;
    const maintIvaDed = (isEx || vehicleState.category === 'comercial') ? maintIva : 0;
    let fuelIvaRate = 0;
    if (isEx || vehicleState.engineType === 'electric') fuelIvaRate = 1;
    else if (['diesel', 'lpg', 'cng'].includes(vehicleState.engineType)) fuelIvaRate = 0.5;
    const fuelIvaDed = fuelIva * fuelIvaRate;
    const ivaTotalDed = ivaAqDed + maintIvaDed + fuelIvaDed;
    const depAnual = vehicleState.price * 0.25;
    let limit = 25000;
    if (vehicleState.engineType === 'electric') limit = 62500;
    else if (vehicleState.engineType === 'phev' && vehicleState.phevCompliant) limit = 50000;
    else if (['lpg', 'cng'].includes(vehicleState.engineType)) limit = 37500;
    if (isEx) limit = Infinity;
    const depAceite = limit === Infinity ? depAnual : Math.min(vehicleState.price, limit) * 0.25;
    const depNaoAceite = Math.max(0, depAnual - depAceite);
    const totalEncsTA = depAnual + (vehicleState.maintenanceCost - maintIvaDed) + vehicleState.insuranceCost + (vehicleState.fuelCost - fuelIvaDed);
    let taRate = 0;
    if (vehicleState.category === 'passageiros' && !vehicleState.exemptTA) {
      if (vehicleState.engineType === 'electric') taRate = vehicleState.price >= 62500 ? 0.10 : 0;
      else if (vehicleState.engineType === 'phev' && vehicleState.phevCompliant)
        taRate = vehicleState.price < 27500 ? 0.025 : vehicleState.price < 35000 ? 0.075 : 0.15;
      else taRate = vehicleState.price < 27500 ? 0.085 : vehicleState.price < 35000 ? 0.255 : 0.325;
    }
    const taValue = totalEncsTA * taRate;
    vehR = { ivaTotalDed, ivaAqDed, maintIvaDed, fuelIvaDed, taValue, taRate, depNaoAceite, totalEncsTA, limit, totalIvaAq, ivaAqRate };
  }

  // ─── Ticket computations ──────────────────────────────────────────────────
  let tickR: { savings: number; ticketCost: number; custoDedutivelEmpresa: number } | null = null;
  if (ticketState && ticketState.employees > 0 && ticketState.ticketValue > 0) {
    tickR = calcTicketSavings(ticketState.employees, ticketState.ticketValue, ticketState.daysPerMonth, ticketState.months);
  }

  // ─── SS computations ──────────────────────────────────────────────────────
  const ssR = ssState && ssState.income > 0 ? calcSelfSSContribution(ssState.income, ssState.tipoRendimento, ssState.primeiroAno) : null;

  const legalItems = [
    ['IRS — Escalões 2026', 'CIRS Art. 68º — Taxas de 13% a 48% (OE 2026)'],
    ['IRS Jovem', 'CIRS Art. 12º-B — Isenção progressiva ≤35 anos nos primeiros 5 anos'],
    ['Ded. Dependentes', 'CIRS Art. 78º-A — €600/dependente (€900 a partir do 4.º)'],
    ['Regime Simplificado ENI', 'CIRS Art. 31º — Coeficientes: 75% serviços / 15% bens'],
    ['IRC — PME', 'CIRC Art. 87º — Taxa 15% (primeiros €50k) / 19% restante'],
    ['TSU Patronal', 'Lei 110/2009 — 23,75% (empresa) + 11% (trabalhador)'],
    ['SS Independente', 'CRCSPSS Art. 162º — Taxa 21,4% sobre 70% (serviços) / 20% (bens)'],
    ['SS — Isenção 1º ano', 'CRCSPSS Art. 164º — Isenção de 12 meses no início de atividade'],
    ['IVA Normal', 'CIVA — Taxa standard 23% (Portugal Continental)'],
    ['IVA Isenção PME', 'CIVA Art. 53º — Isenção p/ faturação <€15.000 exclusivamente B2C'],
    ['IVA Viaturas', 'CIVA Art. 21º, n.º 1 — Dedução 100%/50%/0% conforme motor'],
    ['Tributação Autónoma', 'CIRC Art. 88º, n.º 3 — TA escalonada p/ viaturas passageiros'],
    ['TA Viaturas Elétricas', 'Lei n.º 82/2023 — TA 10% p/ elétricos com custo >€62.500'],
    ['Tickets de Refeição', 'DL 133/2024 — Limite €5/dia (geral) ou €7/dia (hotelaria/construção)'],
    ['Tickets — Dedutibilidade', 'CIRC Art. 43º — 60% do custo total dedutível para a empresa'],
    ['Tickets — SS e IRS', 'EBF Art. 18º-A — Isenção SS e IRS para o trabalhador (até ao limite)'],
  ];

  return (
    <div id="pdf-editor-root" style={{ position: 'fixed', inset: 0, background: '#e2e8f0', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>

      {/* ── Toolbar ── */}
      <div className="no-print" style={{ background: '#0f172a', color: 'white', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>Editor de Relatório</span>
          <span style={{ fontSize: 12, color: '#64748b', background: '#1e293b', padding: '3px 10px', borderRadius: 6 }}>
            Clique em qualquer texto para editar
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.print()}
            style={{ background: '#781D1D', color: 'white', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}
          >
            <Download size={15} /> Download PDF
          </button>
          <button
            onClick={onClose}
            style={{ background: '#1e293b', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}
          >
            <X size={15} /> Fechar
          </button>
        </div>
      </div>

      {/* ── Print tip ── */}
      <div className="no-print" style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '6px 24px', fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>💡</span>
        <span>Ao clicar <strong>Download PDF</strong>, selecione <strong>"Guardar como PDF"</strong> na janela de impressão do browser. Certifique-se de desativar cabeçalhos/rodapés de browser nas opções avançadas.</span>
      </div>

      {/* ── Scrollable pages ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>

        {/* ════ PÁGINA 1 — CAPA + DADOS CLIENTE ════ */}
        <div className="pdf-page" style={pageStyle}>

          {/* Cover header */}
          <div style={{ background: '#781D1D', color: 'white', padding: '14mm 14mm 10mm 14mm', display: 'flex', alignItems: 'center', gap: '10mm' }}>
            <div style={{ background: 'white', borderRadius: 5, padding: '4px 4px 2px 4px', flexShrink: 0 }}>
              <svg viewBox="0 0 100 80" style={{ width: 44, height: 36, display: 'block' }} fill="none">
                <path d="M 45 10 A 30 30 0 0 0 45 70" stroke="#333333" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 30 45 L 42 58 L 65 25" stroke="#781D1D" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div contentEditable suppressContentEditableWarning
                style={{ fontSize: '22pt', fontWeight: 800, outline: 'none', cursor: 'text', lineHeight: 1.1 }}>RECOFATIMA</div>
              <div contentEditable suppressContentEditableWarning
                style={{ fontSize: '10pt', outline: 'none', cursor: 'text', marginTop: 3 }}>Contabilidade & Consultoria Fiscal</div>
              <div contentEditable suppressContentEditableWarning
                style={{ fontSize: '8pt', outline: 'none', cursor: 'text', marginTop: 3, opacity: 0.85 }}>Relatório de Simulação Fiscal • OE 2026</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div contentEditable suppressContentEditableWarning
                style={{ fontWeight: 700, fontSize: '9pt', outline: 'none', cursor: 'text' }}>{dateStr}</div>
              <div contentEditable suppressContentEditableWarning
                style={{ fontSize: '8pt', outline: 'none', cursor: 'text', marginTop: 3, opacity: 0.8 }}>{`REF: ${profile.nif || 'N/D'}-${today.getFullYear()}`}</div>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '5mm 14mm 8mm 14mm', flex: 1 }}>

            <SecHead title="Dados do Cliente" />
            <div style={{ background: '#f8fafc' }}>
              <DR2 l1="Nome / Empresa:" v1={profile.nomeCliente || '—'} l2="NIF:" v2={profile.nif || '—'} />
              <DR2 l1="Email:" v1={profile.email || '—'} l2="Telefone:" v2={profile.telefone || '—'} />
              {profile.morada && <DR label="Morada:" value={`${profile.morada}${profile.codigoPostal ? ', ' + profile.codigoPostal : ''}${profile.localidade ? ' ' + profile.localidade : ''}`} />}
              <DR2 l1="Tipo Entidade:" v1={profile.tipoEntidade.toUpperCase()} l2="CAE:" v2={profile.cae || '—'} />
              <DR2 l1="Início Atividade:" v1={profile.inicioAtividade.toString()} l2="Regime IVA:" v2={profile.regimeIva === 'isento' ? 'Isento (Art. 53º)' : profile.regimeIva === 'normal_mensal' ? 'Normal Mensal' : 'Normal Trimestral'} />
              <DR2 l1="Tipo Atividade:" v1={profile.atividadePrincipal === 'servicos' ? 'Prestação de Serviços' : 'Venda de Bens'} l2="Faturação Anual:" v2={ptEur(profile.faturaçaoAnualPrevista)} />
            </div>

            <SecHead title="Dados Pessoais e Familiares" bg="#334155" />
            <div style={{ background: '#f8fafc' }}>
              <DR2 l1="Idade:" v1={`${profile.idade} anos`} l2="Estado Civil:" v2={profile.estadoCivil.replace('_', ' ')} />
              <DR2 l1="Dependentes:" v1={`${profile.nrDependentes}`} l2="Cônjuge c/ Rendimentos:" v2={profile.cônjugeRendimentos ? 'Sim' : 'Não'} />
              <DR2 l1="Benefício Jovem IRS:" v1={profile.beneficioJovem ? 'Sim (≤35 anos)' : 'Não aplicável'} l2="Atividade Sazonal:" v2={profile.isSazonal ? 'Sim' : 'Não'} />
            </div>

            {taxR && (
              <>
                <SecHead title="Resumo Executivo — Recomendação" bg={taxR.winner === 'LDA' ? '#781D1D' : '#059669'} />
                <div style={{ background: taxR.winner === 'LDA' ? '#fdf2f2' : '#ecfdf5', padding: '8px', marginBottom: 8 }}>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontSize: '12pt', fontWeight: 800, color: taxR.winner === 'LDA' ? '#781D1D' : '#059669', outline: 'none', cursor: 'text', marginBottom: 4 }}
                  >{`Regime Ideal: ${taxR.winner === 'LDA' ? 'Sociedade (Lda / Unipessoal)' : 'Trabalhador Independente (ENI)'}`}</div>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontSize: '8.5pt', color: taxR.winner === 'LDA' ? '#5a1313' : '#065f46', outline: 'none', cursor: 'text' }}
                  >{`Vantagem face à alternativa: ${ptEur(taxR.diff)}/ano adicional`}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <MetricCard label="Net Income ENI" value={ptEur(taxR.eniNet)} bg="#ecfdf5" color="#059669" />
                  <MetricCard label="Net Income Lda" value={ptEur(taxR.ldaNet)} bg="#fdf2f2" color="#781D1D" />
                </div>
              </>
            )}
          </div>
          <PageFooter />
        </div>

        {/* ════ PÁGINA 2 — ENQUADRAMENTO FISCAL ════ */}
        {taxState && taxR && (
          <div className="pdf-page" style={pageStyle}>
            <PageHeader title="Enquadramento Fiscal — ENI vs Sociedade" pageNum={2} />
            <div style={{ flex: 1, padding: '5mm 14mm 8mm 14mm' }}>

              {/* Comparison table header */}
              <div style={{ display: 'flex', marginBottom: 0 }}>
                <div style={{ flex: 1, background: '#781D1D', color: 'white', padding: '6px 8px', fontWeight: 700, fontSize: '9pt', marginRight: 2 }}>
                  ENI (Recibos Verdes)
                </div>
                <div style={{ flex: 1, background: '#334155', color: 'white', padding: '6px 8px', fontWeight: 700, fontSize: '9pt' }}>
                  Sociedade (Lda / Unipessoal)
                </div>
              </div>

              {/* Comparison rows */}
              {[
                ['Faturação:', ptEur(taxState.rev), 'Faturação:', ptEur(taxState.rev), false],
                ['Custos & Contabilidade:', ptEur(taxR.costsEni), 'Custos & Contabilidade:', ptEur(taxR.costsLda), true],
                ['Segurança Social (21,4%):', ptEur(taxR.eniSS), 'TSU Empresa (23,75%):', ptEur(taxR.ldaSSComp), false],
                ...(taxR.irsJovemDeduction > 0 ? [['Isenção IRS Jovem:', `- ${ptEur(taxR.irsJovemDeduction)}`, '—', '—', true]] : []),
                ...(taxR.depsDeduction > 0 ? [['Ded. Dependentes:', `- ${ptEur(taxR.depsDeduction)}`, '—', '—', false]] : []),
                ['IRS (agravado c/ atividade):', ptEur(taxR.eniIRS), 'TSU Gestor (11%):', ptEur(taxR.ldaSSMgr), true],
                ['—', '—', 'IRC (15%/19%):', ptEur(taxR.irc), false],
              ].map(([lEni, vEni, lLda, vLda, shade], i) => (
                <div key={i} style={{ display: 'flex', background: shade ? '#f8fafc' : 'white', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1, display: 'flex', padding: '4px 8px', borderRight: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b', fontWeight: 600, fontSize: '8pt', width: '60%' }}>{lEni}</span>
                    <span contentEditable suppressContentEditableWarning
                      style={{ fontWeight: 700, fontSize: '8.5pt', color: '#0f172a', flex: 1, textAlign: 'right', outline: 'none', cursor: 'text' }}
                    >{String(vEni)}</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', padding: '4px 8px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600, fontSize: '8pt', width: '60%' }}>{lLda}</span>
                    <span contentEditable suppressContentEditableWarning
                      style={{ fontWeight: 700, fontSize: '8.5pt', color: '#0f172a', flex: 1, textAlign: 'right', outline: 'none', cursor: 'text' }}
                    >{String(vLda)}</span>
                  </div>
                </div>
              ))}

              {/* Net totals */}
              <div style={{ display: 'flex', marginTop: 2, marginBottom: 8 }}>
                <div style={{ flex: 1, background: taxR.winner === 'ENI' ? '#ecfdf5' : '#f8fafc', padding: '8px', marginRight: 2 }}>
                  <div style={{ fontSize: '7pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rendimento Líquido Anual</div>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontSize: '14pt', fontWeight: 800, color: taxR.winner === 'ENI' ? '#059669' : '#0f172a', outline: 'none', cursor: 'text' }}
                  >{ptEur(taxR.eniNet)}</div>
                  {taxR.winner === 'ENI' && <div style={{ fontSize: '7pt', color: '#059669', fontWeight: 700, marginTop: 2 }}>✓ MELHOR OPÇÃO</div>}
                </div>
                <div style={{ flex: 1, background: taxR.winner === 'LDA' ? '#fdf2f2' : '#f8fafc', padding: '8px' }}>
                  <div style={{ fontSize: '7pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rendimento Líquido Anual</div>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontSize: '14pt', fontWeight: 800, color: taxR.winner === 'LDA' ? '#781D1D' : '#0f172a', outline: 'none', cursor: 'text' }}
                  >{ptEur(taxR.ldaNet)}</div>
                  {taxR.winner === 'LDA' && <div style={{ fontSize: '7pt', color: '#781D1D', fontWeight: 700, marginTop: 2 }}>✓ MELHOR OPÇÃO</div>}
                </div>
              </div>

              {/* Cash flows */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <MetricCard label="Cash-Flow Livre ENI (Ano 1)" value={ptEur(taxR.eniCashFlow)} bg="#ecfdf5" color="#059669" />
                <MetricCard label="Cash-Flow Holding Lda (Ano 1)" value={ptEur(taxR.ldaCashFlow)} bg="#fdf2f2" color="#781D1D" />
              </div>

              {/* Break-even */}
              <SecHead title="Pontos de Equilíbrio (Break Even)" bg="#92400e" />
              <div style={{ background: '#fffbeb', padding: '8px', marginBottom: 8 }}>
                <DR label="Faturação mínima — Numa Empresa:" value={ptEur(taxR.beLda) + '/ano'} />
                <DR label="Faturação mínima — Nos Recibos:" value={ptEur(taxR.beEni) + '/ano'} />
              </div>

              {/* PPC */}
              {taxR.ppc > 0 && (
                <>
                  <SecHead title="Pagamentos por Conta (PPC)" bg="#b45309" />
                  <div style={{ background: '#fffbeb', padding: '8px', fontSize: '8.5pt' }}>
                    <DR2 l1="Por Prestação:" v1={ptEur(taxR.ppc / 3)} l2="Total Anual:" v2={ptEur(taxR.ppc)} />
                    <div contentEditable suppressContentEditableWarning
                      style={{ padding: '4px 8px', fontSize: '8pt', color: '#92400e', outline: 'none', cursor: 'text' }}
                    >Pagamentos em julho, setembro e dezembro — para ENI com IRS significativo exigidos pela AT.</div>
                  </div>
                </>
              )}

              {/* IVA advice */}
              <SecHead title="Parecer Tributário — IVA" bg="#1e293b" />
              <div style={{ background: '#f8fafc', padding: '8px' }}>
                <div contentEditable suppressContentEditableWarning
                  style={{ fontSize: '8.5pt', color: '#334155', outline: 'none', cursor: 'text' }}
                >{taxState.rev <= 15000 && !taxState.b2b ? 'Com faturação ≤15.000€ e mercado B2C, é possível ativar a isenção do Art. 53º do CIVA. Preços sem IVA = mais competitivos.' : `Com este volume e mercado ${taxState.b2b ? 'B2B' : 'B2C'}, o enquadramento no Regime Normal de IVA é obrigatório e vantajoso para dedução de despesas.`}</div>
              </div>
            </div>
            <PageFooter />
          </div>
        )}

        {/* ════ PÁGINA 3 — VIATURAS ════ */}
        {vehicleState && vehR && (
          <div className="pdf-page" style={pageStyle}>
            <PageHeader title="Viaturas Ligeiras — IVA e Tributação Autónoma" pageNum={3} />
            <div style={{ flex: 1, padding: '5mm 14mm 8mm 14mm' }}>
              <SecHead title={`${vehicleState.category === 'passageiros' ? 'Ligeiro de Passageiros' : 'Veículo Comercial'} — ${vehicleState.engineType.toUpperCase()}`} />
              <div style={{ background: '#f8fafc' }}>
                <DR2 l1="Preço Aquisição (s/ IVA):" v1={ptEur(vehicleState.price)} l2="Regime Aquisição:" v2={vehicleState.ivaRegime === 'normal' ? 'Compra Nova c/ IVA' : vehicleState.ivaRegime === 'second_hand' ? '2ª Mão' : 'Leasing/Renting'} />
                <DR2 l1="IVA Aquisição Total:" v1={ptEur(vehR.totalIvaAq)} l2="Taxa Dedução IVA:" v2={`${(vehR.ivaAqRate * 100).toFixed(0)}%`} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {/* IVA card */}
                <div style={{ flex: 1, background: '#ecfdf5', borderRadius: 6, padding: '8px' }}>
                  <div style={{ fontSize: '8pt', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>IVA Recuperável Anual</div>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontSize: '16pt', fontWeight: 800, color: '#059669', outline: 'none', cursor: 'text', marginBottom: 8 }}
                  >{ptEur(vehR.ivaTotalDed)}</div>
                  <DR label="IVA Aquisição:" value={ptEur(vehR.ivaAqDed)} />
                  <DR label="IVA Manutenção:" value={ptEur(vehR.maintIvaDed)} />
                  <DR label="IVA Combustível:" value={ptEur(vehR.fuelIvaDed)} />
                  <DR label="Seguro (isento IVA):" value="€0" />
                </div>
                {/* TA card */}
                <div style={{ flex: 1, background: '#fef2f2', borderRadius: 6, padding: '8px' }}>
                  <div style={{ fontSize: '8pt', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Tributação Autónoma</div>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontSize: '16pt', fontWeight: 800, color: '#b91c1c', outline: 'none', cursor: 'text', marginBottom: 8 }}
                  >{ptEur(vehR.taValue)}</div>
                  <DR label="Taxa Aplicada:" value={`${(vehR.taRate * 100).toFixed(1)}%`} />
                  <DR label="Encargos sujeitos a TA:" value={ptEur(vehR.totalEncsTA)} />
                  <DR label="Depreciação não aceite:" value={ptEur(vehR.depNaoAceite)} />
                  <DR label="Limite fiscal:" value={vehR.limit === Infinity ? 'Ilimitado' : ptEur(vehR.limit)} />
                </div>
              </div>
            </div>
            <PageFooter />
          </div>
        )}

        {/* ════ PÁGINA 4 — BENEFÍCIOS E SS ════ */}
        {(ticketState || ssState) && (
          <div className="pdf-page" style={pageStyle}>
            <PageHeader title="Benefícios Laborais e Segurança Social" pageNum={vehicleState ? 4 : 3} />
            <div style={{ flex: 1, padding: '5mm 14mm 8mm 14mm' }}>

              {tickR && ticketState && (
                <>
                  <SecHead title="Tickets de Refeição — Benefícios Fiscais" />
                  <div style={{ background: '#f8fafc' }}>
                    <DR2 l1="Funcionários:" v1={`${ticketState.employees}`} l2="Valor diário:" v2={`€${ticketState.ticketValue}/dia`} />
                    <DR2 l1="Dias por mês:" v1={`${ticketState.daysPerMonth}`} l2="Meses:" v2={`${ticketState.months}`} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <MetricCard label="Custo Total Tickets/Ano" value={ptEur(tickR.ticketCost)} bg="#eff6ff" color="#2563eb" />
                    <MetricCard label="Poupança SS (23,75%)/Ano" value={ptEur(tickR.savings)} bg="#ecfdf5" color="#059669" />
                    <MetricCard label="Custo Dedutível (60%)/Ano" value={ptEur(tickR.custoDedutivelEmpresa)} bg="#fdf2f2" color="#781D1D" />
                  </div>
                </>
              )}

              {ssR && ssState && (
                <>
                  <SecHead title="Segurança Social — Trabalhador Independente (ENI)" bg="#334155" />
                  <div style={{ background: '#f8fafc' }}>
                    <DR2 l1="Rendimento mensal:" v1={ptEur(ssState.income)} l2="Tipo:" v2={ssState.tipoRendimento === 'servicos' ? 'Serviços (base 70%)' : 'Bens (base 20%)'} />
                    <DR2 l1="Base de cálculo:" v1={ptEur(ssR.baseCalculo)} l2="Taxa:" v2="21,4%" />
                  </div>
                  {ssR.isento ? (
                    <div style={{ background: '#ecfdf5', borderRadius: 6, padding: '10px', marginTop: 8 }}>
                      <div contentEditable suppressContentEditableWarning
                        style={{ fontWeight: 700, color: '#059669', fontSize: '10pt', outline: 'none', cursor: 'text' }}
                      >✓ ISENTO — 1.º Ano de Atividade (Art. 164.º CRCSPSS)</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <MetricCard label="Contribuição Mensal" value={ptEur(ssR.mensal)} bg="#eff6ff" color="#2563eb" />
                      <MetricCard label="Contribuição Trimestral" value={ptEur(ssR.trimestral)} bg="#fdf2f2" color="#781D1D" />
                      <MetricCard label="Contribuição Anual" value={ptEur(ssR.anual)} bg="#ecfdf5" color="#059669" />
                    </div>
                  )}
                </>
              )}
            </div>
            <PageFooter />
          </div>
        )}

        {/* ════ ÚLTIMA PÁGINA — NOTAS LEGAIS ════ */}
        <div className="pdf-page" style={{ ...pageStyle, pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
          <PageHeader title="Base Legal e Notas" pageNum={[taxState, vehicleState, ticketState || ssState].filter(Boolean).length + 2} />
          <div style={{ flex: 1, padding: '5mm 14mm 8mm 14mm' }}>
            <SecHead title="Legislação de Referência — Simuladores Recofatima 2026" />
            <div style={{ background: '#f8fafc' }}>
              {legalItems.map(([topic, desc], i) => (
                <div key={i} style={{ display: 'flex', padding: '3px 8px', background: i % 2 === 0 ? '#f1f5f9' : 'white', borderBottom: '1px solid #e2e8f0', fontSize: '8pt' }}>
                  <span contentEditable suppressContentEditableWarning
                    style={{ color: '#781D1D', fontWeight: 700, width: 130, flexShrink: 0, outline: 'none', cursor: 'text' }}
                  >{topic}</span>
                  <span contentEditable suppressContentEditableWarning
                    style={{ color: '#0f172a', flex: 1, outline: 'none', cursor: 'text' }}
                  >{desc}</span>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 6, padding: '10px 12px', marginTop: 12 }}>
              <div contentEditable suppressContentEditableWarning
                style={{ fontWeight: 700, color: '#78350f', fontSize: '9pt', marginBottom: 6, outline: 'none', cursor: 'text' }}
              >Nota Importante — Limitações desta Simulação</div>
              <div contentEditable suppressContentEditableWarning
                style={{ fontSize: '8pt', color: '#92400e', lineHeight: 1.5, outline: 'none', cursor: 'text' }}
              >Este relatório é uma estimativa baseada nos dados fornecidos e na legislação fiscal em vigor em abril de 2026. Os resultados não constituem aconselhamento jurídico ou fiscal vinculativo. Situações específicas (deduções adicionais, benefícios regionais, acordos de dupla tributação, entre outros) podem alterar os valores calculados. Consulte sempre um contabilista certificado (OCC) antes de tomar decisões fiscais.</div>
            </div>

            {/* Branding block */}
            <div style={{ background: '#781D1D', borderRadius: 4, padding: '8px 12px', marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: 'white', borderRadius: 4, padding: '3px 3px 1px 3px', flexShrink: 0 }}>
                <svg viewBox="0 0 100 80" style={{ width: 28, height: 22, display: 'block' }} fill="none">
                  <path d="M 45 10 A 30 30 0 0 0 45 70" stroke="#333333" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M 30 45 L 42 58 L 65 25" stroke="#781D1D" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div contentEditable suppressContentEditableWarning
                  style={{ color: 'white', fontWeight: 800, fontSize: '9pt', outline: 'none', cursor: 'text' }}
                >RECOFATIMA Contabilidade</div>
                <div contentEditable suppressContentEditableWarning
                  style={{ color: 'rgba(255,255,255,0.8)', fontSize: '8pt', outline: 'none', cursor: 'text', marginTop: 2 }}
                >{`Relatório gerado em ${dateStr} • OE 2026`}</div>
              </div>
            </div>
          </div>
          <PageFooter />
        </div>

      </div>
    </div>
  );
}
