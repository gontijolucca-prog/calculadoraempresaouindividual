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
    const pw = doc.internal.pageSize.getWidth();   // 210
    const ph = doc.internal.pageSize.getHeight();  // 297
    const ml = 15; // margin left
    const mr = 15; // margin right
    const cw = pw - ml - mr; // content width = 180

    type RGB = [number, number, number];
    const MAROON: RGB = [120, 29, 29];
    const MAROON_LIGHT: RGB = [253, 242, 242];
    const SLATE_50: RGB = [248, 250, 252];
    const SLATE_200: RGB = [226, 232, 240];
    const SLATE_600: RGB = [71, 85, 105];
    const SLATE_900: RGB = [15, 23, 42];
    const WHITE: RGB = [255, 255, 255];
    const GREEN: RGB = [16, 185, 129];
    const RED_LIGHT: RGB = [239, 68, 68];

    const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
    const textC = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
    const drawC = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

    // ─── Helper utilities ────────────────────────────────────────────────────
    let page = 1;

    const addPageHeader = (title: string) => {
      fill(MAROON);
      doc.rect(0, 0, pw, 18, 'F');

      // Logotipo pequeno com fundo branco
      if (logoDataUrl) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(ml, 2, 10, 10, 1.5, 1.5, 'F');
        doc.addImage(logoDataUrl, 'PNG', ml + 0.5, 2.5, 9, 9);
      }

      textC(WHITE);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const textX = logoDataUrl ? ml + 12 : ml;
      doc.text('RECOFATIMA', textX, 8.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text('Contabilidade', textX, 13);

      doc.setFontSize(8);
      doc.text(title, pw / 2, 11, { align: 'center' });
      doc.text(`Pág. ${page}`, pw - mr, 11, { align: 'right' });
    };

    const addPageFooter = () => {
      fill(MAROON);
      doc.rect(0, ph - 12, pw, 12, 'F');
      textC(WHITE);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'Dados atualizados conforme OE 2026 • Este relatório é uma estimativa. Consulte o seu contabilista certificado.',
        pw / 2, ph - 5, { align: 'center' }
      );
    };

    const newPage = (title: string) => {
      addPageFooter();
      doc.addPage();
      page++;
      addPageHeader(title);
    };

    const sectionHeader = (y: number, label: string, color: RGB = MAROON) => {
      fill(color);
      doc.rect(ml, y, cw, 8, 'F');
      textC(WHITE);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(label.toUpperCase(), ml + 4, y + 5.5);
      return y + 8;
    };

    const row = (y: number, label: string, value: string, bold = false) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      textC(SLATE_600);
      doc.text(label, ml + 2, y + 4);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      textC(SLATE_900);
      doc.text(value, ml + 65, y + 4);
      return y + 7;
    };

    const twoColRow = (y: number, l1: string, v1: string, l2: string, v2: string) => {
      doc.setFontSize(9);
      const half = cw / 2;
      doc.setFont('helvetica', 'bold');
      textC(SLATE_600);
      doc.text(l1, ml + 2, y + 4);
      doc.setFont('helvetica', 'normal');
      textC(SLATE_900);
      // Truncar v1 para não sobrepor a segunda coluna
      const v1Lines = doc.splitTextToSize(v1, half - 54);
      doc.text(v1Lines[0] || '', ml + 50, y + 4);
      doc.setFont('helvetica', 'bold');
      textC(SLATE_600);
      doc.text(l2, ml + half + 2, y + 4);
      doc.setFont('helvetica', 'normal');
      textC(SLATE_900);
      // Truncar v2 para não sair da margem direita
      const v2Lines = doc.splitTextToSize(v2, half - 52);
      doc.text(v2Lines[0] || '', ml + half + 50, y + 4);
      return y + 7;
    };

    const divider = (y: number) => {
      drawC(SLATE_200);
      doc.line(ml, y, ml + cw, y);
      return y + 3;
    };

    const metricCard = (
      x: number, y: number, w: number, h: number,
      label: string, value: string,
      bgColor: RGB,
      textColor: RGB
    ) => {
      fill(bgColor);
      doc.roundedRect(x, y, w, h, 3, 3, 'F');
      textC(textColor);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(label.toUpperCase(), x + 3, y + 5);
      doc.setFontSize(12);
      doc.text(value, x + 3, y + 13);
    };

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 1 — CAPA E FICHA DO CLIENTE
    // ════════════════════════════════════════════════════════════════════════

    // Full-width maroon header
    fill(MAROON);
    doc.rect(0, 0, pw, 56, 'F');

    // Logotipo na capa com fundo branco arredondado
    if (logoDataUrl) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(ml, 10, 18, 16, 2, 2, 'F');
      doc.addImage(logoDataUrl, 'PNG', ml + 0.5, 10.5, 17, 15);
    }

    // RECOFATIMA name (ao lado do logo)
    const nameX = logoDataUrl ? ml + 21 : ml;
    textC(WHITE);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('RECOFATIMA', nameX, 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Contabilidade & Consultoria Fiscal', nameX, 30);

    doc.setFontSize(8.5);
    doc.text('Relatório de Simulação Fiscal • OE 2026', nameX, 38);

    // Date top-right
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const today = new Date();
    const dateStr = today.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(dateStr, pw - mr, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const refNum = `REF: ${profile.nif || 'N/D'}-${today.getFullYear()}`;
    doc.text(refNum, pw - mr, 30, { align: 'right' });
    doc.setLineWidth(0.2);

    let y = 64;

    // ── DADOS DO CLIENTE ──────────────────────────────────────────────────
    y = sectionHeader(y, 'Dados do Cliente');
    fill(SLATE_50);
    doc.rect(ml, y, cw, 50, 'F');

    y += 3;
    y = twoColRow(y, 'Nome / Empresa:', profile.nomeCliente || '—', 'NIF:', profile.nif || '—');
    y = twoColRow(y, 'Email:', profile.email || '—', 'Telefone:', profile.telefone || '—');
    if (profile.morada) {
      y = row(y, 'Morada:', `${profile.morada}${profile.codigoPostal ? `, ${profile.codigoPostal}` : ''}${profile.localidade ? ` ${profile.localidade}` : ''}`);
    }
    y = twoColRow(
      y,
      'Tipo de Entidade:',
      profile.tipoEntidade.toUpperCase(),
      'CAE:',
      profile.cae || '—'
    );
    y = twoColRow(
      y,
      'Início de Atividade:',
      profile.inicioAtividade.toString(),
      'Regime IVA:',
      profile.regimeIva === 'isento' ? 'Isento (Art. 53º)' :
        profile.regimeIva === 'normal_mensal' ? 'Normal Mensal' : 'Normal Trimestral'
    );
    y = twoColRow(
      y,
      'Tipo de Atividade:',
      profile.atividadePrincipal === 'servicos' ? 'Prestação de Serviços' : 'Venda de Bens',
      'Faturação Anual:',
      ptEur(profile.faturaçaoAnualPrevista)
    );
    y += 6;

    // ── DADOS PESSOAIS ────────────────────────────────────────────────────
    y = sectionHeader(y, 'Dados Pessoais e Familiares', [51, 65, 85]);
    fill(SLATE_50);
    doc.rect(ml, y, cw, 30, 'F');
    y += 3;
    y = twoColRow(y, 'Idade:', `${profile.idade} anos`, 'Estado Civil:', profile.estadoCivil.replace('_', ' '));
    y = twoColRow(
      y,
      'Dependentes:',
      `${profile.nrDependentes}`,
      'Cônjuge c/ Rendimentos:',
      profile.cônjugeRendimentos ? 'Sim' : 'Não'
    );
    y = twoColRow(
      y,
      'Benefício Jovem IRS:',
      profile.beneficioJovem ? 'Sim (≤35 anos)' : 'Não aplicável',
      'Atividade Sazonal:',
      profile.isSazonal ? 'Sim' : 'Não'
    );
    y += 6;

    // ── RESUMO EXECUTIVO (se taxState presente) ────────────────────────────
    if (taxState) {
      // Re-compute ENI vs LDA results
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
      let eniRendColetavel = taxState.rev * (taxState.isServices ? 0.75 : 0.15);
      const reqJust = taxState.isServices && taxState.rev > 27360 ? taxState.rev * 0.15 : 0;
      const justDocs = costsEni + 4104;
      if (reqJust > 0 && justDocs < reqJust) eniRendColetavel += reqJust - justDocs;

      // IRS Jovem
      let irsJovemDeduction = 0;
      if (profile.beneficioJovem && profile.idade <= 35) {
        irsJovemDeduction = calcIRSJovem(taxState.anosAtividade || 0, eniRendColetavel, profile.idade);
        eniRendColetavel = Math.max(0, eniRendColetavel - irsJovemDeduction);
      }

      const eniIRS_Total = calculateIRS(taxState.currentInc + eniRendColetavel);
      const eniIRS_Current = calculateIRS(taxState.currentInc);
      let eniIRS = Math.max(0, eniIRS_Total - eniIRS_Current);
      const depsDeduction = calcDependentsDeduction(profile.nrDependentes);
      eniIRS = Math.max(0, eniIRS - depsDeduction);
      const eniNet = taxState.rev - costsEni - eniSS - eniIRS;

      const rawGross = taxState.monthlyNeed / 0.70;
      const grossSalaryYr = rawGross * 14;
      const ldaSSComp = grossSalaryYr * 0.2375;
      const ldaSSMgr = grossSalaryYr * 0.11;
      const ldaIRS = calculateIRS(grossSalaryYr);
      const profit = taxState.rev - costsLda - dpNaoAceite - grossSalaryYr - ldaSSComp;
      const irc = calculateIRC(profit);
      const companyNet = profit - irc;
      const ldaNet = companyNet + taxState.monthlyNeed * 12;

      const winner = ldaNet > eniNet ? 'LDA' : 'ENI';
      const diff = Math.abs(ldaNet - eniNet);

      y = sectionHeader(y, 'Resumo Executivo — Recomendação', winner === 'LDA' ? MAROON : [5, 150, 105] as const);
      fill(winner === 'LDA' ? MAROON_LIGHT : [236, 253, 245] as RGB);
      doc.rect(ml, y, cw, 20, 'F');
      y += 4;
      textC(winner === 'LDA' ? MAROON : [5, 150, 105] as RGB);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Regime Ideal: ${winner === 'LDA' ? 'Sociedade (Lda / Unipessoal)' : 'Trabalhador Independente (ENI)'}`,
        ml + 3, y + 5
      );
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Vantagem face à alternativa: ${ptEur(diff)}/ano adicional`,
        ml + 3, y + 12
      );
      y += 20;

      // Two metric cards
      const cardW = (cw - 5) / 2;
      metricCard(ml, y, cardW, 18, 'Net Income ENI', ptEur(eniNet), [236, 253, 245], [5, 150, 105]);
      metricCard(ml + cardW + 5, y, cardW, 18, 'Net Income Lda', ptEur(ldaNet), MAROON_LIGHT, MAROON);
      y += 22;
    }

    addPageFooter();

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 2 — ENQUADRAMENTO FISCAL DETALHADO
    // ════════════════════════════════════════════════════════════════════════
    if (taxState) {
      newPage('Enquadramento Fiscal — ENI vs Sociedade');
      y = 24;

      // Re-compute (same as above — kept separate for clarity)
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
      let eniRendColetavel = taxState.rev * (taxState.isServices ? 0.75 : 0.15);
      const reqJust = taxState.isServices && taxState.rev > 27360 ? taxState.rev * 0.15 : 0;
      const justDocs = costsEni + 4104;
      if (reqJust > 0 && justDocs < reqJust) eniRendColetavel += reqJust - justDocs;

      let irsJovemDeduction = 0;
      if (profile.beneficioJovem && profile.idade <= 35) {
        irsJovemDeduction = calcIRSJovem(taxState.anosAtividade || 0, eniRendColetavel, profile.idade);
        eniRendColetavel = Math.max(0, eniRendColetavel - irsJovemDeduction);
      }

      const eniIRS_Total = calculateIRS(taxState.currentInc + eniRendColetavel);
      const eniIRS_Current = calculateIRS(taxState.currentInc);
      const depsDeduction = calcDependentsDeduction(profile.nrDependentes);
      let eniIRS = Math.max(0, eniIRS_Total - eniIRS_Current - depsDeduction);
      const eniNet = taxState.rev - costsEni - eniSS - eniIRS;
      const eniCashFlow = eniNet - totalInv;
      const ppc = eniIRS * 0.25;

      const rawGross = taxState.monthlyNeed / 0.70;
      const grossSalaryYr = rawGross * 14;
      const ldaSSComp = grossSalaryYr * 0.2375;
      const ldaSSMgr = grossSalaryYr * 0.11;
      const ldaIRS = calculateIRS(grossSalaryYr);
      const profit = taxState.rev - costsLda - dpNaoAceite - grossSalaryYr - ldaSSComp;
      const irc = calculateIRC(profit);
      const companyNet = profit - irc;
      const ldaNet = companyNet + taxState.monthlyNeed * 12;
      const ldaCashFlow = (companyNet + dpNaoAceite) - totalInv;

      const winner = ldaNet > eniNet ? 'LDA' : 'ENI';

      // Comparison table header
      const half = cw / 2;
      fill(MAROON);
      doc.rect(ml, y, half - 2, 10, 'F');
      doc.setFillColor(51, 65, 85);
      doc.rect(ml + half, y, half, 10, 'F');
      textC(WHITE);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('ENI (Recibos Verdes)', ml + 4, y + 7);
      doc.text('Sociedade (Lda / Unipessoal)', ml + half + 4, y + 7);
      y += 10;

      // ENI vs LDA rows
      const compRow = (
        yPos: number,
        labelEni: string, valEni: string,
        labelLda: string, valLda: string,
        shade: boolean
      ) => {
        if (shade) {
          fill(SLATE_50);
          doc.rect(ml, yPos, cw, 7.5, 'F');
        }
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        textC(SLATE_600);
        doc.text(labelEni, ml + 2, yPos + 5);
        doc.setFont('helvetica', 'normal');
        textC(SLATE_900);
        doc.text(valEni, ml + half - 4, yPos + 5, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        textC(SLATE_600);
        doc.text(labelLda, ml + half + 2, yPos + 5);
        doc.setFont('helvetica', 'normal');
        textC(SLATE_900);
        doc.text(valLda, ml + cw, yPos + 5, { align: 'right' });
        return yPos + 7.5;
      };

      y = compRow(y, 'Faturação:', ptEur(taxState.rev), 'Faturação:', ptEur(taxState.rev), false);
      y = compRow(y, 'Custos & Contabilidade:', ptEur(costsEni), 'Custos & Contabilidade:', ptEur(costsLda), true);
      y = compRow(y, 'Segurança Social (21,4%):', ptEur(eniSS), 'TSU Empresa (23,75%):', ptEur(ldaSSComp), false);
      if (irsJovemDeduction > 0) {
        y = compRow(y, 'Isenção IRS Jovem:', `- ${ptEur(irsJovemDeduction)}`, '—', '—', true);
      }
      if (depsDeduction > 0) {
        y = compRow(y, `Ded. Dependentes (${profile.nrDependentes}):`, `- ${ptEur(depsDeduction)}`, '—', '—', irsJovemDeduction === 0);
      }
      y = compRow(y, 'IRS (agravado c/ atividade):', ptEur(eniIRS), 'TSU Gestor (11%):', ptEur(ldaSSMgr), false);
      y = compRow(y, '—', '—', 'IRC (15%/19%):', ptEur(irc), true);

      // Divider
      drawC(MAROON);
      doc.setLineWidth(0.8);
      doc.line(ml, y, ml + cw, y);
      y += 2;
      doc.setLineWidth(0.2);

      // Net totals
      fill(winner === 'ENI' ? [236, 253, 245] as RGB : SLATE_50);
      doc.rect(ml, y, half - 2, 14, 'F');
      fill(winner === 'LDA' ? MAROON_LIGHT : SLATE_50);
      doc.rect(ml + half, y, half, 14, 'F');

      textC(winner === 'ENI' ? [5, 150, 105] as RGB : SLATE_900);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('RENDIMENTO LÍQUIDO ANUAL', ml + 2, y + 5);
      doc.setFontSize(13);
      doc.text(ptEur(eniNet), ml + 4, y + 12);

      textC(winner === 'LDA' ? MAROON : SLATE_900);
      doc.setFontSize(8);
      doc.text('RENDIMENTO LÍQUIDO ANUAL', ml + half + 2, y + 5);
      doc.setFontSize(13);
      doc.text(ptEur(ldaNet), ml + half + 4, y + 12);

      if (winner === 'ENI') {
        doc.setFontSize(7);
        doc.setTextColor(5, 150, 105);
        doc.text('✓ MELHOR OPÇÃO', ml + cw - 30, y + 12, { align: 'right' });
      } else {
        doc.setFontSize(7);
        textC(MAROON);
        doc.text('✓ MELHOR OPÇÃO', ml + cw, y + 12, { align: 'right' });
      }
      y += 17;

      // Cash flow and break-even
      const cardW = (cw - 4) / 2;
      metricCard(ml, y, cardW, 18, 'Cash-Flow Livre ENI (Ano 1)', ptEur(eniCashFlow), [236, 253, 245], [5, 150, 105]);
      metricCard(ml + cardW + 4, y, cardW, 18, 'Cash-Flow Holding Lda (Ano 1)', ptEur(ldaCashFlow), MAROON_LIGHT, MAROON);
      y += 22;

      // PPC info
      if (ppc > 0) {
        doc.setFillColor(255, 251, 235);
        doc.rect(ml, y, cw, 12, 'F');
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.3);
        doc.rect(ml, y, cw, 12);
        doc.setTextColor(146, 64, 14);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('⚠ Pagamentos por Conta (PPC) estimados:', ml + 3, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `3 prestações de aprox. ${ptEur(ppc / 3)} (julho, setembro, dezembro) — total estimado: ${ptEur(ppc)}`,
          ml + 3, y + 10
        );
        y += 15;
        doc.setLineWidth(0.2);
      }

      // IVA advice
      fill(SLATE_50);
      doc.rect(ml, y, cw, 20, 'F');
      drawC(SLATE_200);
      doc.rect(ml, y, cw, 20);
      textC(MAROON);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Parecer Tributário — IVA', ml + 3, y + 6);
      doc.setFont('helvetica', 'normal');
      textC(SLATE_900);
      doc.setFontSize(8);
      const ivaText = taxState.rev <= 15000 && !taxState.b2b
        ? `Com faturação ≤15.000€ e mercado B2C, é possível ativar a isenção do Art. 53º do CIVA. Preços sem IVA = mais competitivos.`
        : `Com este volume e mercado ${taxState.b2b ? 'B2B' : 'B2C'}, o enquadramento no Regime Normal de IVA é obrigatório e vantajoso para dedução de despesas.`;
      const ivaLines = doc.splitTextToSize(ivaText, cw - 8);
      doc.text(ivaLines, ml + 3, y + 12);
      y += 24;
    }

    addPageFooter();

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 3 — VIATURAS (se disponível)
    // ════════════════════════════════════════════════════════════════════════
    if (vehicleState) {
      newPage('Viaturas Ligeiras — IVA e Tributação Autónoma');
      y = 24;

      const maintBase = vehicleState.maintenanceCost / 1.23;
      const maintIva = vehicleState.maintenanceCost - maintBase;
      const fuelBase = vehicleState.fuelCost / 1.23;
      const fuelIva = vehicleState.fuelCost - fuelBase;
      const isExemptActivity = ['public_transport', 'rent_a_car', 'driving_school'].includes(vehicleState.activity);

      let ivaAqRate = 0;
      const totalIvaAq = vehicleState.price * 0.23;
      if (vehicleState.ivaRegime === 'normal') {
        if (isExemptActivity) ivaAqRate = 1;
        else if (vehicleState.category === 'passageiros') {
          if (vehicleState.engineType === 'electric') ivaAqRate = vehicleState.price <= 62500 ? 1 : 0;
          else if (vehicleState.engineType === 'phev' && vehicleState.phevCompliant) ivaAqRate = vehicleState.price <= 50000 ? 1 : 0;
          else if (['lpg', 'cng'].includes(vehicleState.engineType)) ivaAqRate = vehicleState.price <= 37500 ? 0.5 : 0;
        } else if (vehicleState.category === 'comercial') {
          ivaAqRate = ['electric', 'phev', 'lpg', 'cng'].includes(vehicleState.engineType) ? 1 : 0.5;
        }
      }
      const ivaAqDed = totalIvaAq * ivaAqRate;
      const maintIvaDed = (isExemptActivity || vehicleState.category === 'comercial') ? maintIva : 0;
      let fuelIvaRate = 0;
      if (isExemptActivity) fuelIvaRate = 1;
      else if (vehicleState.engineType === 'electric') fuelIvaRate = 1;
      else if (['diesel', 'lpg', 'cng'].includes(vehicleState.engineType)) fuelIvaRate = 0.5;
      const fuelIvaDed = fuelIva * fuelIvaRate;
      const ivaTotalDed = ivaAqDed + maintIvaDed + fuelIvaDed;

      const depAnual = vehicleState.price * 0.25;
      let limit = 25000;
      if (vehicleState.engineType === 'electric') limit = 62500;
      else if (vehicleState.engineType === 'phev' && vehicleState.phevCompliant) limit = 50000;
      else if (['lpg', 'cng'].includes(vehicleState.engineType)) limit = 37500;
      if (isExemptActivity) limit = Infinity;
      const depAceite = limit === Infinity ? depAnual : Math.min(vehicleState.price, limit) * 0.25;
      const depNaoAceite = Math.max(0, depAnual - depAceite);

      const totalEncsTA = depAnual + (vehicleState.maintenanceCost - maintIvaDed) + vehicleState.insuranceCost + (vehicleState.fuelCost - fuelIvaDed);
      let taRate = 0;
      if (vehicleState.category === 'passageiros' && !vehicleState.exemptTA) {
        if (vehicleState.engineType === 'electric') taRate = vehicleState.price >= 62500 ? 0.10 : 0;
        else if (vehicleState.engineType === 'phev' && vehicleState.phevCompliant)
          taRate = vehicleState.price < 27500 ? 0.025 : vehicleState.price < 35000 ? 0.075 : 0.15;
        else
          taRate = vehicleState.price < 27500 ? 0.085 : vehicleState.price < 35000 ? 0.255 : 0.325;
      }
      const taValue = totalEncsTA * taRate;

      // Vehicle info header
      y = sectionHeader(y, `${vehicleState.category === 'passageiros' ? 'Ligeiro de Passageiros' : 'Veículo Comercial (2/3 lugares)'} — ${vehicleState.engineType.toUpperCase()}`);
      fill(SLATE_50);
      doc.rect(ml, y, cw, 14, 'F');
      y += 3;
      y = twoColRow(y, 'Preço Aquisição (s/ IVA):', ptEur(vehicleState.price), 'Regime Aquisição:', vehicleState.ivaRegime === 'normal' ? 'Compra Nova c/ IVA' : vehicleState.ivaRegime === 'second_hand' ? '2ª Mão' : 'Leasing/Renting');
      y = twoColRow(y, 'IVA Aquisição Total:', ptEur(totalIvaAq), 'Atividade Associada:', vehicleState.activity === 'other' ? 'Geral' : vehicleState.activity);
      y += 5;

      // Side by side cards
      const cardW = (cw - 5) / 2;

      // IVA card
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(ml, y, cardW, 52, 3, 3, 'F');
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('IVA RECUPERÁVEL', ml + 3, y + 7);
      doc.setFontSize(16);
      doc.text(ptEur(ivaTotalDed), ml + 3, y + 16);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      textC(SLATE_900);
      const ivaRows = [
        ['IVA Aquisição:', ptEur(ivaAqDed), `(${ptPct(ivaAqRate)} de ${ptEur(totalIvaAq)})`],
        ['IVA Manutenção:', ptEur(maintIvaDed), ''],
        ['IVA Combustível:', ptEur(fuelIvaDed), ''],
        ['Seguro (isento IVA):', '€0,00', ''],
      ];
      let ry = y + 23;
      ivaRows.forEach(([l, v, note]) => {
        textC(SLATE_600);
        doc.setFont('helvetica', 'bold');
        doc.text(l, ml + 3, ry);
        doc.setFont('helvetica', 'normal');
        textC(SLATE_900);
        doc.text(v, ml + cardW - 3, ry, { align: 'right' });
        if (note) {
          doc.setFontSize(6.5);
          textC(SLATE_600);
          doc.text(note, ml + 3, ry + 3.5);
          doc.setFontSize(8);
        }
        ry += 8;
      });

      // TA card
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(ml + cardW + 5, y, cardW, 52, 3, 3, 'F');
      textC(RED_LIGHT);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('TRIBUTAÇÃO AUTÓNOMA', ml + cardW + 8, y + 7);
      doc.setFontSize(16);
      doc.setTextColor(185, 28, 28);
      doc.text(ptEur(taValue), ml + cardW + 8, y + 16);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      textC(SLATE_900);
      const taRows = [
        ['Taxa aplicada:', `${(taRate * 100).toFixed(1)}%`],
        ['Encargos sujeitos a TA:', ptEur(totalEncsTA)],
        ['Depreciação anual (25%):', ptEur(depAnual)],
        ['Depreciação não aceite:', ptEur(depNaoAceite)],
        ['Limite fiscal:', limit === Infinity ? 'Ilimitado' : ptEur(limit)],
      ];
      ry = y + 23;
      taRows.forEach(([l, v]) => {
        textC(SLATE_600);
        doc.setFont('helvetica', 'bold');
        doc.text(l, ml + cardW + 8, ry);
        doc.setFont('helvetica', 'normal');
        textC(SLATE_900);
        doc.text(v, ml + cw, ry, { align: 'right' });
        ry += 8;
      });
      y += 56;
    }

    if (vehicleState) addPageFooter();

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 4 — BENEFÍCIOS E SS INDEPENDENTE
    // ════════════════════════════════════════════════════════════════════════
    if (ticketState || ssState) {
      newPage('Benefícios Laborais e Segurança Social');
      y = 24;

      if (ticketState) {
        const limiteSetor = profile.setorTicket === 'hotelaria' || profile.setorTicket === 'construcao' ? 7 : 5;
        const res = calcTicketSavings(ticketState.employees, ticketState.ticketValue, ticketState.daysPerMonth, ticketState.months);

        y = sectionHeader(y, 'Tickets de Refeição — Benefícios Fiscais');
        fill(SLATE_50);
        doc.rect(ml, y, cw, 11, 'F');
        y += 2;
        y = twoColRow(y, 'Funcionários:', `${ticketState.employees}`, 'Valor diário:', ptEur(ticketState.ticketValue));
        y = twoColRow(y, 'Dias por mês:', `${ticketState.daysPerMonth}`, 'Meses:', `${ticketState.months}`);
        y += 4;

        const cardW = (cw - 4) / 3;
        metricCard(ml, y, cardW, 22, 'Custo Total Tickets/Ano', ptEur(res.ticketCost), [239, 246, 255], [37, 99, 235]);
        metricCard(ml + cardW + 2, y, cardW, 22, 'Poupança SS (23,75%)/Ano', ptEur(res.savings), [236, 253, 245], [5, 150, 105]);
        metricCard(ml + (cardW + 2) * 2, y, cardW, 22, 'Custo Dedutível (60%)/Ano', ptEur(res.custoDedutivelEmpresa), MAROON_LIGHT, MAROON);
        y += 26;

        if (ticketState.ticketValue > limiteSetor) {
          doc.setFillColor(254, 242, 242);
          doc.rect(ml, y, cw, 10, 'F');
          doc.setTextColor(185, 28, 28);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(`⚠ Valor diário (${ptEur(ticketState.ticketValue)}) excede o limite legal de ${ptEur(limiteSetor)}/dia para o setor "${profile.setorTicket}". O excedente é tributável.`, ml + 3, y + 6);
          y += 13;
        }
      }

      if (ssState) {
        y += 4;
        y = sectionHeader(y, 'Segurança Social — Trabalhador Independente (ENI)', [51, 65, 85] as const);
        const ssRes = calcSelfSSContribution(ssState.income, ssState.tipoRendimento, ssState.primeiroAno);

        fill(SLATE_50);
        doc.rect(ml, y, cw, 10, 'F');
        y += 2;
        y = twoColRow(y, 'Rendimento mensal:', ptEur(ssState.income), 'Tipo:', ssState.tipoRendimento === 'servicos' ? 'Serviços (base 70%)' : 'Bens (base 20%)');
        y = twoColRow(y, 'Base de cálculo (€):', ptEur(ssRes.baseCalculo), 'Taxa:', '21,4%');
        y += 4;

        const cardW = (cw - 4) / 3;
        if (ssRes.isento) {
          doc.setFillColor(236, 253, 245);
          doc.roundedRect(ml, y, cw, 18, 3, 3, 'F');
          doc.setTextColor(5, 150, 105);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('✓ ISENTO — 1º Ano de Atividade (Art. 164º CRCSPSS)', ml + 4, y + 11);
          y += 22;
        } else {
          metricCard(ml, y, cardW, 22, 'Contribuição Mensal', ptEur(ssRes.mensal), [239, 246, 255], [37, 99, 235]);
          metricCard(ml + cardW + 2, y, cardW, 22, 'Contribuição Trimestral', ptEur(ssRes.trimestral), MAROON_LIGHT, MAROON);
          metricCard(ml + (cardW + 2) * 2, y, cardW, 22, 'Contribuição Anual', ptEur(ssRes.anual), [254, 242, 242], [185, 28, 28]);
          y += 26;
          doc.setFillColor(255, 251, 235);
          doc.rect(ml, y, cw, 10, 'F');
          doc.setTextColor(146, 64, 14);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text('Pagamento trimestral: janeiro, abril, julho e outubro (até dia 20 do mês seguinte ao trimestre).', ml + 3, y + 6);
          y += 13;
        }
      }
      addPageFooter();
    }

    // ════════════════════════════════════════════════════════════════════════
    // ÚLTIMA PÁGINA — NOTAS LEGAIS E DISCLAIMER
    // ════════════════════════════════════════════════════════════════════════
    newPage('Base Legal e Notas');
    y = 24;

    y = sectionHeader(y, 'Legislação de Referência — Simuladores Recofatima 2026');
    fill(SLATE_50);
    doc.rect(ml, y, cw, 120, 'F');
    y += 4;

    const legalItems = [
      ['IRS — Escalões 2026', 'CIRS Art. 68º — Taxas de 13% a 48% (OE 2026, validado abril 2026)'],
      ['IRS Jovem', 'CIRS Art. 12º-B — Isenção progressiva ≤35 anos nos primeiros 5 anos (OE 2025)'],
      ['Ded. Dependentes', 'CIRS Art. 78º-A — €600/dependente (€900 a partir do 4.º)'],
      ['Regime Simplificado ENI', 'CIRS Art. 31º — Coeficientes: 75% serviços, 15% bens'],
      ['IRC — PME', 'CIRC Art. 87º — Taxa reduzida 15% (primeiros €50k) / 19% restante'],
      ['TSU Patronal', 'Código Contributivo (Lei 110/2009) — 23,75% (empresa) + 11% (trabalhador)'],
      ['SS Independente', 'CRCSPSS Art. 162º — Taxa 21,4% sobre 70% (serviços) / 20% (bens)'],
      ['SS — Isenção 1º ano', 'CRCSPSS Art. 164º — Isenção de 12 meses no início de atividade'],
      ['IVA Normal', 'CIVA — Taxa standard 23% (Portugal Continental)'],
      ['IVA Isenção PME', 'CIVA Art. 53º — Isenção p/ faturação <€15.000, exclusivamente B2C'],
      ['IVA Viaturas', 'CIVA Art. 21º, n.º 1 — Dedução 100%/50%/0% conforme tipo de motor'],
      ['Tributação Autónoma', 'CIRC Art. 88º, n.º 3 — TA escalonada p/ viaturas passageiros'],
      ['TA Viaturas Elétricas', 'Lei n.º 82/2023 — TA 10% p/ elétricos com custo >€62.500'],
      ['Depreciação Viaturas', 'DR 25/2009 + OE 2026 — Limites €25k/€50k/€62,5k conforme motor'],
      ['Tickets de Refeição', 'DL 133/2024 — Limite €5,00/dia (geral) ou €7,00/dia (hotelaria/construção)'],
      ['Tickets — Dedutibilidade', 'CIRC Art. 43º — 60% do custo total dedutível para a empresa'],
      ['Tickets — SS e IRS', 'EBF Art. 18º-A — Isenção SS e IRS para o trabalhador (até ao limite)'],
    ];

    legalItems.forEach(([topic, desc], i) => {
      if (i % 2 === 0) {
        doc.setFillColor(241, 245, 249);
        doc.rect(ml, y - 1, cw, 8, 'F');
      }
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      textC(MAROON);
      doc.text(topic, ml + 2, y + 4);
      doc.setFont('helvetica', 'normal');
      textC(SLATE_900);
      doc.text(desc, ml + 52, y + 4);
      y += 8;
    });

    y += 6;

    // Disclaimer box
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.5);
    doc.roundedRect(ml, y, cw, 28, 3, 3, 'FD');
    doc.setLineWidth(0.2);
    doc.setTextColor(120, 53, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Nota Importante — Limitações desta Simulação', ml + 4, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const disclaimer = 'Este relatório é uma estimativa baseada nos dados fornecidos e na legislação fiscal em vigor em abril de 2026. Os resultados não constituem aconselhamento jurídico ou fiscal vinculativo. Situações específicas (deduções adicionais, benefícios regionais, acordos de dupla tributação, entre outros) podem alterar os valores calculados. Consulte sempre um contabilista certificado (OCC) antes de tomar decisões fiscais.';
    const disclaimerLines = doc.splitTextToSize(disclaimer, cw - 8);
    doc.text(disclaimerLines, ml + 4, y + 15);
    y += 32;

    // Contact / branding footer com logo
    fill(MAROON);
    doc.rect(ml, y, cw, 18, 'F');
    if (logoDataUrl) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(ml + 3, y + 2, 11, 10, 1.5, 1.5, 'F');
      doc.addImage(logoDataUrl, 'PNG', ml + 3.5, y + 2.5, 10, 9);
    }
    textC(WHITE);
    const brandX = logoDataUrl ? ml + 17 : ml + 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('RECOFATIMA Contabilidade', brandX, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Relatório gerado em ${dateStr} • OE 2026`, brandX, y + 13);

    addPageFooter();

    // ── SAVE ──────────────────────────────────────────────────────────────
    doc.save(`Relatorio_Recofatima_${profile.nomeCliente || 'Cliente'}_2026.pdf`);
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
