import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Download } from 'lucide-react';
import type { ClientProfile } from './ClientProfile';
import type { OfficeSettings } from './lib/officeSettings';
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
  /** Quando true, o editor renderiza dentro do fluxo (sem overlay nem toolbar próprio). */
  embedded?: boolean;
  /** Definições do escritório — quando preenchidas, substituem o branding "Estudo 360" pela marca do escritório. */
  office?: OfficeSettings;
}

interface Brand {
  /** Cor primária — usada em headers/footers/MetricCards/SecHead. */
  color: string;
  /** Nome a exibir no cabeçalho. */
  name: string;
  /** Subtítulo (curto, para banner) — "Contabilidade". */
  subtitleShort: string;
  /** Subtítulo longo (capa) — "Contabilidade & Consultoria Fiscal". */
  subtitleLong: string;
  /** Logo data URL (opcional). Se null, mostra o SVG fallback. */
  logoDataUrl: string | null;
}

function brandFromOffice(office?: OfficeSettings): Brand {
  const o = office;
  const hasOffice = !!(o && (o.nome || o.logoDataUrl));
  if (!hasOffice) {
    return {
      color: '#0677FF',
      name: 'Estudo 360',
      subtitleShort: 'Contabilidade',
      subtitleLong: 'Contabilidade & Consultoria Fiscal',
      logoDataUrl: null,
    };
  }
  return {
    color: o!.corPrimaria || '#0677FF',
    name: o!.nome || 'Estudo 360',
    subtitleShort: o!.tipo === 'sociedade' ? 'Sociedade de Contabilidade' : 'Contabilidade Certificada',
    subtitleLong: o!.tipo === 'sociedade' ? 'Sociedade de Contabilidade Certificada' : 'Contabilista Certificado',
    logoDataUrl: o!.logoDataUrl || null,
  };
}

/** Logo: usa imagem do escritório se disponível, senão o SVG fallback do produto. */
function BrandLogo({ brand, width, height }: { brand: Brand; width: number; height: number }) {
  if (brand.logoDataUrl) {
    return <img src={brand.logoDataUrl} alt="" style={{ width, height, objectFit: 'contain', display: 'block' }} />;
  }
  return (
    <svg viewBox="0 0 100 100" style={{ width, height, display: 'block' }} fill="none" aria-hidden="true" focusable="false">
      <path d="M 70 20 A 35 35 0 1 1 35 22" stroke={brand.color} strokeWidth="10" strokeLinecap="round" />
      <path d="M 60 10 L 70 20 L 60 30" stroke="#0B1D2D" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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

// Cabeçalho de secção: tab de acento curto + rótulo escuro sobre branco, com
// hairline em baixo. Antes era uma barra cheia saturada por secção (vermelho,
// castanho, laranja, navy, preto) — um arco-íris que datava o relatório. Agora
// a cor entra só como um tabzinho de acento; o estilo é uniforme em todo o doc.
const SecHead = ({ title, bg }: { title: string; bg: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, marginBottom: 4, paddingBottom: 3, borderBottom: '1px solid #E2E8F0' }}>
    <span style={{ width: 16, height: 3, borderRadius: 2, background: bg, flexShrink: 0 }} />
    <span contentEditable suppressContentEditableWarning
      style={{ outline: 'none', cursor: 'text', fontSize: '8.5pt', fontWeight: 800, letterSpacing: '0.9px', textTransform: 'uppercase', color: '#0F172A' }}
    >{title}</span>
  </div>
);

const PageHeader = ({ title, pageNum, brand }: { title: string; pageNum: number; brand: Brand }) => (
  <div style={{ background: `linear-gradient(120deg, #0B1D2D 0%, ${brand.color} 100%)`, color: 'white', padding: '5px 14mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '8pt', borderBottom: '2px solid #00C2FF' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ background: 'white', borderRadius: 3, padding: '2px 3px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 18 }}>
        <BrandLogo brand={brand} width={18} height={14} />
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: '7.5pt' }}>{brand.name}</div>
        <div style={{ fontSize: '6pt', opacity: 0.8 }}>{brand.subtitleShort}</div>
      </div>
    </div>
    <span contentEditable suppressContentEditableWarning
      style={{ outline: 'none', cursor: 'text', fontWeight: 600 }}>{title}</span>
    <span style={{ opacity: 0.8 }}>Pág. {pageNum}</span>
  </div>
);


const MetricCard = ({ label, value, bg, color }: { label: string; value: string; bg: string; color: string }) => (
  <div style={{ flex: 1, background: bg, borderRadius: 4, padding: '6px 8px' }}>
    <div style={{ fontSize: '6.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
    <div contentEditable suppressContentEditableWarning
      style={{ fontSize: '12pt', fontWeight: 800, color, outline: 'none', cursor: 'text' }}>{value}</div>
  </div>
);

// Cada secção é uma folha A4 (210mm de largura) que QUEBRA de página na
// impressão (page-break-after). Antes forçávamos minHeight: 297mm + conteúdo
// flex:1 + rodapé empurrado para o fundo (marginTop:auto) — em páginas pouco
// preenchidas (capa, viaturas, notas) isso abria um enorme vazio entre o
// conteúdo e o rodapé. Agora a folha tem a altura do conteúdo: o rodapé segue
// logo a seguir e a folha física pode ficar mais curta que A4 (espaço em branco
// só no fim, não a meio). Documento muito mais compacto.
const pageStyle: React.CSSProperties = {
  width: '210mm', background: 'white',
  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  margin: '0 auto 24px auto', display: 'flex', flexDirection: 'column',
  fontFamily: "'Montserrat', 'Helvetica Neue', Helvetica, sans-serif", boxSizing: 'border-box',
  color: '#0B1D2D',
  pageBreakAfter: 'always', breakAfter: 'page',
};

// Paleta da marca do site (estudo360.pt) — navy / azul / ciano.
const NAVY = '#0B1D2D';
const CYAN = '#00C2FF';

// Semântica de cor consistente em todo o relatório: a MELHOR opção é sempre
// VERDE e a PIOR sempre VERMELHA — independentemente de ser ENI ou Sociedade.
const GREEN = { bg: '#ecfdf5', accent: '#059669', dark: '#065f46' };
// Perdedor em slate neutro (não vermelho saturado): a recomendação destaca-se a
// verde, a alternativa fica calma — menos alarmista, mais profissional.
const SLATE = { bg: '#F1F5F9', accent: '#475569', dark: '#334155' };
/** Devolve a paleta (verde vencedor / slate alternativa) para um regime. */
const regimePalette = (isWinner: boolean) => (isWinner ? GREEN : SLATE);

export default function PDFPreviewEditor({ profile, taxState, vehicleState, ticketState, ssState, onClose, embedded = false, office }: Props) {
  const brand = brandFromOffice(office);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'pdf-print-css';
    style.textContent = `
      @media print {
        body { visibility: hidden; }
        #pdf-editor-root { visibility: visible; position: absolute; top: 0; left: 0; width: 100%; background: white; overflow: visible; z-index: 99999; }
        #pdf-editor-root * { visibility: visible; }
        .no-print { display: none !important; }
        /* O wrapper de scroll com padding/overflow gera páginas em branco na
           impressão — neutralizá-lo para o conteúdo fluir como folhas A4 limpas. */
        .pdf-pages-scroll { padding: 0 !important; margin: 0 !important; overflow: visible !important; flex: none !important; display: block !important; }
        .pdf-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; break-after: page; zoom: 1 !important; overflow: hidden; }
        .pdf-page:last-child { page-break-after: avoid; break-after: avoid; }
        /* Não partir cartões/linhas a meio entre páginas físicas. */
        .pdf-card, .pdf-norow { break-inside: avoid; page-break-inside: avoid; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        [contenteditable] { outline: none !important; }
        @page { size: A4 portrait; margin: 0; }
      }
      /* Em ecrãs estreitos a página A4 (210mm) é mais larga que o ecrã;
         reduz com CSS zoom para mostrar a folha completa. O utilizador
         pode ampliar manualmente com pinça. Impressão fica intacta. */
      @media screen and (max-width: 820px) {
        #pdf-editor-root .pdf-page { zoom: 0.46; }
      }
      @media screen and (max-width: 480px) {
        #pdf-editor-root .pdf-page { zoom: 0.42; }
      }
      @media screen and (max-width: 380px) {
        #pdf-editor-root .pdf-page { zoom: 0.38; }
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

  // A página de Benefícios/SS só faz sentido se houver RESULTADOS calculados —
  // gatear pelo `ticketState`/`ssState` cru (que têm sempre um valor inicial)
  // imprimia uma página com só cabeçalho+rodapé = página em branco. Gatear pelo
  // resultado (`tickR`/`ssR`) evita a folha vazia.
  const hasBenef = !!(tickR || ssR);

  const legalItems = [
    ['IRS — Escalões 2026', 'CIRS Art. 68º — Taxas de 13% a 48% (OE 2026)'],
    ['IRS Jovem', 'CIRS Art. 12º-B — Isenção 10 anos (100% 1º · 75% 2º-4º · 50% 5º-7º · 25% 8º-10º), ≤35 anos, até 55×IAS (€29.542)'],
    ['Ded. Dependentes', 'CIRS Art. 78º-A — €600/dependente; €726 se ≤3 anos; €900 do 2.º filho ≤6 anos'],
    ['Regime Simplificado ENI', 'CIRS Art. 31º — Coeficientes: 75% prof. listadas / 35% outros serviços / 15% bens'],
    ['IRC — PME', 'CIRC Art. 87º — Taxa 15% (primeiros €50k) / 19% restante'],
    ['TSU Patronal', 'Lei 110/2009 — 23,75% (empresa) + 11% (trabalhador)'],
    ['SS Independente', 'CRCSPSS Art. 162º — Taxa 21,4% sobre 70% (serviços) / 20% (bens)'],
    ['SS — Isenção 1º ano', 'CRCSPSS Art. 164º — Isenção de 12 meses no início de atividade'],
    ['IVA Normal', 'CIVA — Taxa standard 23% (Portugal Continental)'],
    ['IVA Isenção PME', 'CIVA Art. 53º — Isenção p/ faturação <€15.000 exclusivamente B2C'],
    ['IVA Viaturas', 'CIVA Art. 21º, n.º 1 — Dedução 100%/50%/0% conforme motor'],
    ['Tributação Autónoma', 'CIRC Art. 88º, n.º 3 — TA escalonada p/ viaturas passageiros'],
    ['TA Viaturas Elétricas', 'Lei n.º 82/2023 — TA 10% p/ elétricos com custo >€62.500'],
    ['Subsídio de Refeição', 'Isento até €6,15/dia (numerário) ou €10,46/dia (cartão/vale) — Despacho 233-A/2026'],
    ['Tickets — Dedutibilidade', 'CIRC Art. 43º — 60% do custo total dedutível para a empresa'],
    ['Tickets — SS e IRS', 'EBF Art. 18º-A — Isenção SS e IRS para o trabalhador (até ao limite)'],
  ];

  const rootStyle: React.CSSProperties = embedded
    ? { background: 'transparent', display: 'flex', flexDirection: 'column' }
    : { background: '#e2e8f0', height: '100%', display: 'flex', flexDirection: 'column' };

  const inner = (
    <div id="pdf-editor-root" style={rootStyle}>

      {!embedded && (
        <>
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
                style={{ background: '#0677FF', color: 'white', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}
              >
                <Download size={15} /> Transferir PDF
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
            <span>Ao clicar <strong>Transferir PDF</strong>, selecione <strong>"Guardar como PDF"</strong> na janela de impressão do navegador. Certifique-se de desativar cabeçalhos/rodapés do navegador nas opções avançadas.</span>
          </div>
        </>
      )}

      {/* ── Scrollable pages ── */}
      <div className="pdf-pages-scroll" style={embedded ? { padding: '0' } : { flex: 1, overflow: 'auto', padding: '24px' }}>

        {/* ════ PÁGINA 1 — CAPA + DADOS CLIENTE ════ */}
        <div className="pdf-page" style={pageStyle}>

          {/* Cover header — gradiente navy→azul com fio ciano (linguagem do site) */}
          <div style={{ background: `linear-gradient(120deg, ${NAVY} 0%, ${brand.color} 100%)`, color: 'white', padding: '14mm 14mm 10mm 14mm', display: 'flex', alignItems: 'center', gap: '10mm', borderBottom: `3px solid ${CYAN}` }}>
            <div style={{ background: 'white', borderRadius: 5, padding: '4px 4px 2px 4px', flexShrink: 0 }}>
              <BrandLogo brand={brand} width={44} height={36} />
            </div>
            <div style={{ flex: 1 }}>
              <div contentEditable suppressContentEditableWarning
                style={{ fontSize: '22pt', fontWeight: 800, outline: 'none', cursor: 'text', lineHeight: 1.1 }}>{brand.name}</div>
              <div contentEditable suppressContentEditableWarning
                style={{ fontSize: '10pt', outline: 'none', cursor: 'text', marginTop: 3 }}>{brand.subtitleLong}</div>
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
          <div style={{ padding: '5mm 14mm 8mm 14mm' }}>

            <SecHead title="Dados do Cliente" bg={brand.color} />
            <div style={{ background: '#F5F7FA' }}>
              <DR2 l1="Nome / Empresa:" v1={profile.nomeCliente || '—'} l2="NIF:" v2={profile.nif || '—'} />
              <DR2 l1="Email:" v1={profile.email || '—'} l2="Telefone:" v2={profile.telefone || '—'} />
              {profile.morada && <DR label="Morada:" value={`${profile.morada}${profile.codigoPostal ? ', ' + profile.codigoPostal : ''}${profile.localidade ? ' ' + profile.localidade : ''}`} />}
              <DR2 l1="Tipo Entidade:" v1={profile.tipoEntidade.toUpperCase()} l2="CAE:" v2={profile.cae || '—'} />
              <DR2 l1="Início Atividade:" v1={profile.inicioAtividade.toString()} l2="Regime IVA:" v2={profile.regimeIva === 'isento' ? 'Isento (Art. 53º)' : profile.regimeIva === 'normal_mensal' ? 'Normal Mensal' : 'Normal Trimestral'} />
              <DR2 l1="Tipo Atividade:" v1={profile.atividadePrincipal === 'servicos' ? 'Prestação de Serviços' : 'Venda de Bens'} l2="Faturação Anual:" v2={ptEur(profile.faturaçaoAnualPrevista)} />
            </div>

            <SecHead title="Dados Pessoais e Familiares" bg="#334155" />
            <div style={{ background: '#F5F7FA' }}>
              <DR2 l1="Idade:" v1={`${profile.idade} anos`} l2="Estado Civil:" v2={profile.estadoCivil.replace('_', ' ')} />
              <DR2 l1="Dependentes:" v1={`${profile.nrDependentes}`} l2="Cônjuge c/ Rendimentos:" v2={profile.cônjugeRendimentos ? 'Sim' : 'Não'} />
              <DR2 l1="Benefício Jovem IRS:" v1={profile.beneficioJovem ? 'Sim (≤35 anos)' : 'Não aplicável'} l2="Atividade Sazonal:" v2={profile.isSazonal ? 'Sim' : 'Não'} />
            </div>

            {taxR && (
              <>
                <SecHead title="Resumo Executivo — Recomendação" bg={GREEN.accent} />
                <div style={{ background: GREEN.bg, padding: '8px', marginBottom: 8, borderLeft: `3px solid ${GREEN.accent}` }}>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontSize: '12pt', fontWeight: 800, color: GREEN.accent, outline: 'none', cursor: 'text', marginBottom: 4 }}
                  >{`Regime Ideal: ${taxR.winner === 'LDA' ? 'Sociedade (Lda / Unipessoal)' : 'Trabalhador Independente (ENI)'}`}</div>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontSize: '8.5pt', color: GREEN.dark, outline: 'none', cursor: 'text' }}
                  >{`Vantagem face à alternativa: ${ptEur(taxR.diff)}/ano adicional`}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <MetricCard label="Rend. Líquido — ENI" value={ptEur(taxR.eniNet)} bg={regimePalette(taxR.winner === 'ENI').bg} color={regimePalette(taxR.winner === 'ENI').accent} />
                  <MetricCard label="Rend. Líquido — Sociedade" value={ptEur(taxR.ldaNet)} bg={regimePalette(taxR.winner === 'LDA').bg} color={regimePalette(taxR.winner === 'LDA').accent} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ════ PÁGINA 2 — ENQUADRAMENTO FISCAL ════ */}
        {taxState && taxR && (
          <div className="pdf-page" style={pageStyle}>
            <PageHeader title="Enquadramento Fiscal — ENI vs Sociedade" pageNum={2} brand={brand} />
            <div style={{ padding: '5mm 14mm 8mm 14mm' }}>

              {/* Comparison table header — vencedora a verde, a outra em slate neutro
                  (em vez de vermelho saturado, que dava um ar alarmista). */}
              <div style={{ display: 'flex', marginBottom: 0, gap: 2 }}>
                <div style={{ flex: 1, background: taxR.winner === 'ENI' ? GREEN.accent : '#64748B', color: 'white', padding: '7px 10px', fontWeight: 700, fontSize: '9pt', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>ENI (Recibos Verdes)</span>
                  {taxR.winner === 'ENI' && <span style={{ fontSize: '7pt', fontWeight: 800, letterSpacing: '0.5px' }}>RECOMENDADO</span>}
                </div>
                <div style={{ flex: 1, background: taxR.winner === 'LDA' ? GREEN.accent : '#64748B', color: 'white', padding: '7px 10px', fontWeight: 700, fontSize: '9pt', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Sociedade (Lda / Unipessoal)</span>
                  {taxR.winner === 'LDA' && <span style={{ fontSize: '7pt', fontWeight: 800, letterSpacing: '0.5px' }}>RECOMENDADO</span>}
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
                <div key={i} style={{ display: 'flex', background: shade ? '#F5F7FA' : 'white', borderBottom: '1px solid #f1f5f9' }}>
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

              {/* Net totals — vencedor a verde com selo, perdedor a vermelho */}
              <div style={{ display: 'flex', marginTop: 2, marginBottom: 8 }}>
                <div style={{ flex: 1, background: regimePalette(taxR.winner === 'ENI').bg, padding: '8px', marginRight: 2, borderTop: `3px solid ${regimePalette(taxR.winner === 'ENI').accent}` }}>
                  <div style={{ fontSize: '7pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rendimento Líquido Anual</div>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontSize: '14pt', fontWeight: 800, color: regimePalette(taxR.winner === 'ENI').accent, outline: 'none', cursor: 'text' }}
                  >{ptEur(taxR.eniNet)}</div>
                  <div style={{ fontSize: '7pt', color: regimePalette(taxR.winner === 'ENI').accent, fontWeight: 700, marginTop: 2 }}>{taxR.winner === 'ENI' ? '✓ MELHOR OPÇÃO' : 'Opção menos vantajosa'}</div>
                </div>
                <div style={{ flex: 1, background: regimePalette(taxR.winner === 'LDA').bg, padding: '8px', borderTop: `3px solid ${regimePalette(taxR.winner === 'LDA').accent}` }}>
                  <div style={{ fontSize: '7pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rendimento Líquido Anual</div>
                  <div contentEditable suppressContentEditableWarning
                    style={{ fontSize: '14pt', fontWeight: 800, color: regimePalette(taxR.winner === 'LDA').accent, outline: 'none', cursor: 'text' }}
                  >{ptEur(taxR.ldaNet)}</div>
                  <div style={{ fontSize: '7pt', color: regimePalette(taxR.winner === 'LDA').accent, fontWeight: 700, marginTop: 2 }}>{taxR.winner === 'LDA' ? '✓ MELHOR OPÇÃO' : 'Opção menos vantajosa'}</div>
                </div>
              </div>

              {/* Cash flows */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <MetricCard label="Cash-Flow Livre ENI (Ano 1)" value={ptEur(taxR.eniCashFlow)} bg={regimePalette(taxR.winner === 'ENI').bg} color={regimePalette(taxR.winner === 'ENI').accent} />
                <MetricCard label="Cash-Flow Holding Lda (Ano 1)" value={ptEur(taxR.ldaCashFlow)} bg={regimePalette(taxR.winner === 'LDA').bg} color={regimePalette(taxR.winner === 'LDA').accent} />
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
              <div style={{ background: '#F5F7FA', padding: '8px' }}>
                <div contentEditable suppressContentEditableWarning
                  style={{ fontSize: '8.5pt', color: '#334155', outline: 'none', cursor: 'text' }}
                >{taxState.rev <= 15000 && !taxState.b2b ? 'Com faturação ≤15.000€ e mercado B2C, é possível ativar a isenção do Art. 53º do CIVA. Preços sem IVA = mais competitivos.' : taxState.rev > 650000 ? 'Com faturação acima de 650.000€, a periodicidade do IVA passa a mensal obrigatória (Art. 41.º CIVA). Regime Normal — permite deduzir o IVA das despesas.' : `Com este volume e mercado ${taxState.b2b ? 'B2B' : 'B2C'}, o enquadramento no Regime Normal de IVA (periodicidade trimestral) é vantajoso para dedução de despesas.`}</div>
              </div>

              {/* Como Calculámos — pressupostos e taxas (transparência: num PDF não há hover) */}
              <SecHead title="Como Calculámos — Pressupostos" bg="#0f172a" />
              <div contentEditable suppressContentEditableWarning
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '8px 10px', fontSize: '7.8pt', color: '#334155', lineHeight: 1.5, outline: 'none', cursor: 'text' }}
              >
                <div style={{ marginBottom: 3 }}><strong>Rendimento coletável (ENI):</strong> faturação × coeficiente do art.º 31.º CIRS (serviços profissionais 0,75; outros serviços 0,35; vendas e restauração 0,15).</div>
                <div style={{ marginBottom: 3 }}><strong>IRS:</strong> escalões progressivos OE 2026 sobre o rendimento total; IRS Jovem (art.º 12.º-B) e dedução por dependentes (art.º 78.º-A) quando aplicáveis.</div>
                <div style={{ marginBottom: 3 }}><strong>Segurança Social (ENI):</strong> 21,4% sobre 70% da faturação (serviços) ou 20% (bens) — art.º 162.º CRCSPSS.</div>
                <div style={{ marginBottom: 3 }}><strong>Sociedade:</strong> IRC 15% até 50.000€ de lucro e 19% no excedente (taxas PME); TSU 23,75% (empresa) + 11% (gerente) sobre a remuneração do gestor.</div>
                <div style={{ marginBottom: 3 }}><strong>IVA:</strong> isento até 15.000€ (art.º 53.º); periodicidade trimestral até 650.000€; mensal obrigatória acima de 650.000€ (art.º 41.º).</div>
                <div><strong>Custos:</strong> apenas os valores introduzidos no simulador para este cliente — sem pressupostos automáticos.</div>
              </div>
            </div>
          </div>
        )}

        {/* ════ PÁGINA 3 — VIATURAS ════ */}
        {vehicleState && vehR && (
          <div className="pdf-page" style={pageStyle}>
            <PageHeader title="Viaturas Ligeiras — IVA e Tributação Autónoma" pageNum={3} brand={brand} />
            <div style={{ padding: '5mm 14mm 8mm 14mm' }}>
              <SecHead title={`${vehicleState.category === 'passageiros' ? 'Ligeiro de Passageiros' : 'Veículo Comercial'} — ${vehicleState.engineType.toUpperCase()}`} bg={brand.color} />
              <div style={{ background: '#F5F7FA' }}>
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
          </div>
        )}

        {/* ════ PÁGINA 4 — BENEFÍCIOS E SS ════ */}
        {hasBenef && (
          <div className="pdf-page" style={pageStyle}>
            <PageHeader title="Benefícios Laborais e Segurança Social" pageNum={vehicleState ? 4 : 3} brand={brand} />
            <div style={{ padding: '5mm 14mm 8mm 14mm' }}>

              {tickR && ticketState && (
                <>
                  <SecHead title="Tickets de Refeição — Benefícios Fiscais" bg={brand.color} />
                  <div style={{ background: '#F5F7FA' }}>
                    <DR2 l1="Funcionários:" v1={`${ticketState.employees}`} l2="Valor diário:" v2={`€${ticketState.ticketValue}/dia`} />
                    <DR2 l1="Dias por mês:" v1={`${ticketState.daysPerMonth}`} l2="Meses:" v2={`${ticketState.months}`} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <MetricCard label="Custo Total Tickets/Ano" value={ptEur(tickR.ticketCost)} bg="#eff6ff" color="#2563eb" />
                    <MetricCard label="Poupança SS (23,75%)/Ano" value={ptEur(tickR.savings)} bg="#ecfdf5" color="#059669" />
                    <MetricCard label="Custo Dedutível (60%)/Ano" value={ptEur(tickR.custoDedutivelEmpresa)} bg="#fdf2f2" color={brand.color} />
                  </div>
                </>
              )}

              {ssR && ssState && (
                <>
                  <SecHead title="Segurança Social — Trabalhador Independente (ENI)" bg="#334155" />
                  <div style={{ background: '#F5F7FA' }}>
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
                      <MetricCard label="Contribuição Trimestral" value={ptEur(ssR.trimestral)} bg="#fdf2f2" color={brand.color} />
                      <MetricCard label="Contribuição Anual" value={ptEur(ssR.anual)} bg="#ecfdf5" color="#059669" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ════ ÚLTIMA PÁGINA — NOTAS LEGAIS ════ */}
        <div className="pdf-page" style={{ ...pageStyle, pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
          <PageHeader title="Base Legal e Notas" pageNum={[taxState, vehicleState, hasBenef].filter(Boolean).length + 2} brand={brand} />
          <div style={{ padding: '5mm 14mm 8mm 14mm' }}>
            <SecHead title={`Legislação de Referência — ${brand.name} · Simuladores 2026`} bg={brand.color} />
            <div style={{ background: '#F5F7FA' }}>
              {legalItems.map(([topic, desc], i) => (
                <div key={i} style={{ display: 'flex', padding: '3px 8px', background: i % 2 === 0 ? '#f1f5f9' : 'white', borderBottom: '1px solid #e2e8f0', fontSize: '8pt' }}>
                  <span contentEditable suppressContentEditableWarning
                    style={{ color: brand.color, fontWeight: 700, width: 130, flexShrink: 0, outline: 'none', cursor: 'text' }}
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
            <div style={{ background: brand.color, borderRadius: 4, padding: '8px 12px', marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: 'white', borderRadius: 4, padding: '3px 3px 1px 3px', flexShrink: 0 }}>
                <BrandLogo brand={brand} width={28} height={22} />
              </div>
              <div>
                <div contentEditable suppressContentEditableWarning
                  style={{ color: 'white', fontWeight: 800, fontSize: '9pt', outline: 'none', cursor: 'text' }}
                >{brand.name}</div>
                <div contentEditable suppressContentEditableWarning
                  style={{ color: 'rgba(255,255,255,0.8)', fontSize: '8pt', outline: 'none', cursor: 'text', marginTop: 2 }}
                >{`Relatório gerado em ${dateStr} • OE 2026`}</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  if (embedded) return inner;

  // Drawer alinhado à direita (mesma forma que o ExportPackageModal).
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editor de relatório"
      className="fixed inset-0 z-[1100] flex items-stretch no-print"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm cursor-default"
      />
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="relative ml-auto w-full max-w-[1280px] h-full bg-[#e2e8f0] shadow-2xl flex flex-col overflow-hidden"
      >
        {inner}
      </motion.div>
    </div>
  );
}
