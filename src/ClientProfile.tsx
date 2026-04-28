import React from 'react';
import { User, Building2, FileText, Download, Ticket, Wallet, MapPin } from 'lucide-react';
import { jsPDF } from 'jspdf';

// Converte o SVG do logotipo para PNG data URL via canvas
const svgLogoToPng = (): Promise<string> => {
  return new Promise((resolve) => {
    const svgContent = `<svg viewBox="0 0 100 80" width="400" height="320" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="80" fill="white"/><path d="M 45 10 A 30 30 0 0 0 45 70" stroke="#333333" stroke-width="2.5" stroke-linecap="round"/><path d="M 30 45 L 42 58 L 65 25" stroke="#781D1D" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(''); return; }
    const img = new Image();
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 400, 320);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
    img.src = url;
  });
};
import { cn } from './lib/utils';
import {
  calculateIRS,
  calcIRSJovem,
  calcDependentsDeduction,
  calcTicketSavings,
  calcSelfSSContribution,
  calculateIRC,
  SS_RATE_EMPLOYER,
} from './lib/pt2026';

export interface ClientProfile {
  nomeCliente: string;
  nif: string;
  email: string;
  telefone: string;
  morada: string;
  codigoPostal: string;
  localidade: string;
  regimeIva: 'isento' | 'normal_mensal' | 'normal_trimestral';
  cae: string;
  inicioAtividade: number;
  atividadePrincipal: 'servicos' | 'bens';
  isSazonal: boolean;
  idade: number;
  estadoCivil: 'solteiro' | 'casado' | 'uniao_facto' | 'divorciado' | 'viuvo';
  cônjugeRendimentos: boolean;
  nrDependentes: number;
  beneficioJovem: boolean;
  tipoEntidade: 'eni' | 'lda' | 'unipessoal' | 'sa' | 'socio_unico';
  faturaçaoAnualPrevista: number;
  nrFuncionarios: number;
  veiculos: any[];
  tipoVale: 'refeicao' | 'alimentacao' | 'social';
  valorTicket: number;
  limiteDeducao: number;
  setorTicket: 'normal' | 'construcao' | 'hotelaria' | 'outros';
  rendimentoMensalEni: number;
  regimeSs: 'general' | 'simplified';
  tipoRendimentoSs: 'servicos' | 'bens';
}

interface TaxSimulatorState {
  profSit: string;
  currentInc: number;
  age: number;
  isMainAct: boolean;
  monthlyNeed: number;
  isServices: boolean;
  b2b: boolean;
  rev: number;
  isSeasonal: boolean;
  invEquip: number;
  invLic: number;
  invWorks: number;
  invFundo: number;
  fixedMo: number;
  varYr: number;
  accMoLda: number;
  accMoEni: number;
  anosAtividade: number;
}

interface VehicleSimulatorState {
  category: 'comercial' | 'passageiros';
  engineType: string;
  price: number;
  ivaRegime: string;
  activity: string;
  maintenanceCost: number;
  insuranceCost: number;
  fuelCost: number;
  exemptTA: boolean;
  phevCompliant: boolean;
}

interface TicketSimulatorState {
  employees: number;
  ticketValue: number;
  daysPerMonth: number;
  months: number;
}

interface SSState {
  income: number;
  regime: 'general' | 'simplified';
  tipoRendimento: 'servicos' | 'bens';
  primeiroAno: boolean;
}

interface Props {
  profile: ClientProfile;
  onChange: (profile: ClientProfile) => void;
  taxState?: TaxSimulatorState;
  vehicleState?: VehicleSimulatorState;
  ticketState?: TicketSimulatorState;
  ssState?: SSState;
}

const inputClass = "w-full pl-[16px] pr-[16px] py-[12px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[15px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
const labelClass = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[8px]";

const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);
const ptPct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function ClientProfile({ profile, onChange, taxState, vehicleState, ticketState, ssState }: Props) {
  const updateProfile = (field: keyof ClientProfile, value: any) => {
    onChange({ ...profile, [field]: value });
  };

  const currentYear = new Date().getFullYear();

  // ─── PDF GENERATION ───────────────────────────────────────────────────────

  const generatePDF = async () => {
    const logoDataUrl = await svgLogoToPng();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    // ─── COMPACT SINGLE-PAGE PDF ──────────────────────────────────────────
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml = 16;
    const mr = 16;
    const cw = pw - ml - mr; // 178 mm

    type RGB = [number, number, number];
    const NAVY: RGB         = [15, 23, 42];
    const MAROON: RGB       = [120, 29, 29];
    const MAROON_LIGHT: RGB = [253, 242, 242];
    const SLATE_50: RGB     = [248, 250, 252];
    const SLATE_100: RGB    = [241, 245, 249];
    const SLATE_200: RGB    = [226, 232, 240];
    const SLATE_500: RGB    = [100, 116, 139];
    const SLATE_700: RGB    = [51, 65, 85];
    const SLATE_900: RGB    = [15, 23, 42];
    const WHITE: RGB        = [255, 255, 255];
    const GREEN: RGB        = [5, 150, 105];
    const GREEN_LIGHT: RGB  = [236, 253, 245];

    const fill  = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
    const textC = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
    const drawC = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
    const hRule = (yy: number) => {
      drawC(SLATE_200); doc.setLineWidth(0.2); doc.line(ml, yy, ml + cw, yy);
    };

    // ── CABEÇALHO ────────────────────────────────────────────────────────────
    fill(SLATE_50);
    doc.rect(0, 0, pw, 13, 'F');
    fill(MAROON);
    doc.rect(0, 0, 3, 13, 'F');
    drawC(SLATE_200); doc.setLineWidth(0.2); doc.line(0, 13, pw, 13);

    if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', ml, 2.5, 8, 8);
    textC(NAVY);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text('RECOFATIMA', ml + 10, 7.5);
    textC(SLATE_500);
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('Contabilidade', ml + 10, 11);
    textC(SLATE_500);
    doc.setFontSize(7);
    doc.text('Simulação Fiscal • OE 2026', pw / 2, 8.5, { align: 'center' });
    const today = new Date();
    const dateStr = today.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(dateStr, pw - mr, 8.5, { align: 'right' });

    // ── RODAPÉ ───────────────────────────────────────────────────────────────
    drawC(SLATE_200); doc.setLineWidth(0.2); doc.line(0, ph - 9, pw, ph - 9);
    fill(MAROON); doc.rect(0, ph - 9, 3, 9, 'F');
    textC(SLATE_500);
    doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text(
      'Este relatório é uma estimativa. Consulte sempre um contabilista certificado (OCC).  RECOFATIMA Contabilidade • OE 2026',
      pw / 2, ph - 4, { align: 'center' }
    );

    // ── IDENTIFICAÇÃO DO CLIENTE ──────────────────────────────────────────────
    let y = 20;
    textC(NAVY);
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text(profile.nomeCliente || 'Cliente', ml, y);

    const entityLabel = ({ eni: 'ENI', lda: 'Lda.', unipessoal: 'Unipessoal Lda.', sa: 'SA', socio_unico: 'Sócio Único' } as Record<string, string>)[profile.tipoEntidade] ?? '';
    const metaParts = [
      profile.nif ? `NIF ${profile.nif}` : null,
      entityLabel,
      profile.atividadePrincipal === 'servicos' ? 'Prestação de Serviços' : 'Venda de Bens',
      `Faturação ${ptEur(profile.faturaçaoAnualPrevista)}/ano`,
    ].filter(Boolean) as string[];
    textC(SLATE_500);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(metaParts.join('  •  '), ml, y + 6.5);
    y += 14;
    hRule(y); y += 7;

    // ── ENQUADRAMENTO FISCAL ──────────────────────────────────────────────────
    if (taxState) {
      const fixedYr  = taxState.fixedMo * 12;
      const invCapex = taxState.invEquip + taxState.invLic + taxState.invWorks;
      const costsEni = fixedYr + taxState.varYr + taxState.accMoEni * 12;
      const costsLda = fixedYr + taxState.varYr + taxState.accMoLda * 12;
      const dpNaoAceite = invCapex * 0.25;

      let eniSS = 0;
      if (!(taxState.profSit === 'tco' && !taxState.isMainAct && taxState.rev <= 20000))
        eniSS = taxState.rev * (taxState.isServices ? 0.70 : 0.20) * 0.214;

      let eniRC = taxState.rev * (taxState.isServices ? 0.75 : 0.15);
      const reqJust = taxState.isServices && taxState.rev > 27360 ? taxState.rev * 0.15 : 0;
      const justDocs = costsEni + 4104;
      if (reqJust > 0 && justDocs < reqJust) eniRC += reqJust - justDocs;
      if (profile.beneficioJovem && profile.idade <= 35)
        eniRC = Math.max(0, eniRC - calcIRSJovem(taxState.anosAtividade || 0, eniRC, profile.idade));

      const eniIRS_Base  = calculateIRS(taxState.currentInc);
      let eniIRS = Math.max(0, calculateIRS(taxState.currentInc + eniRC) - eniIRS_Base - calcDependentsDeduction(profile.nrDependentes));
      const eniNet = taxState.rev - costsEni - eniSS - eniIRS;

      const rawGross    = taxState.monthlyNeed / 0.70;
      const grossYr     = rawGross * 14;
      const ldaSSComp   = grossYr * SS_RATE_EMPLOYER;
      const ldaSSMgr    = grossYr * 0.11;
      const profit      = taxState.rev - costsLda - dpNaoAceite - grossYr - ldaSSComp;
      const irc         = calculateIRC(profit);
      const ldaNet      = (profit - irc) + taxState.monthlyNeed * 12;

      const eniWins = eniNet >= ldaNet;
      const diff    = Math.abs(eniNet - ldaNet);

      // Recomendação
      fill(eniWins ? GREEN_LIGHT : MAROON_LIGHT);
      doc.roundedRect(ml, y, cw, 16, 2, 2, 'F');
      fill(eniWins ? GREEN : MAROON);
      doc.roundedRect(ml, y, 3, 16, 1, 1, 'F');
      textC(eniWins ? GREEN : MAROON);
      doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
      doc.text(
        `✓  Regime Recomendado: ${eniWins ? 'Trabalhador Independente (ENI)' : 'Sociedade (Lda / Unipessoal)'}`,
        ml + 7, y + 7
      );
      textC(SLATE_700);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(`Vantagem face à alternativa: ${ptEur(diff)}/ano`, ml + 7, y + 12.5);
      y += 21;

      // Tabela de comparação (apenas resultados chave)
      const labelCol = cw * 0.52;
      fill(SLATE_100);
      doc.roundedRect(ml, y, cw, 7, 1, 1, 'F');
      textC(SLATE_500);
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('COMPARAÇÃO DE REGIMES', ml + 3, y + 5);
      doc.text('ENI', ml + labelCol + (cw - labelCol) / 2, y + 5, { align: 'center' });
      doc.text('SOCIEDADE', ml + cw, y + 5, { align: 'right' });
      y += 7;

      const compRows: [string, string, string, boolean][] = [
        ['Segurança Social', ptEur(eniSS), ptEur(ldaSSComp + ldaSSMgr), false],
        ['Imposto sobre rendimento (IRS / IRC)', ptEur(eniIRS), ptEur(irc), true],
        ['Rendimento Líquido Anual', ptEur(eniNet), ptEur(ldaNet), false],
      ];
      compRows.forEach(([label, valEni, valLda, shade], i) => {
        const isLast = i === compRows.length - 1;
        if (shade) { fill(SLATE_50); doc.rect(ml, y, cw, 8.5, 'F'); }
        if (isLast) {
          fill(eniWins ? GREEN_LIGHT : SLATE_50);
          doc.rect(ml, y, labelCol, 11, 'F');
          fill(!eniWins ? MAROON_LIGHT : SLATE_50);
          doc.rect(ml + labelCol, y, cw - labelCol, 11, 'F');
        }
        const rowH = isLast ? 11 : 8.5;
        const rowY = y + rowH * 0.62;
        doc.setFontSize(isLast ? 9.5 : 8.5);
        doc.setFont('helvetica', isLast ? 'bold' : 'normal');
        textC(isLast ? NAVY : SLATE_700);
        doc.text(label, ml + 3, rowY);
        textC(isLast && eniWins ? GREEN : SLATE_700);
        doc.text(valEni, ml + labelCol + (cw - labelCol) / 2, rowY, { align: 'center' });
        textC(isLast && !eniWins ? MAROON : SLATE_700);
        doc.text(valLda, ml + cw, rowY, { align: 'right' });
        y += rowH;
      });
      y += 6;
    }

    // ── OUTROS SIMULADORES (resultados resumidos) ────────────────────────────
    const extras: [string, string][] = [];

    if (vehicleState && vehicleState.price > 0) {
      const maintIva = (vehicleState.maintenanceCost - vehicleState.maintenanceCost / 1.23);
      const fuelIva  = (vehicleState.fuelCost - vehicleState.fuelCost / 1.23);
      const isExempt = ['public_transport', 'rent_a_car', 'driving_school'].includes(vehicleState.activity);
      const totalIvaAq = vehicleState.price * 0.23;
      let ivaAqRate = 0;
      if (vehicleState.ivaRegime === 'normal') {
        if (isExempt) ivaAqRate = 1;
        else if (vehicleState.category === 'passageiros') {
          if (vehicleState.engineType === 'electric') ivaAqRate = vehicleState.price <= 62500 ? 1 : 0;
          else if (vehicleState.engineType === 'phev' && vehicleState.phevCompliant) ivaAqRate = vehicleState.price <= 50000 ? 1 : 0;
          else if (['lpg', 'cng'].includes(vehicleState.engineType)) ivaAqRate = vehicleState.price <= 37500 ? 0.5 : 0;
        } else ivaAqRate = 0.5;
      }
      const maintIvaDed = (isExempt || vehicleState.category === 'comercial') ? maintIva : 0;
      let fuelIvaRate = 0;
      if (isExempt) fuelIvaRate = 1;
      else if (vehicleState.engineType === 'electric') fuelIvaRate = 1;
      else if (['diesel', 'lpg', 'cng'].includes(vehicleState.engineType)) fuelIvaRate = 0.5;
      const ivaTotalDed = totalIvaAq * ivaAqRate + maintIvaDed + fuelIva * fuelIvaRate;

      const dep = vehicleState.price * 0.25;
      let limit = 25000;
      if (vehicleState.engineType === 'electric') limit = 62500;
      else if (vehicleState.engineType === 'phev' && vehicleState.phevCompliant) limit = 50000;
      else if (['lpg', 'cng'].includes(vehicleState.engineType)) limit = 37500;
      if (isExempt) limit = Infinity;
      const totalEncTA = dep + (vehicleState.maintenanceCost - maintIvaDed) + vehicleState.insuranceCost + (vehicleState.fuelCost - fuelIva * fuelIvaRate);
      let taRate = 0;
      if (vehicleState.category === 'passageiros' && !vehicleState.exemptTA) {
        if (vehicleState.engineType === 'electric') taRate = vehicleState.price >= 62500 ? 0.10 : 0;
        else if (vehicleState.engineType === 'phev' && vehicleState.phevCompliant)
          taRate = vehicleState.price < 27500 ? 0.025 : vehicleState.price < 35000 ? 0.075 : 0.15;
        else taRate = vehicleState.price < 27500 ? 0.085 : vehicleState.price < 35000 ? 0.255 : 0.325;
      }
      extras.push([
        `Viatura ${vehicleState.engineType.toUpperCase()} — ${ptEur(vehicleState.price)}`,
        `IVA recuperável ${ptEur(ivaTotalDed)}  •  TA ${ptEur(totalEncTA * taRate)}/ano`,
      ]);
    }

    if (ssState) {
      const ssRes = calcSelfSSContribution(ssState.income, ssState.tipoRendimento, ssState.primeiroAno);
      extras.push([
        'Segurança Social Independente',
        ssRes.isento ? 'Isento — 1.º ano (Art. 164.º CRCSPSS)' : `${ptEur(ssRes.mensal)}/mês  •  ${ptEur(ssRes.anual)}/ano`,
      ]);
    }

    if (ticketState && ticketState.employees > 0) {
      const res = calcTicketSavings(ticketState.employees, ticketState.ticketValue, ticketState.daysPerMonth, ticketState.months);
      extras.push([
        `Tickets de Refeição — ${ticketState.employees} func. × ${ptEur(ticketState.ticketValue)}/dia`,
        `Custo ${ptEur(res.ticketCost)}/ano  •  Poupança SS ${ptEur(res.savings)}/ano`,
      ]);
    }

    if (extras.length > 0) {
      hRule(y); y += 5;
      fill(MAROON); doc.rect(ml, y, 3, 5, 'F');
      textC(SLATE_500);
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('OUTROS RESULTADOS', ml + 6, y + 4);
      y += 9;
      extras.forEach(([label, value], i) => {
        if (i % 2 === 0) { fill(SLATE_50); doc.rect(ml, y, cw, 8, 'F'); }
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
        textC(SLATE_700);
        doc.text(label, ml + 3, y + 5.5);
        doc.setFont('helvetica', 'bold'); textC(NAVY);
        doc.text(value, ml + cw, y + 5.5, { align: 'right' });
        y += 8;
      });
      y += 4;
    }

    // ── HONORÁRIOS ────────────────────────────────────────────────────────────
    const { loadPricing, calcClientEstimate } = await import('./lib/pricing');
    const pricing = loadPricing();
    const est = calcClientEstimate(pricing, profile, vehicleState, ticketState);

    hRule(y); y += 7;

    fill(MAROON); doc.rect(ml, y, 3, 6, 'F');
    textC(NAVY);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('ESTIMATIVA DE HONORÁRIOS', ml + 6, y + 4.5);
    textC(SLATE_500);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    doc.text(est.entityLabel, ml + cw, y + 4.5, { align: 'right' });
    y += 10;

    const honorLines: [string, number][] = [['Contabilidade mensal base', est.baseMonthly]];
    if (est.salarios > 0) honorLines.push([`Processamento salarial (${profile.nrFuncionarios} func.)`, est.salarios]);
    if (est.iva > 0) honorLines.push([profile.regimeIva === 'normal_mensal' ? 'IVA mensal' : 'IVA trimestral (÷ 3)', est.iva]);
    honorLines.push([profile.tipoEntidade === 'eni' ? 'IRS anual (÷ 12)' : 'IRC + IES (÷ 12)', est.anuaisAmortizados]);
    if (est.viaturas > 0) honorLines.push(['Gestão de viaturas', est.viaturas]);
    if (est.tickets > 0) honorLines.push(['Tickets de refeição', est.tickets]);

    honorLines.forEach(([label, value], i) => {
      if (i % 2 === 0) { fill(SLATE_50); doc.rect(ml, y, cw, 8, 'F'); }
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); textC(SLATE_700);
      doc.text(label, ml + 3, y + 5.5);
      doc.setFont('helvetica', 'bold'); textC(NAVY);
      doc.text(`${ptEur(value)}/mês`, ml + cw, y + 5.5, { align: 'right' });
      y += 8;
    });

    y += 2;
    fill(NAVY); doc.roundedRect(ml, y, cw, 11, 1.5, 1.5, 'F');
    fill(MAROON); doc.roundedRect(ml, y, 3, 11, 0.5, 0.5, 'F');
    textC(WHITE);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold');
    doc.text('Total mensal estimado', ml + 6, y + 7.5);
    doc.text(`${ptEur(est.totalMensal)}/mês`, ml + cw, y + 7.5, { align: 'right' });
    y += 14;

    fill(SLATE_100); doc.rect(ml, y, cw, 8, 'F');
    textC(SLATE_500); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Total anual estimado', ml + 3, y + 5.5);
    textC(NAVY); doc.setFont('helvetica', 'bold');
    doc.text(`${ptEur(est.totalAnual)}/ano`, ml + cw, y + 5.5, { align: 'right' });
    y += 12;

    textC(SLATE_500);
    doc.setFontSize(6.5); doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(
      'Proposta indicativa. Serviços pontuais (constituição, consultoria, etc.) não incluídos. Sujeito a confirmação após análise detalhada.',
      cw
    );
    doc.text(noteLines, ml, y);

    // ── GRAVAR ───────────────────────────────────────────────────────────────
    doc.save(`Recofatima_${profile.nomeCliente || 'Simulacao'}_${today.getFullYear()}.pdf`);
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col xl:flex-row bg-[#F8FAFC]">
      {/* LEFT PANEL */}
      <div className="xl:w-[480px] shrink-0 bg-white border-r border-[#E2E8F0] overflow-y-auto h-full flex flex-col">
        <div className="p-6 md:p-8 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#F1F5F9]">
          <div>
            <h2 className="text-[20px] font-[800] tracking-[-0.5px] text-[#0F172A]">Perfil do Cliente</h2>
            <div className="text-[11px] font-[700] uppercase tracking-[1px] text-[#4F46E5] mt-1">Parâmetros Master</div>
          </div>
          <button onClick={generatePDF} className="flex shrink-0 items-center gap-2 bg-[#0F172A] text-white px-4 py-2 rounded-[10px] text-[13px] font-[700] hover:bg-[#781D1D] transition-colors shadow-lg">
            <Download size={16} />
            Exportar PDF
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          {/* Identificação */}
          <section>
            <h3 className="text-[14px] font-[800] mb-4 text-[#781D1D] flex items-center border-b pb-2">
              <User className="w-5 h-5 opacity-80 mr-2" />
              Identificação do Cliente
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="col-span-2">
                <label className={labelClass}>Nome do Cliente / Empresa</label>
                <input type="text" value={profile.nomeCliente} onChange={e => updateProfile('nomeCliente', e.target.value)} className={inputClass} placeholder="Nome completo ou denominação social" />
              </div>
              <div>
                <label className={labelClass}>NIF</label>
                <input type="text" value={profile.nif} onChange={e => updateProfile('nif', e.target.value)} className={inputClass} placeholder="123456789" maxLength={9} />
              </div>
              <div>
                <label className={labelClass}>Telefone</label>
                <input type="tel" value={profile.telefone} onChange={e => updateProfile('telefone', e.target.value)} className={inputClass} placeholder="912345678" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Email</label>
                <input type="email" value={profile.email} onChange={e => updateProfile('email', e.target.value)} className={inputClass} placeholder="email@empresa.pt" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Morada</label>
                <input type="text" value={profile.morada} onChange={e => updateProfile('morada', e.target.value)} className={inputClass} placeholder="Rua, Avenida..." />
              </div>
              <div>
                <label className={labelClass}>Código Postal</label>
                <input type="text" value={profile.codigoPostal} onChange={e => updateProfile('codigoPostal', e.target.value)} className={inputClass} placeholder="1000-001" maxLength={8} />
              </div>
              <div>
                <label className={labelClass}>Localidade</label>
                <input type="text" value={profile.localidade} onChange={e => updateProfile('localidade', e.target.value)} className={inputClass} placeholder="Lisboa" />
              </div>
            </div>
          </section>

          {/* Dados Empresariais */}
          <section>
            <h3 className="text-[14px] font-[800] mb-4 text-[#781D1D] flex items-center border-b pb-2">
              <Building2 className="w-5 h-5 opacity-80 mr-2" />
              Dados Empresariais
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label className={labelClass}>Tipo de Entidade</label>
                <select value={profile.tipoEntidade} onChange={e => updateProfile('tipoEntidade', e.target.value)} className={inputClass}>
                  <option value="eni">ENI (Recibos Verdes)</option>
                  <option value="lda">Lda (Sociedade)</option>
                  <option value="unipessoal">Unipessoal Lda</option>
                  <option value="sa">S.A.</option>
                  <option value="socio_unico">Socio Único</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>CAE</label>
                <input type="text" value={profile.cae} onChange={e => updateProfile('cae', e.target.value)} className={inputClass} placeholder="62020" />
              </div>
              <div>
                <label className={labelClass}>Faturação Anual Prevista</label>
                <input type="number" value={profile.faturaçaoAnualPrevista} onChange={e => updateProfile('faturaçaoAnualPrevista', Number(e.target.value))} className={inputClass} placeholder="60000" />
              </div>
              <div>
                <label className={labelClass}>Nr. Funcionários</label>
                <input type="number" value={profile.nrFuncionarios} onChange={e => updateProfile('nrFuncionarios', Number(e.target.value))} className={inputClass} placeholder="5" />
              </div>
              <div>
                <label className={labelClass}>Regime IVA</label>
                <select value={profile.regimeIva} onChange={e => updateProfile('regimeIva', e.target.value)} className={inputClass}>
                  <option value="isento">Isento (Art. 53º)</option>
                  <option value="normal_mensal">Normal Mensal</option>
                  <option value="normal_trimestral">Normal Trimestral</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Ano Início Atividade</label>
                <input type="number" value={profile.inicioAtividade} onChange={e => updateProfile('inicioAtividade', Number(e.target.value))} className={inputClass} min={2000} max={currentYear} />
              </div>
              <div>
                <label className={labelClass}>Atividade Principal</label>
                <select value={profile.atividadePrincipal} onChange={e => updateProfile('atividadePrincipal', e.target.value)} className={inputClass}>
                  <option value="servicos">Prestação de Serviços</option>
                  <option value="bens">Venda de Bens</option>
                </select>
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-[8px] cursor-pointer">
                <input type="checkbox" checked={profile.isSazonal} onChange={e => updateProfile('isSazonal', e.target.checked)} className="w-4 h-4 accent-[#781D1D]" />
                <span className="text-[13px] font-[600] text-slate-700">Atividade Sazonal</span>
              </label>
            </div>
          </section>

          {/* Dados Fiscais e Família */}
          <section>
            <h3 className="text-[14px] font-[800] mb-4 text-[#781D1D] flex items-center border-b pb-2">
              <FileText className="w-5 h-5 opacity-80 mr-2" />
              Dados Fiscais e Família
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label className={labelClass}>Idade</label>
                <input type="number" value={profile.idade} onChange={e => updateProfile('idade', Number(e.target.value))} className={inputClass} min={18} max={100} />
              </div>
              <div>
                <label className={labelClass}>Estado Civil</label>
                <select value={profile.estadoCivil} onChange={e => updateProfile('estadoCivil', e.target.value)} className={inputClass}>
                  <option value="solteiro">Solteiro</option>
                  <option value="casado">Casado</option>
                  <option value="uniao_facto">União de Facto</option>
                  <option value="divorciado">Divorciado</option>
                  <option value="viuvo">Viúvo</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Nr. Dependentes</label>
                <input type="number" value={profile.nrDependentes} onChange={e => updateProfile('nrDependentes', Number(e.target.value))} className={inputClass} min={0} max={10} />
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-[8px] cursor-pointer">
                <input type="checkbox" checked={profile.cônjugeRendimentos} onChange={e => updateProfile('cônjugeRendimentos', e.target.checked)} className="w-4 h-4 accent-[#781D1D]" />
                <span className="text-[13px] font-[600] text-slate-700">Cônjuge c/ Rendimentos</span>
              </label>
              <label className="col-span-2 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-[8px] cursor-pointer">
                <input type="checkbox" checked={profile.beneficioJovem} onChange={e => updateProfile('beneficioJovem', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <span className="text-[13px] font-[600] text-blue-900">Benefício Jovem IRS (≤35 anos — CIRS Art. 12º-B)</span>
              </label>
            </div>
          </section>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto w-full flex flex-col gap-8 relative max-w-7xl mx-auto">
        <div>
          <h1 className="text-[32px] md:text-[40px] font-[800] tracking-[-1.5px] text-[#0F172A] leading-[1.1]">Resumo de Parâmetros</h1>
          <p className="text-[15px] font-[500] text-[#64748B] mt-1">Estes valores são aplicados automaticamente nos simuladores.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
            <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#781D1D]" />
              Dados Fiscais
            </h4>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between"><span className="text-slate-500">Regime IVA:</span><span className="font-[600] text-slate-800">{profile.regimeIva === 'isento' ? 'Isento' : profile.regimeIva === 'normal_mensal' ? 'Normal Mensal' : 'Normal Trimestral'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tipo Entidade:</span><span className="font-[600] text-slate-800 uppercase">{profile.tipoEntidade}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Atividade:</span><span className="font-[600] text-slate-800">{profile.atividadePrincipal === 'servicos' ? 'Serviços' : 'Bens'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Faturação Prevista:</span><span className="font-[600] text-slate-800">{ptEur(profile.faturaçaoAnualPrevista)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Início Atividade:</span><span className="font-[600] text-slate-800">{profile.inicioAtividade} ({currentYear - profile.inicioAtividade} anos)</span></div>
            </div>
          </div>

          <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
            <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-[#781D1D]" />
              Dados Familiares
            </h4>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between"><span className="text-slate-500">Idade:</span><span className="font-[600] text-slate-800">{profile.idade} anos</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Estado Civil:</span><span className="font-[600] text-slate-800 capitalize">{profile.estadoCivil.replace('_', ' ')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Dependentes:</span><span className="font-[600] text-slate-800">{profile.nrDependentes} {profile.nrDependentes > 0 && <span className="text-emerald-600 text-[12px]">(ded. €{profile.nrDependentes <= 3 ? profile.nrDependentes * 600 : 3 * 600 + (profile.nrDependentes - 3) * 900})</span>}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Benefício Jovem:</span><span className={cn("font-[600]", profile.beneficioJovem ? "text-blue-600" : "text-slate-800")}>{profile.beneficioJovem ? 'Sim — IRS Jovem ativo' : 'Não'}</span></div>
            </div>
          </div>

          <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
            <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-[#781D1D]" />
              Tickets / Vales
            </h4>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between"><span className="text-slate-500">Nr. Funcionários:</span><span className="font-[600] text-slate-800">{profile.nrFuncionarios}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Valor Unitário:</span><span className="font-[600] text-slate-800">{ptEur(profile.valorTicket)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Setor:</span><span className="font-[600] text-slate-800 capitalize">{profile.setorTicket}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Limite Legal:</span><span className="font-[600] text-slate-800">{profile.setorTicket === 'hotelaria' || profile.setorTicket === 'construcao' ? '€7,00' : '€5,00'}/dia</span></div>
            </div>
          </div>

          <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
            <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#781D1D]" />
              SS Independente
            </h4>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between"><span className="text-slate-500">Rendimento Mensal:</span><span className="font-[600] text-slate-800">{ptEur(profile.rendimentoMensalEni)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Regime:</span><span className="font-[600] text-slate-800 capitalize">{profile.regimeSs}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tipo Rendimento:</span><span className="font-[600] text-slate-800">{profile.tipoRendimentoSs === 'servicos' ? 'Serviços (70%)' : 'Bens (20%)'}</span></div>
            </div>
          </div>
        </div>

        {profile.morada && (
          <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
            <h4 className="text-[16px] font-[800] text-[#0F172A] mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#781D1D]" />
              Morada Registada
            </h4>
            <p className="text-[14px] text-slate-700 font-[500]">
              {profile.morada}{profile.codigoPostal ? `, ${profile.codigoPostal}` : ''}{profile.localidade ? ` ${profile.localidade}` : ''}
            </p>
          </div>
        )}

        <section className="mt-4 bg-amber-50 border border-amber-200 rounded-[20px] p-6">
          <h4 className="text-[16px] font-[800] text-amber-900 mb-4">Notas para o Contabilista</h4>
          <div className="space-y-3 text-[14px] text-amber-800">
            <p><strong>• Regra IVA (Art. 53º CIVA):</strong> Se a faturação é ≤15.000€ e só B2C, considere o regime isento.</p>
            <p><strong>• IRS Jovem (Art. 12º-B CIRS):</strong> Aplica-se até 35 anos nos primeiros 5 anos de atividade. Ano 1: 100%, Anos 2-3: 75%, Anos 4-5: 50% de isenção.</p>
            <p><strong>• Dependentes (Art. 78º-A CIRS):</strong> Dedução à coleta de €600/dependente (€900 a partir do 4.º).</p>
            <p><strong>• Tickets:</strong> Limite de €5/dia (€7 em hotelaria/construção). Dedutível a 60% para a empresa.</p>
            <p><strong>• SS Independente:</strong> Taxa de 21,4% sobre 70% (serviços) ou 20% (bens). Isenção no 1.º ano de atividade.</p>
            <p><strong>• Pagamentos por Conta (PPC):</strong> ENI com IRS significativo deve prever 3 prestações em julho, setembro e dezembro.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export const defaultProfile: ClientProfile = {
  nomeCliente: '',
  nif: '',
  email: '',
  telefone: '',
  morada: '',
  codigoPostal: '',
  localidade: '',
  regimeIva: 'normal_trimestral',
  cae: '',
  inicioAtividade: new Date().getFullYear(),
  atividadePrincipal: 'servicos',
  isSazonal: false,
  idade: 30,
  estadoCivil: 'solteiro',
  cônjugeRendimentos: false,
  nrDependentes: 0,
  beneficioJovem: false,
  tipoEntidade: 'eni',
  faturaçaoAnualPrevista: 60000,
  nrFuncionarios: 5,
  veiculos: [],
  tipoVale: 'refeicao',
  valorTicket: 5,
  limiteDeducao: 5,
  setorTicket: 'normal',
  rendimentoMensalEni: 800,
  regimeSs: 'general',
  tipoRendimentoSs: 'servicos'
};
