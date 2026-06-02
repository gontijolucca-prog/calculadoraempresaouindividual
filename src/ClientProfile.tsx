import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { User, Building2, FileText, Ticket, Wallet, MapPin } from 'lucide-react';
import { FlowWizard, type FlowStep } from './FlowWizard';
import { useFlowMode } from './AnimatedPage';
import { Tip } from './Tip';
import { jsPDF } from 'jspdf';
import ExportPackageModal from './ExportPackageModal';
import { consumeOpenPackage, consumeFlowToggle } from './lib/profileIntent';
import type { OfficeSettings } from './lib/officeSettings';
import type { HonorariosConfig } from './lib/honorarios';

// Converte o SVG do logotipo para PNG data URL via canvas
const svgLogoToPng = (): Promise<string> => {
  return new Promise((resolve) => {
    const svgContent = `<svg viewBox="0 0 100 100" width="400" height="400" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="white"/><path d="M 70 20 A 35 35 0 1 1 35 22" stroke="#0677FF" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M 60 10 L 70 20 L 60 30" stroke="#0B1D2D" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="50" y="64" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="#0B1D2D" text-anchor="middle">360</text></svg>`;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(''); return; }
    const img = new Image();
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 400, 400);
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
  IAS_2026,
  coefFromProfile,
} from './lib/pt2026';

// Dedução específica Cat A 2026 (8,54 × IAS) — usada no preview do imposto.
const DED_ESPECIFICA_CAT_A_2026 = Math.round(8.54 * IAS_2026 * 100) / 100; // 4587.09

/**
 * Validação de NIF (Número de Identificação Fiscal) PT.
 * 9 dígitos; primeiro dígito ∈ {1,2,3,4,5,6,7,8,9} (0 não é atribuído);
 * último dígito é checksum mod-11. Rejeita também "000000000" (passaria a
 * checksum por coincidência).
 */
function isValidNIFPT(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  if (nif[0] === '0') return false;
  if (/^0+$/.test(nif)) return false;
  let total = 0;
  for (let i = 0; i < 8; i++) total += parseInt(nif[i], 10) * (9 - i);
  const mod = total % 11;
  const check = mod < 2 ? 0 : 11 - mod;
  return check === parseInt(nif[8], 10);
}

export interface ClientProfile {
  // ─── 1. Identificação & dados base (steps 1-3) ──────────────────────────
  nomeCliente: string;
  nif: string;
  email: string;
  telefone: string;
  morada: string;
  codigoPostal: string;
  localidade: string;
  regimeIva: 'isento' | 'normal_mensal' | 'normal_trimestral' | 'pequenos_retalhistas';
  regimeContabilidade: 'simplificado' | 'organizada' | 'transparencia_fiscal' | 'nao_residente' | 'retgs';
  cae: string;
  inicioAtividade: number;
  atividadePrincipal: 'servicos' | 'bens' | 'servicos_outros' | 'vendas_restauracao' | 'servicos_listados' | 'mining_cripto';
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

  // ─── 2. Diagnóstico aprofundado (steps 4-6, absorvido da antiga Ficha) ─
  custos: {
    mercadorias: number; rendas: number; combustiveis: number; viaturas: number;
    equipamentos: number; servicosExternos: number; outros: number;
  };
  investimento: {
    equipamentos: number; viaturas: number; obras: number; stock: number; outro: number;
  };
  viaturasDiag: {
    tem: 'sim' | 'nao' | '';
    tipo: { comercial: boolean; passageiros: boolean; eletrico: boolean; hibrido: boolean };
    valor: number;
  };
  societaria: {
    capitalSocial: number;
    numeroSocios: number;
    socios: Array<{ nome: string; percentagem: number }>;
    gerencia: 'um' | 'varios' | '';
    gerenteNome: string;
  };
  distribuicao: { salario: boolean; dividendos: boolean; reinvestir: boolean; misto: boolean };
  fiscalAtual: {
    dividasFiscais: 'sim' | 'nao' | '';
    dividasSS: 'sim' | 'nao' | '';
    execucoesFiscais: 'sim' | 'nao' | '';
  };
  objetivos: {
    menosImpostos: boolean; crescer: boolean; imobiliario: boolean;
    variasEmpresas: boolean; planeamentoFamiliar: boolean;
  };
  intencoes: {
    imoveis: boolean; viaturasEmpresa: boolean; ativosFinanceiros: boolean;
    grupoEmpresas: boolean; internacionalizar: boolean;
  };
  documentos: {
    irs: boolean; balancete: boolean; ies: boolean; modelo22: boolean;
    dec_iva: boolean; contratos: boolean; extratos: boolean;
  };
  analiseInterna: {
    eniVsLda: string; simplifVsOrganizada: string; art53VsNormal: string;
    salarioVsDividendos: string; planeamento: string; observacoes: string; recomendacoes: string;
  };
  // ─── 3. Contabilidade / Demonstrações Financeiras ────────────────────────
  // Valores do Balanço, imposto e tesouraria usados para preencher os documentos
  // (Balanço, Demonstração de Resultados, Fluxos de Caixa, Alterações no Capital
  // Próprio). Preenchidos automaticamente a partir do SAF-T (classes 1–5/8) ou
  // inseridos à mão. Saldos de FECHO do período (em euros).
  contabilidade: ContabilidadeData;
}

export interface ContabilidadeData {
  // Balanço — Ativo
  ativoFixoTangivel: number;          // 43
  ativoIntangivel: number;            // 44
  investimentosFinanceiros: number;   // 41/42
  inventarios: number;                // classe 3
  clientes: number;                   // 21 (saldo devedor)
  estadoOutrosAtivo: number;          // 24 a recuperar (devedor)
  outrosAtivosCorrentes: number;      // 27/28 etc.
  caixaDepositos: number;             // 11/12/13 — caixa no FIM do período
  // Balanço — Capital próprio
  capitalRealizado: number;           // 51
  reservasResultadosTransitados: number; // 55/56
  resultadoLiquido: number;           // 818 — também usado na DR e na Acta
  outrasVariacoesCapital: number;     // prémios, excedentes, ajustamentos
  // Balanço — Passivo
  financiamentosObtidos: number;      // 25
  fornecedores: number;               // 22 (saldo credor)
  estadoOutrosPassivo: number;        // 24 a pagar (credor)
  outrosPassivos: number;             // 27/28 credor
  // Demonstração de Resultados — completar
  impostoRendimento: number;          // 812 — imposto sobre o rendimento do período
  // Fluxos de Caixa
  caixaInicio: number;                // 11/12/13 no INÍCIO do período
  // meta
  saftImportado: boolean;             // último preenchimento veio do SAF-T
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
  office?: OfficeSettings;
  honorarios?: HonorariosConfig;
  onGoToOfficeSettings?: () => void;
}

const inputClass = "w-full pl-[16px] pr-[16px] py-[12px] bg-[#F5F7FA] border-2 border-[#E2E8F0] rounded-[8px] text-[15px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
const labelClass = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[8px]";

const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);
const ptPct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function ClientProfile({
  profile, onChange, taxState, vehicleState, ticketState, ssState,
  office, honorarios, onGoToOfficeSettings,
}: Props) {
  const [showPackage, setShowPackage] = useState(false);

  const updateProfile = (field: keyof ClientProfile, value: any) => {
    onChange({ ...profile, [field]: value });
  };

  // Regime de IVA automático pela faturação anual:
  //  • ≤ 15.000€  → Isento (Art. 53.º CIVA);
  //  • > 650.000€ → Normal MENSAL obrigatório (Art. 41.º n.º 1 al. a) CIVA);
  //  • entre os dois → Normal trimestral.
  // Só corrige automaticamente quem está num regime "errado" para o escalão
  // (isento acima de 15k, ou mensal/isento na faixa trimestral); não mexe numa
  // escolha deliberada de trimestral nem no regime de pequenos retalhistas.
  const ivaForFat = (regimeIva: ClientProfile['regimeIva'], fat: number): Partial<ClientProfile> => {
    if (fat <= 0) return {};
    if (fat <= 15000) return regimeIva === 'isento' ? {} : { regimeIva: 'isento' };
    if (fat > 650000) return regimeIva === 'normal_mensal' ? {} : { regimeIva: 'normal_mensal' };
    if (regimeIva === 'isento' || regimeIva === 'normal_mensal') return { regimeIva: 'normal_trimestral' };
    return {};
  };

  // Acima de €200.000 de faturação o ENI deixa de poder usar o regime
  // simplificado (recibos verdes) — passa obrigatoriamente a contabilidade
  // organizada (Art. 28.º/31.º CIRS). NÃO obriga a constituir sociedade: o ENI
  // continua legal a qualquer nível de faturação, só muda de regime contabilístico.
  const regimeForFat = (tipoEntidade: string, regime: string, fat: number): Partial<ClientProfile> =>
    tipoEntidade === 'eni' && regime === 'simplificado' && fat > 200000
      ? { regimeContabilidade: 'organizada' }
      : {};

  const currentYear = new Date().getFullYear();
  const { flowMode, exitFlow } = useFlowMode();

  // Acção "Exportar documentos" disparada pela sidebar. O toggle de Vista
  // simplificada/detalhada é tratado pelo bus global em useFlowMode.
  useEffect(() => {
    const onPackage = () => setShowPackage(true);
    window.addEventListener('profile:openPackage', onPackage);
    // Consome intenções que a sidebar registou ANTES deste componente montar
    // (clicar "Exportar documentos" / toggle de vista vindo de outra vista).
    // Sem race: não depende de timing de montagem.
    if (consumeOpenPackage()) setShowPackage(true);
    if (consumeFlowToggle()) exitFlow();
    return () => window.removeEventListener('profile:openPackage', onPackage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    doc.text('Estudo 360', ml + 10, 7.5);
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
      'Este relatório é uma estimativa. Consulte sempre um contabilista certificado (OCC).  Estudo 360 • OE 2026',
      pw / 2, ph - 4, { align: 'center' }
    );

    // ── IDENTIFICAÇÃO DO CLIENTE ──────────────────────────────────────────────
    let y = 20;
    textC(NAVY);
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    // Clip long names to one line (splitTextToSize, take only [0])
    const nameLines = doc.splitTextToSize(profile.nomeCliente || 'Cliente', cw);
    doc.text(nameLines[0], ml, y);

    const entityLabel = ({ eni: 'ENI', lda: 'Lda.', unipessoal: 'Unipessoal Lda.', sa: 'SA', socio_unico: 'Sócio Único' } as Record<string, string>)[profile.tipoEntidade] ?? '';
    const regimeLabels: Record<string, string> = {
      simplificado: 'Reg. Simplificado', organizada: 'Contab. Organizada',
      transparencia_fiscal: 'Transparência Fiscal', retgs: 'RETGS', nao_residente: 'Não Residente',
    };
    const metaParts = [
      profile.nif ? `NIF ${profile.nif}` : null,
      entityLabel,
      regimeLabels[profile.regimeContabilidade] ?? '',
      profile.atividadePrincipal === 'servicos' ? 'Serviços' : 'Bens',
      `Fat. ${ptEur(profile.faturaçaoAnualPrevista)}/ano`,
    ].filter(Boolean) as string[];
    textC(SLATE_500);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    // splitTextToSize prevents overflow; show up to 2 lines
    const metaLines = doc.splitTextToSize(metaParts.join('  •  '), cw);
    doc.text(metaLines.slice(0, 2), ml, y + 6.5);
    const metaHeight = metaLines.length > 1 ? 14 : 10;
    y += metaHeight;
    hRule(y); y += 7;

    // ── ENQUADRAMENTO FISCAL ──────────────────────────────────────────────────
    if (taxState) {
      const fixedYr  = taxState.fixedMo * 12;
      const invCapex = taxState.invEquip + taxState.invLic + taxState.invWorks;
      const costsEni = fixedYr + taxState.varYr + taxState.accMoEni * 12;
      const costsLda = fixedYr + taxState.varYr + taxState.accMoLda * 12;
      const dpNaoAceite = invCapex * 0.25;

      let eniSS = 0;
      if (!(taxState.profSit === 'tco' && !taxState.isMainAct && taxState.rev <= 20000)) {
        const ssMo = calcSelfSSContribution(taxState.rev / 12, taxState.isServices ? 'servicos' : 'bens', false);
        eniSS = ssMo.anual;
      }

      // Coeficiente art.º 31.º CIRS via tipo de atividade do perfil.
      const coefArt31 = profile?.atividadePrincipal
        ? coefFromProfile(profile.atividadePrincipal)
        : (taxState.isServices ? 0.75 : 0.15);
      let eniRC = taxState.rev * coefArt31;
      const aplicaJustificacao = coefArt31 === 0.75 || coefArt31 === 0.35;
      const reqJust = aplicaJustificacao && taxState.rev > 27360 ? taxState.rev * 0.15 : 0;
      const justDocs = costsEni + DED_ESPECIFICA_CAT_A_2026;
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
        ['IRS / IRC sobre rendimento', ptEur(eniIRS), ptEur(irc), true],
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
    if (est.iva > 0) honorLines.push([profile.regimeIva === 'normal_mensal' ? 'IVA mensal' : profile.regimeIva === 'pequenos_retalhistas' ? 'IVA Peq. Retalhistas (÷ 3)' : 'IVA trimestral (÷ 3)', est.iva]);
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
    doc.save(`Estudo360_${profile.nomeCliente || 'Simulacao'}_${today.getFullYear()}.pdf`);
  };

  const steps: FlowStep<ClientProfile>[] = [
    {
      id: 'identificacao',
      label: 'Identificação do Cliente',
      description: 'Dados pessoais e de contacto.',
      render: (st, setSt) => (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-2">
            <label className={labelClass}>Nome do Cliente / Empresa</label>
            <input type="text" autoComplete="name" value={st.nomeCliente} onChange={e => setSt({ nomeCliente: e.target.value })} className={inputClass} placeholder="Nome completo ou denominação social" />
          </div>
          <div>
            <label className={labelClass}>NIF</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{9}"
              maxLength={9}
              value={st.nif}
              onChange={e => setSt({ nif: e.target.value.replace(/\D/g, '').slice(0, 9) })}
              className={inputClass}
              placeholder="123456789"
              aria-invalid={st.nif.length > 0 && !isValidNIFPT(st.nif)}
              aria-describedby="nif-help"
            />
            {st.nif.length > 0 && !isValidNIFPT(st.nif) && (
              <p id="nif-help" className="text-[11px] text-amber-700 font-[600] mt-1">
                NIF deve ter 9 dígitos e checksum válido.
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>Telefone</label>
            <input type="tel" autoComplete="tel" inputMode="tel" value={st.telefone} onChange={e => setSt({ telefone: e.target.value })} className={inputClass} placeholder="912345678" />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Email</label>
            <input type="email" autoComplete="email" inputMode="email" value={st.email} onChange={e => setSt({ email: e.target.value })} className={inputClass} placeholder="email@empresa.pt" />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Morada</label>
            <input type="text" autoComplete="street-address" value={st.morada} onChange={e => setSt({ morada: e.target.value })} className={inputClass} placeholder="Rua, Avenida..." />
          </div>
          <div>
            <label className={labelClass}>Código Postal</label>
            <input type="text" autoComplete="postal-code" inputMode="numeric" value={st.codigoPostal} onChange={e => setSt({ codigoPostal: e.target.value })} className={inputClass} placeholder="1000-001" maxLength={8} />
          </div>
          <div>
            <label className={labelClass}>Localidade</label>
            <input type="text" autoComplete="address-level2" value={st.localidade} onChange={e => setSt({ localidade: e.target.value })} className={inputClass} placeholder="Lisboa" />
          </div>
        </div>
      ),
    },
    {
      id: 'empresariais',
      label: 'Dados Empresariais',
      description: 'Tipo de entidade, CAE, faturação, regime de IVA e contabilidade.',
      render: (st, setSt) => (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <label className={labelClass}>Tipo de Entidade <Tip>A forma jurídica do negócio: ENI é Empresário em Nome Individual (sem empresa criada), Lda. é uma sociedade de responsabilidade limitada, SA é uma sociedade anónima.</Tip></label>
            <select value={st.tipoEntidade} onChange={e => setSt({ tipoEntidade: e.target.value, ...regimeForFat(e.target.value, st.regimeContabilidade, st.faturaçaoAnualPrevista) })} className={inputClass}>
              <option value="eni">ENI (Recibos Verdes)</option>
              <option value="lda">Lda (Sociedade)</option>
              <option value="unipessoal">Unipessoal Lda</option>
              <option value="sa">S.A.</option>
              <option value="socio_unico">Socio Único</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>CAE</label>
            <input type="text" value={st.cae} onChange={e => setSt({ cae: e.target.value })} className={inputClass} placeholder="62020" />
          </div>
          <div>
            <label className={labelClass}>Faturação Anual Prevista <Tip>O total de vendas/serviços que espera faturar num ano. Base para escolher o regime de IVA e calcular impostos.</Tip></label>
            <input type="number" value={st.faturaçaoAnualPrevista === 0 ? '' : st.faturaçaoAnualPrevista} onChange={e => { const fat = Number(e.target.value) || 0; setSt({ faturaçaoAnualPrevista: fat, ...ivaForFat(st.regimeIva, fat), ...regimeForFat(st.tipoEntidade, st.regimeContabilidade, fat) }); }} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Nr. Funcionários <Tip>Quantas pessoas trabalham na empresa com contrato de trabalho. Afeta os custos de Segurança Social patronal.</Tip></label>
            <input type="number" value={st.nrFuncionarios === 0 ? '' : st.nrFuncionarios} onChange={e => setSt({ nrFuncionarios: Number(e.target.value) || 0 })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Regime IVA <Tip>IVA é o Imposto sobre o Valor Acrescentado. O regime trimestral entrega declarações de 3 em 3 meses; o mensal, todos os meses. Isentos não cobram IVA.</Tip></label>
            <select value={st.regimeIva} onChange={e => setSt({ regimeIva: e.target.value })} className={inputClass}>
              <option value="isento">Isento (Art. 53.º CIVA)</option>
              <option value="normal_trimestral">Normal Trimestral</option>
              <option value="normal_mensal">Normal Mensal</option>
              <option value="pequenos_retalhistas">Pequenos Retalhistas</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Regime de Contabilidade <Tip>Contabilidade Organizada exige contabilista e permite deduzir mais custos. Regime Simplificado é mais fácil mas com menos deduções.</Tip></label>
            <select
              value={st.regimeContabilidade}
              onChange={e => setSt({ regimeContabilidade: e.target.value })}
              className={inputClass}
            >
              <option value="simplificado">Regime Simplificado</option>
              <option value="organizada">Contabilidade Organizada</option>
              {st.tipoEntidade !== 'eni' && <option value="transparencia_fiscal">Transparência Fiscal</option>}
              {st.tipoEntidade !== 'eni' && <option value="retgs">RETGS (Grupo de Empresas)</option>}
              <option value="nao_residente">Não Residente</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Ano Início Atividade <Tip>O ano em que iniciou a atividade. Determina há quantos anos está ativo para efeitos de IRS Jovem.</Tip></label>
            <input type="number" value={st.inicioAtividade === 0 ? '' : st.inicioAtividade} onChange={e => setSt({ inicioAtividade: Number(e.target.value) || 0 })} className={inputClass} min={2000} max={currentYear} />
          </div>
          <div>
            <label className={labelClass}>Atividade Principal <Tip>Define o coeficiente do art.º 31.º CIRS para o regime simplificado. Vendas/restauração/hotelaria = 15%. Serviços listados no art.º 151.º (médicos, advogados, designers) = 75%. Outros serviços = 35%.</Tip></label>
            <select value={st.atividadePrincipal} onChange={e => setSt({ atividadePrincipal: e.target.value as ClientProfile['atividadePrincipal'] })} className={inputClass}>
              <option value="servicos_listados">Profissionais do art.º 151.º — médicos, advogados, designers (75%)</option>
              <option value="servicos_outros">Outros serviços (35%)</option>
              <option value="vendas_restauracao">Vendas, restauração, hotelaria (15%)</option>
              <option value="mining_cripto">Mining de criptoativos (95%)</option>
              <option value="servicos">Serviços (legacy — usa 75%)</option>
              <option value="bens">Bens (legacy — usa 15%)</option>
            </select>
          </div>
          <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-[8px] cursor-pointer">
            <input type="checkbox" checked={st.isSazonal} onChange={e => setSt({ isSazonal: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" />
            <span className="text-[13px] font-[600] text-slate-700">Atividade Sazonal <Tip>Se o negócio só funciona em certas épocas (ex: turismo de praia, agricultura). Afeta os cálculos de SS.</Tip></span>
          </label>
          {/* Regime warnings */}
          {st.tipoEntidade === 'eni' && st.faturaçaoAnualPrevista > 200000 && (
            <div className="col-span-2 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-[8px]">
              <span className="text-amber-600 shrink-0 mt-0.5">⚠</span>
              <p className="text-[12px] text-amber-900 font-[600]">Faturação acima de €200.000: o <strong>regime simplificado (recibos verdes) deixa de ser permitido</strong> — é obrigatória contabilidade organizada (Art. 28.º/31.º CIRS). O ENI continua legal a qualquer faturação, mas a esta escala constituir sociedade (Unipessoal/Lda) costuma ser fiscalmente mais eficiente — compare no Simulador Fiscal.</p>
            </div>
          )}
          {st.tipoEntidade === 'eni' && st.regimeContabilidade === 'transparencia_fiscal' && (
            <div className="col-span-2 flex gap-2 p-3 bg-red-50 border border-red-200 rounded-[8px]">
              <span className="text-red-600 shrink-0 mt-0.5">✕</span>
              <p className="text-[12px] text-red-900 font-[600]">Transparência Fiscal não se aplica a ENI — aplica-se apenas a sociedades de profissionais (Lda./SA). Selecione outro regime.</p>
            </div>
          )}
          {(st.tipoEntidade === 'lda' || st.tipoEntidade === 'unipessoal' || st.tipoEntidade === 'sa' || st.tipoEntidade === 'socio_unico') && st.regimeContabilidade === 'simplificado' && st.faturaçaoAnualPrevista > 200000 && (
            <div className="col-span-2 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-[8px]">
              <span className="text-amber-600 shrink-0 mt-0.5">⚠</span>
              <p className="text-[12px] text-amber-900 font-[600]">Regime Simplificado IRC apenas disponível até €200.000 de faturação (Art. 86.º-A CIRC). Considere Contabilidade Organizada.</p>
            </div>
          )}
          {st.regimeContabilidade === 'retgs' && (
            <div className="col-span-2 flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-[8px]">
              <span className="text-blue-600 shrink-0 mt-0.5">ℹ</span>
              <p className="text-[12px] text-blue-900 font-[600]">RETGS aplica-se a grupos de sociedades com participação ≥75%. Os simuladores desta ferramenta não cobrem o regime de tributação consolidada.</p>
            </div>
          )}
          {st.regimeContabilidade === 'nao_residente' && (
            <div className="col-span-2 flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-[8px]">
              <span className="text-blue-600 shrink-0 mt-0.5">ℹ</span>
              <p className="text-[12px] text-blue-900 font-[600]">Não residentes: tributação depende de convenções de dupla tributação e da natureza dos rendimentos (estabelecimento estável, retenções na fonte, etc.).</p>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'fiscais',
      label: 'Dados Fiscais e Família',
      description: 'Idade, estado civil, dependentes e benefícios fiscais.',
      render: (st, setSt) => (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <label className={labelClass}>Idade <Tip>A sua idade. Determina se tem direito ao benefício de IRS Jovem (até 35 anos).</Tip></label>
            <input type="number" value={st.idade === 0 ? '' : st.idade} onChange={e => setSt({ idade: Number(e.target.value) || 0 })} className={inputClass} min={18} max={100} />
          </div>
          <div>
            <label className={labelClass}>Estado Civil <Tip>O estado civil afeta as tabelas de retenção de IRS (quanto desconta por mês). Casado com dois titulares tem tabelas diferentes.</Tip></label>
            <select value={st.estadoCivil} onChange={e => setSt({ estadoCivil: e.target.value })} className={inputClass}>
              <option value="solteiro">Solteiro</option>
              <option value="casado">Casado</option>
              <option value="uniao_facto">União de Facto</option>
              <option value="divorciado">Divorciado</option>
              <option value="viuvo">Viúvo</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Nr. Dependentes <Tip>Número de filhos ou dependentes a cargo. Cada dependente dá direito a deduções no IRS.</Tip></label>
            <input type="number" value={st.nrDependentes === 0 ? '' : st.nrDependentes} onChange={e => setSt({ nrDependentes: Number(e.target.value) || 0 })} className={inputClass} min={0} max={10} />
          </div>
          <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-[8px] cursor-pointer">
            <input type="checkbox" checked={st.cônjugeRendimentos} onChange={e => setSt({ cônjugeRendimentos: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" />
            <span className="text-[13px] font-[600] text-slate-700">Cônjuge c/ Rendimentos</span>
          </label>
          <label className="col-span-2 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-[8px] cursor-pointer">
            <input type="checkbox" checked={st.beneficioJovem} onChange={e => setSt({ beneficioJovem: e.target.checked })} className="w-4 h-4 accent-blue-600" />
            <span className="text-[13px] font-[600] text-blue-900">Benefício Jovem IRS (≤35 anos — CIRS Art. 12º-B) <Tip>Isenção parcial de IRS para jovens até 35 anos nos primeiros 10 anos de carreira (100% ano 1; 75% anos 2-4; 50% anos 5-7; 25% anos 8-10).</Tip></span>
          </label>
        </div>
      ),
    },
    {
      id: 'custos',
      label: 'Custos & Investimento',
      description: 'Estrutura de custos anuais correntes e investimento inicial previsto.',
      render: (st, setSt) => {
        const setCustos = (patch: Partial<ClientProfile['custos']>) => setSt({ custos: { ...st.custos, ...patch } });
        const setInvest = (patch: Partial<ClientProfile['investimento']>) => setSt({ investimento: { ...st.investimento, ...patch } });
        const num = (v: number) => v === 0 ? '' : v;
        return (
          <div className="space-y-7">
            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Custos Anuais (€)</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div><label className={labelClass}>Mercadorias / Matérias-primas</label><input type="number" inputMode="decimal" value={num(st.custos.mercadorias)} onChange={e => setCustos({ mercadorias: Number(e.target.value) || 0 })} className={inputClass} /></div>
                <div><label className={labelClass}>Rendas e Espaço</label><input type="number" inputMode="decimal" value={num(st.custos.rendas)} onChange={e => setCustos({ rendas: Number(e.target.value) || 0 })} className={inputClass} /></div>
                <div><label className={labelClass}>Combustíveis</label><input type="number" inputMode="decimal" value={num(st.custos.combustiveis)} onChange={e => setCustos({ combustiveis: Number(e.target.value) || 0 })} className={inputClass} /></div>
                <div><label className={labelClass}>Manutenção de Viaturas</label><input type="number" inputMode="decimal" value={num(st.custos.viaturas)} onChange={e => setCustos({ viaturas: Number(e.target.value) || 0 })} className={inputClass} /></div>
                <div><label className={labelClass}>Equipamentos / Material</label><input type="number" inputMode="decimal" value={num(st.custos.equipamentos)} onChange={e => setCustos({ equipamentos: Number(e.target.value) || 0 })} className={inputClass} /></div>
                <div><label className={labelClass}>Serviços Externos (contabilista, advocacia…)</label><input type="number" inputMode="decimal" value={num(st.custos.servicosExternos)} onChange={e => setCustos({ servicosExternos: Number(e.target.value) || 0 })} className={inputClass} /></div>
                <div className="col-span-2"><label className={labelClass}>Outros Custos</label><input type="number" inputMode="decimal" value={num(st.custos.outros)} onChange={e => setCustos({ outros: Number(e.target.value) || 0 })} className={inputClass} /></div>
              </div>
            </div>
            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Investimento Inicial (€)</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div><label className={labelClass}>Equipamentos</label><input type="number" inputMode="decimal" value={num(st.investimento.equipamentos)} onChange={e => setInvest({ equipamentos: Number(e.target.value) || 0 })} className={inputClass} /></div>
                <div><label className={labelClass}>Viaturas</label><input type="number" inputMode="decimal" value={num(st.investimento.viaturas)} onChange={e => setInvest({ viaturas: Number(e.target.value) || 0 })} className={inputClass} /></div>
                <div><label className={labelClass}>Obras / Adaptações</label><input type="number" inputMode="decimal" value={num(st.investimento.obras)} onChange={e => setInvest({ obras: Number(e.target.value) || 0 })} className={inputClass} /></div>
                <div><label className={labelClass}>Stock Inicial</label><input type="number" inputMode="decimal" value={num(st.investimento.stock)} onChange={e => setInvest({ stock: Number(e.target.value) || 0 })} className={inputClass} /></div>
                <div className="col-span-2"><label className={labelClass}>Outro Investimento</label><input type="number" inputMode="decimal" value={num(st.investimento.outro)} onChange={e => setInvest({ outro: Number(e.target.value) || 0 })} className={inputClass} /></div>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'viaturas-socios',
      label: 'Viaturas, Sócios & Dívidas',
      description: 'Veículos da empresa, estrutura societária e situação fiscal atual.',
      render: (st, setSt) => {
        const setVD = (patch: Partial<ClientProfile['viaturasDiag']>) => setSt({ viaturasDiag: { ...st.viaturasDiag, ...patch } });
        const setVDTipo = (patch: Partial<ClientProfile['viaturasDiag']['tipo']>) => setSt({ viaturasDiag: { ...st.viaturasDiag, tipo: { ...st.viaturasDiag.tipo, ...patch } } });
        const setSoc = (patch: Partial<ClientProfile['societaria']>) => setSt({ societaria: { ...st.societaria, ...patch } });
        const setFA = (patch: Partial<ClientProfile['fiscalAtual']>) => setSt({ fiscalAtual: { ...st.fiscalAtual, ...patch } });
        const setDist = (patch: Partial<ClientProfile['distribuicao']>) => setSt({ distribuicao: { ...st.distribuicao, ...patch } });
        const setCont = (patch: Partial<ContabilidadeData>) => setSt({ contabilidade: { ...defaultProfile.contabilidade, ...(st.contabilidade ?? {}), ...patch } });
        const cont = st.contabilidade ?? defaultProfile.contabilidade;
        const num = (v: number) => v === 0 ? '' : v;
        const cbCls = "flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-[8px] cursor-pointer";
        const contRow = (label: string, key: keyof ContabilidadeData) => (
          <div>
            <label className={labelClass}>{label}</label>
            <input type="number" inputMode="decimal" value={num((cont[key] as number) ?? 0)}
              onChange={e => setCont({ [key]: Number(e.target.value) || 0 } as Partial<ContabilidadeData>)}
              className={inputClass} placeholder="0,00" />
          </div>
        );
        return (
          <div className="space-y-7">
            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Viaturas da Empresa</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div>
                  <label className={labelClass}>Tem viaturas afetas?</label>
                  <select value={st.viaturasDiag.tem} onChange={e => setVD({ tem: e.target.value as 'sim'|'nao'|'' })} className={inputClass}>
                    <option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Valor total (€)</label>
                  <input type="number" inputMode="decimal" value={num(st.viaturasDiag.valor)} onChange={e => setVD({ valor: Number(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Tipo de viaturas</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={cbCls}><input type="checkbox" checked={st.viaturasDiag.tipo.comercial} onChange={e => setVDTipo({ comercial: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Comercial / Mercadorias</span></label>
                    <label className={cbCls}><input type="checkbox" checked={st.viaturasDiag.tipo.passageiros} onChange={e => setVDTipo({ passageiros: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Ligeira Passageiros</span></label>
                    <label className={cbCls}><input type="checkbox" checked={st.viaturasDiag.tipo.eletrico} onChange={e => setVDTipo({ eletrico: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Eléctrica</span></label>
                    <label className={cbCls}><input type="checkbox" checked={st.viaturasDiag.tipo.hibrido} onChange={e => setVDTipo({ hibrido: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Híbrida Plug-in</span></label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Estrutura Societária</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-3">
                <div>
                  <label className={labelClass}>Capital social (€)</label>
                  <input type="number" inputMode="decimal" min={0} value={num(st.societaria.capitalSocial ?? 0)} onChange={e => setSoc({ capitalSocial: Number(e.target.value) || 0 })} className={inputClass} placeholder="Ex.: 5 000" />
                </div>
                <div>
                  <label className={labelClass}>Nº de Sócios</label>
                  <input type="number" min={1} max={20} value={num(st.societaria.numeroSocios)} onChange={e => {
                    const n = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                    const cur = st.societaria.socios;
                    const next = cur.length === n ? cur :
                      n > cur.length
                        ? [...cur, ...Array(n - cur.length).fill(0).map(() => ({ nome: '', percentagem: 0 }))]
                        : cur.slice(0, n);
                    setSoc({ numeroSocios: n, socios: next });
                  }} className={inputClass} placeholder="1" />
                </div>
                <div>
                  <label className={labelClass}>Gerência</label>
                  <select value={st.societaria.gerencia} onChange={e => setSoc({ gerencia: e.target.value as 'um'|'varios'|'' })} className={inputClass}>
                    <option value="">—</option><option value="um">Sócio gerente único</option><option value="varios">Vários sócios gerentes</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Gerente (nome)</label>
                  <input type="text" list="gerente-socios" value={st.societaria.gerenteNome ?? ''} onChange={e => setSoc({ gerenteNome: e.target.value })} className={inputClass} placeholder="Quem fica como gerente" />
                  <datalist id="gerente-socios">
                    {st.societaria.socios.filter(s => s.nome.trim()).map((s, i) => (
                      <option key={i} value={s.nome} />
                    ))}
                  </datalist>
                </div>
              </div>
              <label className={labelClass}>Quem são os sócios</label>
              <div className="space-y-2">
                {st.societaria.socios.map((socio, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px] gap-2 items-center">
                    <input type="text" value={socio.nome} onChange={e => {
                      const next = [...st.societaria.socios]; next[i] = { ...next[i], nome: e.target.value }; setSoc({ socios: next });
                    }} className={inputClass} placeholder={`Sócio ${i+1} — nome`} />
                    <input type="number" min={0} max={100} value={socio.percentagem === 0 ? '' : socio.percentagem} onChange={e => {
                      const next = [...st.societaria.socios]; next[i] = { ...next[i], percentagem: Number(e.target.value) || 0 }; setSoc({ socios: next });
                    }} className={inputClass} placeholder="% capital" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Distribuição de Resultados (preferência)</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className={cbCls}><input type="checkbox" checked={st.distribuicao.salario} onChange={e => setDist({ salario: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Salário ao sócio-gerente</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.distribuicao.dividendos} onChange={e => setDist({ dividendos: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Dividendos</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.distribuicao.reinvestir} onChange={e => setDist({ reinvestir: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Reinvestir lucros</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.distribuicao.misto} onChange={e => setDist({ misto: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Misto</span></label>
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Situação Fiscal Actual</h3>
              <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                <div>
                  <label className={labelClass}>Dívidas fiscais (AT)</label>
                  <select value={st.fiscalAtual.dividasFiscais} onChange={e => setFA({ dividasFiscais: e.target.value as 'sim'|'nao'|'' })} className={inputClass}>
                    <option value="">—</option><option value="nao">Não</option><option value="sim">Sim</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Dívidas à SS</label>
                  <select value={st.fiscalAtual.dividasSS} onChange={e => setFA({ dividasSS: e.target.value as 'sim'|'nao'|'' })} className={inputClass}>
                    <option value="">—</option><option value="nao">Não</option><option value="sim">Sim</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Execuções fiscais</label>
                  <select value={st.fiscalAtual.execucoesFiscais} onChange={e => setFA({ execucoesFiscais: e.target.value as 'sim'|'nao'|'' })} className={inputClass}>
                    <option value="">—</option><option value="nao">Não</option><option value="sim">Sim</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A]">Demonstrações Financeiras (Balanço)</h3>
                {cont.saftImportado && (
                  <span className="text-[10px] font-[800] uppercase tracking-[0.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-[6px]">Importado do SAF-T</span>
                )}
              </div>
              <p className="text-[12px] text-slate-500 font-[500] mb-3 -mt-1 leading-relaxed">
                Saldos de fecho do período (em euros). Preenchidos automaticamente ao importar o SAF-T de contabilidade; editáveis à mão. Usados nos documentos (Balanço, Demonstração de Resultados, Fluxos de Caixa, Alterações no Capital Próprio).
              </p>

              <p className="text-[11px] font-[800] uppercase tracking-[0.5px] text-slate-400 mb-2">Ativo</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-5">
                {contRow('Ativos fixos tangíveis', 'ativoFixoTangivel')}
                {contRow('Ativos intangíveis', 'ativoIntangivel')}
                {contRow('Investimentos financeiros', 'investimentosFinanceiros')}
                {contRow('Inventários', 'inventarios')}
                {contRow('Clientes', 'clientes')}
                {contRow('Estado e outros (a receber)', 'estadoOutrosAtivo')}
                {contRow('Outros ativos correntes', 'outrosAtivosCorrentes')}
                {contRow('Caixa e depósitos (fim)', 'caixaDepositos')}
              </div>

              <p className="text-[11px] font-[800] uppercase tracking-[0.5px] text-slate-400 mb-2">Capital Próprio</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-5">
                {contRow('Capital realizado', 'capitalRealizado')}
                {contRow('Reservas e result. transitados', 'reservasResultadosTransitados')}
                {contRow('Resultado líquido do período', 'resultadoLiquido')}
                {contRow('Outras variações de capital', 'outrasVariacoesCapital')}
              </div>

              <p className="text-[11px] font-[800] uppercase tracking-[0.5px] text-slate-400 mb-2">Passivo</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-5">
                {contRow('Financiamentos obtidos', 'financiamentosObtidos')}
                {contRow('Fornecedores', 'fornecedores')}
                {contRow('Estado e outros (a pagar)', 'estadoOutrosPassivo')}
                {contRow('Outros passivos', 'outrosPassivos')}
              </div>

              <p className="text-[11px] font-[800] uppercase tracking-[0.5px] text-slate-400 mb-2">Resultados e Tesouraria</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                {contRow('Imposto sobre o rendimento', 'impostoRendimento')}
                {contRow('Caixa e depósitos (início)', 'caixaInicio')}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'objetivos',
      label: 'Objetivos, Intenções & Documentos',
      description: 'Objectivos do cliente, planeamento futuro e documentação disponível.',
      render: (st, setSt) => {
        const setObj = (patch: Partial<ClientProfile['objetivos']>) => setSt({ objetivos: { ...st.objetivos, ...patch } });
        const setInt = (patch: Partial<ClientProfile['intencoes']>) => setSt({ intencoes: { ...st.intencoes, ...patch } });
        const setDoc = (patch: Partial<ClientProfile['documentos']>) => setSt({ documentos: { ...st.documentos, ...patch } });
        const setAI = (patch: Partial<ClientProfile['analiseInterna']>) => setSt({ analiseInterna: { ...st.analiseInterna, ...patch } });
        const cbCls = "flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-[8px] cursor-pointer";
        const taCls = "w-full px-3 py-2 bg-[#F5F7FA] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] text-[#0F172A] focus:border-[#0677FF] outline-none transition-all resize-y";
        return (
          <div className="space-y-7">
            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Objetivos do Cliente</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className={cbCls}><input type="checkbox" checked={st.objetivos.menosImpostos} onChange={e => setObj({ menosImpostos: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Pagar menos impostos</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.objetivos.crescer} onChange={e => setObj({ crescer: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Crescer o negócio</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.objetivos.imobiliario} onChange={e => setObj({ imobiliario: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Investir em imobiliário</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.objetivos.variasEmpresas} onChange={e => setObj({ variasEmpresas: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Várias empresas / grupo</span></label>
                <label className={`col-span-2 ${cbCls}`}><input type="checkbox" checked={st.objetivos.planeamentoFamiliar} onChange={e => setObj({ planeamentoFamiliar: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Planeamento sucessório / familiar</span></label>
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Intenções a Médio Prazo</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className={cbCls}><input type="checkbox" checked={st.intencoes.imoveis} onChange={e => setInt({ imoveis: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Adquirir imóveis</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.intencoes.viaturasEmpresa} onChange={e => setInt({ viaturasEmpresa: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Comprar viaturas para a empresa</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.intencoes.ativosFinanceiros} onChange={e => setInt({ ativosFinanceiros: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Adquirir ativos financeiros</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.intencoes.grupoEmpresas} onChange={e => setInt({ grupoEmpresas: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Constituir grupo de empresas</span></label>
                <label className={`col-span-2 ${cbCls}`}><input type="checkbox" checked={st.intencoes.internacionalizar} onChange={e => setInt({ internacionalizar: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Internacionalizar a atividade</span></label>
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Documentos Disponíveis</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className={cbCls}><input type="checkbox" checked={st.documentos.irs} onChange={e => setDoc({ irs: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Declarações de IRS</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.documentos.balancete} onChange={e => setDoc({ balancete: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Balancete</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.documentos.ies} onChange={e => setDoc({ ies: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">IES</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.documentos.modelo22} onChange={e => setDoc({ modelo22: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Modelo 22 (IRC)</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.documentos.dec_iva} onChange={e => setDoc({ dec_iva: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Declarações de IVA</span></label>
                <label className={cbCls}><input type="checkbox" checked={st.documentos.contratos} onChange={e => setDoc({ contratos: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Contratos relevantes</span></label>
                <label className={`col-span-2 ${cbCls}`}><input type="checkbox" checked={st.documentos.extratos} onChange={e => setDoc({ extratos: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" /><span className="text-[13px] font-[600] text-slate-700">Extractos bancários</span></label>
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Análise Interna (notas do contabilista)</h3>
              <div className="grid grid-cols-1 gap-3">
                <div><label className={labelClass}>ENI vs Lda</label><textarea rows={2} value={st.analiseInterna.eniVsLda} onChange={e => setAI({ eniVsLda: e.target.value })} className={taCls} /></div>
                <div><label className={labelClass}>Simplificado vs Organizada</label><textarea rows={2} value={st.analiseInterna.simplifVsOrganizada} onChange={e => setAI({ simplifVsOrganizada: e.target.value })} className={taCls} /></div>
                <div><label className={labelClass}>Art. 53.º vs Normal (IVA)</label><textarea rows={2} value={st.analiseInterna.art53VsNormal} onChange={e => setAI({ art53VsNormal: e.target.value })} className={taCls} /></div>
                <div><label className={labelClass}>Salário vs Dividendos</label><textarea rows={2} value={st.analiseInterna.salarioVsDividendos} onChange={e => setAI({ salarioVsDividendos: e.target.value })} className={taCls} /></div>
                <div><label className={labelClass}>Planeamento Fiscal</label><textarea rows={2} value={st.analiseInterna.planeamento} onChange={e => setAI({ planeamento: e.target.value })} className={taCls} /></div>
                <div><label className={labelClass}>Observações Gerais</label><textarea rows={3} value={st.analiseInterna.observacoes} onChange={e => setAI({ observacoes: e.target.value })} className={taCls} /></div>
                <div><label className={labelClass}>Recomendações</label><textarea rows={3} value={st.analiseInterna.recomendacoes} onChange={e => setAI({ recomendacoes: e.target.value })} className={taCls} /></div>
              </div>
            </div>
          </div>
        );
      },
    },
  ];

  const resultsContent = (
    <>
      <div>
        <h1 className="text-[32px] md:text-[40px] font-[800] tracking-[-1.5px] text-[#0F172A] leading-[1.1]">Resumo de Parâmetros</h1>
        <p className="text-[15px] font-[500] text-[#64748B] mt-1">Estes valores são aplicados automaticamente nos simuladores.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
          <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0677FF]" />
            Dados Fiscais
          </h4>
          <div className="space-y-3 text-[14px]">
            <div className="flex justify-between"><span className="text-slate-500">Regime IVA:</span><span className="font-[600] text-slate-800">{{ isento: 'Isento Art. 53.º', normal_mensal: 'Normal Mensal', normal_trimestral: 'Normal Trimestral', pequenos_retalhistas: 'Peq. Retalhistas' }[profile.regimeIva]}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Regime Contab.:</span><span className="font-[600] text-slate-800">{{ simplificado: 'Simplificado', organizada: 'Org. Organizada', transparencia_fiscal: 'Transparência Fiscal', retgs: 'RETGS', nao_residente: 'Não Residente' }[profile.regimeContabilidade]}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tipo Entidade:</span><span className="font-[600] text-slate-800 uppercase">{profile.tipoEntidade}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Atividade:</span><span className="font-[600] text-slate-800">{profile.atividadePrincipal === 'servicos' ? 'Serviços' : 'Bens'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Faturação Prevista:</span><span className="font-[600] text-slate-800">{ptEur(profile.faturaçaoAnualPrevista)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Início Atividade:</span><span className="font-[600] text-slate-800">{profile.inicioAtividade} ({currentYear - profile.inicioAtividade} anos)</span></div>
          </div>
        </div>

        <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
          <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-[#0677FF]" />
            Dados Familiares
          </h4>
          <div className="space-y-3 text-[14px]">
            <div className="flex justify-between"><span className="text-slate-500">Idade:</span><span className="font-[600] text-slate-800">{profile.idade} anos</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Estado Civil:</span><span className="font-[600] text-slate-800 capitalize">{(profile.estadoCivil || '—').replace('_', ' ')}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Dependentes:</span><span className="font-[600] text-slate-800">{profile.nrDependentes} {profile.nrDependentes > 0 && <span className="text-emerald-600 text-[12px]">(ded. base €{profile.nrDependentes * 600})</span>}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Benefício Jovem:</span><span className={cn("font-[600]", profile.beneficioJovem ? "text-blue-600" : "text-slate-800")}>{profile.beneficioJovem ? 'Sim — IRS Jovem ativo' : 'Não'}</span></div>
          </div>
        </div>

        <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
          <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-[#0677FF]" />
            Tickets / Vales
          </h4>
          <div className="space-y-3 text-[14px]">
            <div className="flex justify-between"><span className="text-slate-500">Nr. Funcionários:</span><span className="font-[600] text-slate-800">{profile.nrFuncionarios}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Valor Unitário:</span><span className="font-[600] text-slate-800">{ptEur(profile.valorTicket)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Setor:</span><span className="font-[600] text-slate-800 capitalize">{profile.setorTicket}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Limite Legal:</span><span className="font-[600] text-slate-800">€10,46 (cartão) / €6,15 (dinheiro)/dia</span></div>
          </div>
        </div>

        <div className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 shadow-sm">
          <h4 className="text-[16px] font-[800] text-[#0F172A] mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#0677FF]" />
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
            <MapPin className="w-5 h-5 text-[#0677FF]" />
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
          <p><strong>• IRS Jovem (Art. 12º-B CIRS):</strong> Aplica-se até 35 anos nos primeiros 10 anos de carreira. Ano 1: 100%, Anos 2-4: 75%, Anos 5-7: 50%, Anos 8-10: 25% (OE 2026). Teto 55×IAS = €29.542,15.</p>
          <p><strong>• Dependentes (Art. 78º-A CIRS):</strong> €600 por dependente &gt;3 anos, €726 para 1.º filho ≤3 anos, €900 a partir do 2.º filho ≤3 anos.</p>
          <p><strong>• Subsídio refeição 2026:</strong> Limite isento €10,46/dia (cartão) ou €6,15/dia (dinheiro). Dedutível a 60% para a empresa.</p>
          <p><strong>• SS Independente:</strong> Taxa de 21,4% sobre 70% (serviços) ou 20% (bens). Isenção no 1.º ano de atividade.</p>
          <p><strong>• Pagamentos por Conta (PPC):</strong> ENI com IRS significativo deve prever 3 prestações em julho, setembro e dezembro.</p>
        </div>
      </section>
    </>
  );

  // Modal de exportação: definido uma vez e renderizado em AMBOS os ramos
  // (flow + detalhada) para que "Exportar documentos" da sidebar funcione
  // independentemente da vista activa.
  const packageModal = showPackage && office && honorarios && (
    <ExportPackageModal
      profile={profile}
      office={office}
      honorarios={honorarios}
      taxState={taxState}
      vehicleState={vehicleState}
      ticketState={ticketState}
      ssState={ssState}
      onClose={() => setShowPackage(false)}
      onGoToOfficeSettings={() => {
        setShowPackage(false);
        onGoToOfficeSettings?.();
      }}
    />
  );

  if (flowMode) {
    return (
      <>
        <FlowWizard
          open={flowMode}
          onClose={exitFlow}
          title="Perfil do Cliente"
          icon={User}
          steps={steps}
          resultsStep={{ label: 'Resumo de Parâmetros', description: 'Estes valores são aplicados automaticamente nos simuladores.', render: resultsContent }}
          state={profile}
          setState={(u) => onChange({ ...profile, ...u })}
        />
        {packageModal}
      </>
    );
  }


  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <>
    <motion.div
      className="overflow-y-auto lg:overflow-hidden lg:h-full lg:flex lg:flex-row bg-[#F5F7FA]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* LEFT PANEL */}
      <motion.div
        className="lg:w-[460px] shrink-0 bg-white border-b border-[#E2E8F0] lg:border-b-0 lg:border-r lg:overflow-y-auto lg:h-full flex flex-col"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="p-4 md:p-8 sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#F1F5F9]">
          <h2 className="text-[18px] md:text-[20px] font-[800] tracking-[-0.5px] text-[#0F172A]">Perfil do Cliente</h2>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          {/* Identificação */}
          <section>
            <h3 className="text-[14px] font-[800] mb-4 text-[#0677FF] flex items-center border-b pb-2">
              <User className="w-5 h-5 opacity-80 mr-2" />
              Identificação do Cliente
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="col-span-2">
                <label className={labelClass}>Nome do Cliente / Empresa</label>
                <input type="text" autoComplete="name" value={profile.nomeCliente} onChange={e => updateProfile('nomeCliente', e.target.value)} className={inputClass} placeholder="Nome completo ou denominação social" />
              </div>
              <div>
                <label className={labelClass}>NIF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{9}"
                  maxLength={9}
                  value={profile.nif}
                  onChange={e => updateProfile('nif', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  className={inputClass}
                  placeholder="123456789"
                  aria-invalid={profile.nif.length > 0 && !isValidNIFPT(profile.nif)}
                  aria-describedby="nif-help"
                />
                {profile.nif.length > 0 && !isValidNIFPT(profile.nif) && (
                  <p id="nif-help" className="text-[11px] text-amber-700 font-[600] mt-1">
                    NIF deve ter 9 dígitos e checksum válido.
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Telefone</label>
                <input type="tel" autoComplete="tel" inputMode="tel" value={profile.telefone} onChange={e => updateProfile('telefone', e.target.value)} className={inputClass} placeholder="912345678" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Email</label>
                <input type="email" autoComplete="email" inputMode="email" value={profile.email} onChange={e => updateProfile('email', e.target.value)} className={inputClass} placeholder="email@empresa.pt" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Morada</label>
                <input type="text" autoComplete="street-address" value={profile.morada} onChange={e => updateProfile('morada', e.target.value)} className={inputClass} placeholder="Rua, Avenida..." />
              </div>
              <div>
                <label className={labelClass}>Código Postal</label>
                <input type="text" autoComplete="postal-code" inputMode="numeric" value={profile.codigoPostal} onChange={e => updateProfile('codigoPostal', e.target.value)} className={inputClass} placeholder="1000-001" maxLength={8} />
              </div>
              <div>
                <label className={labelClass}>Localidade</label>
                <input type="text" autoComplete="address-level2" value={profile.localidade} onChange={e => updateProfile('localidade', e.target.value)} className={inputClass} placeholder="Lisboa" />
              </div>
            </div>
          </section>

          {/* Dados Empresariais */}
          <section>
            <h3 className="text-[14px] font-[800] mb-4 text-[#0677FF] flex items-center border-b pb-2">
              <Building2 className="w-5 h-5 opacity-80 mr-2" />
              Dados Empresariais
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label className={labelClass}>Tipo de Entidade <Tip>A forma jurídica do negócio: ENI é Empresário em Nome Individual (sem empresa criada), Lda. é uma sociedade de responsabilidade limitada, SA é uma sociedade anónima.</Tip></label>
                <select value={profile.tipoEntidade} onChange={e => onChange({ ...profile, tipoEntidade: e.target.value as ClientProfile['tipoEntidade'], ...regimeForFat(e.target.value, profile.regimeContabilidade, profile.faturaçaoAnualPrevista) })} className={inputClass}>
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
                <label className={labelClass}>Faturação Anual Prevista <Tip>O total de vendas/serviços que espera faturar num ano. Base para escolher o regime de IVA e calcular impostos.</Tip></label>
                <input type="number" value={profile.faturaçaoAnualPrevista === 0 ? '' : profile.faturaçaoAnualPrevista} onChange={e => { const fat = Number(e.target.value) || 0; onChange({ ...profile, faturaçaoAnualPrevista: fat, ...ivaForFat(profile.regimeIva, fat), ...regimeForFat(profile.tipoEntidade, profile.regimeContabilidade, fat) }); }} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Nr. Funcionários <Tip>Quantas pessoas trabalham na empresa com contrato de trabalho. Afeta os custos de Segurança Social patronal.</Tip></label>
                <input type="number" value={profile.nrFuncionarios === 0 ? '' : profile.nrFuncionarios} onChange={e => updateProfile('nrFuncionarios', Number(e.target.value) || 0)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Regime IVA <Tip>IVA é o Imposto sobre o Valor Acrescentado. O regime trimestral entrega declarações de 3 em 3 meses; o mensal, todos os meses. Isentos não cobram IVA.</Tip></label>
                <select value={profile.regimeIva} onChange={e => updateProfile('regimeIva', e.target.value)} className={inputClass}>
                  <option value="isento">Isento (Art. 53.º CIVA)</option>
                  <option value="normal_trimestral">Normal Trimestral</option>
                  <option value="normal_mensal">Normal Mensal</option>
                  <option value="pequenos_retalhistas">Pequenos Retalhistas</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Regime de Contabilidade <Tip>Contabilidade Organizada exige contabilista e permite deduzir mais custos. Regime Simplificado é mais fácil mas com menos deduções.</Tip></label>
                <select
                  value={profile.regimeContabilidade}
                  onChange={e => updateProfile('regimeContabilidade', e.target.value)}
                  className={inputClass}
                >
                  <option value="simplificado">Regime Simplificado</option>
                  <option value="organizada">Contabilidade Organizada</option>
                  {profile.tipoEntidade !== 'eni' && <option value="transparencia_fiscal">Transparência Fiscal</option>}
                  {profile.tipoEntidade !== 'eni' && <option value="retgs">RETGS (Grupo de Empresas)</option>}
                  <option value="nao_residente">Não Residente</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Ano Início Atividade <Tip>O ano em que iniciou a atividade. Determina há quantos anos está ativo para efeitos de IRS Jovem.</Tip></label>
                <input type="number" value={profile.inicioAtividade === 0 ? '' : profile.inicioAtividade} onChange={e => updateProfile('inicioAtividade', Number(e.target.value) || 0)} className={inputClass} min={2000} max={currentYear} />
              </div>
              <div>
                <label className={labelClass}>Atividade Principal <Tip>O setor de negócio principal: se presta serviços (consultoria, design, etc.) ou vende bens/produtos físicos.</Tip></label>
                <select value={profile.atividadePrincipal} onChange={e => updateProfile('atividadePrincipal', e.target.value)} className={inputClass}>
                  <option value="servicos">Prestação de Serviços</option>
                  <option value="bens">Venda de Bens</option>
                </select>
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-[8px] cursor-pointer">
                <input type="checkbox" checked={profile.isSazonal} onChange={e => updateProfile('isSazonal', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                <span className="text-[13px] font-[600] text-slate-700">Atividade Sazonal <Tip>Se o negócio só funciona em certas épocas (ex: turismo de praia, agricultura). Afeta os cálculos de SS.</Tip></span>
              </label>
              {/* Regime warnings */}
              {profile.tipoEntidade === 'eni' && profile.faturaçaoAnualPrevista > 200000 && (
                <div className="col-span-2 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-[8px]">
                  <span className="text-amber-600 shrink-0 mt-0.5">⚠</span>
                  <p className="text-[12px] text-amber-900 font-[600]">Faturação acima de €200.000: o <strong>regime simplificado (recibos verdes) deixa de ser permitido</strong> — é obrigatória contabilidade organizada (Art. 28.º/31.º CIRS). O ENI continua legal a qualquer faturação, mas a esta escala constituir sociedade (Unipessoal/Lda) costuma ser fiscalmente mais eficiente — compare no Simulador Fiscal.</p>
                </div>
              )}
              {profile.tipoEntidade === 'eni' && profile.regimeContabilidade === 'transparencia_fiscal' && (
                <div className="col-span-2 flex gap-2 p-3 bg-red-50 border border-red-200 rounded-[8px]">
                  <span className="text-red-600 shrink-0 mt-0.5">✕</span>
                  <p className="text-[12px] text-red-900 font-[600]">Transparência Fiscal não se aplica a ENI — aplica-se apenas a sociedades de profissionais (Lda./SA). Selecione outro regime.</p>
                </div>
              )}
              {(profile.tipoEntidade === 'lda' || profile.tipoEntidade === 'unipessoal' || profile.tipoEntidade === 'sa' || profile.tipoEntidade === 'socio_unico') && profile.regimeContabilidade === 'simplificado' && profile.faturaçaoAnualPrevista > 200000 && (
                <div className="col-span-2 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-[8px]">
                  <span className="text-amber-600 shrink-0 mt-0.5">⚠</span>
                  <p className="text-[12px] text-amber-900 font-[600]">Regime Simplificado IRC apenas disponível até €200.000 de faturação (Art. 86.º-A CIRC). Considere Contabilidade Organizada.</p>
                </div>
              )}
              {profile.regimeContabilidade === 'retgs' && (
                <div className="col-span-2 flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-[8px]">
                  <span className="text-blue-600 shrink-0 mt-0.5">ℹ</span>
                  <p className="text-[12px] text-blue-900 font-[600]">RETGS aplica-se a grupos de sociedades com participação ≥75%. Os simuladores desta ferramenta não cobrem o regime de tributação consolidada.</p>
                </div>
              )}
              {profile.regimeContabilidade === 'nao_residente' && (
                <div className="col-span-2 flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-[8px]">
                  <span className="text-blue-600 shrink-0 mt-0.5">ℹ</span>
                  <p className="text-[12px] text-blue-900 font-[600]">Não residentes: tributação depende de convenções de dupla tributação e da natureza dos rendimentos (estabelecimento estável, retenções na fonte, etc.).</p>
                </div>
              )}
            </div>
          </section>

          {/* Dados Fiscais e Família */}
          <section>
            <h3 className="text-[14px] font-[800] mb-4 text-[#0677FF] flex items-center border-b pb-2">
              <FileText className="w-5 h-5 opacity-80 mr-2" />
              Dados Fiscais e Família
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label className={labelClass}>Idade <Tip>A sua idade. Determina se tem direito ao benefício de IRS Jovem (até 35 anos).</Tip></label>
                <input type="number" value={profile.idade === 0 ? '' : profile.idade} onChange={e => updateProfile('idade', Number(e.target.value) || 0)} className={inputClass} min={18} max={100} />
              </div>
              <div>
                <label className={labelClass}>Estado Civil <Tip>O estado civil afeta as tabelas de retenção de IRS (quanto desconta por mês). Casado com dois titulares tem tabelas diferentes.</Tip></label>
                <select value={profile.estadoCivil} onChange={e => updateProfile('estadoCivil', e.target.value)} className={inputClass}>
                  <option value="solteiro">Solteiro</option>
                  <option value="casado">Casado</option>
                  <option value="uniao_facto">União de Facto</option>
                  <option value="divorciado">Divorciado</option>
                  <option value="viuvo">Viúvo</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Nr. Dependentes <Tip>Número de filhos ou dependentes a cargo. Cada dependente dá direito a deduções no IRS.</Tip></label>
                <input type="number" value={profile.nrDependentes === 0 ? '' : profile.nrDependentes} onChange={e => updateProfile('nrDependentes', Number(e.target.value) || 0)} className={inputClass} min={0} max={10} />
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-[8px] cursor-pointer">
                <input type="checkbox" checked={profile.cônjugeRendimentos} onChange={e => updateProfile('cônjugeRendimentos', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                <span className="text-[13px] font-[600] text-slate-700">Cônjuge c/ Rendimentos</span>
              </label>
              <label className="col-span-2 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-[8px] cursor-pointer">
                <input type="checkbox" checked={profile.beneficioJovem} onChange={e => updateProfile('beneficioJovem', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <span className="text-[13px] font-[600] text-blue-900">Benefício Jovem IRS (≤35 anos — CIRS Art. 12º-B) <Tip>Isenção parcial de IRS para jovens até 35 anos nos primeiros 10 anos de carreira (100% ano 1; 75% anos 2-4; 50% anos 5-7; 25% anos 8-10).</Tip></span>
              </label>
            </div>
          </section>

          {/* Secções extra (4-6) — render reaproveitando os steps do wizard para evitar duplicação. */}
          {steps.slice(3).map(step => (
            <section key={step.id}>
              <h3 className="text-[14px] font-[800] mb-4 text-[#0677FF] flex items-center border-b pb-2">
                <FileText className="w-5 h-5 opacity-80 mr-2" />
                {step.label}
              </h3>
              {step.render(profile, (u) => onChange({ ...profile, ...u }))}
            </section>
          ))}
        </div>
      </motion.div>

      {/* RIGHT PANEL */}
      <div className="flex-1 p-4 sm:p-6 lg:p-10 lg:overflow-y-auto lg:h-full w-full flex flex-col gap-6 lg:gap-8 relative max-w-7xl mx-auto">
        {resultsContent}
      </div>
    </motion.div>

    {packageModal}
    </>
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
  regimeContabilidade: 'simplificado',
  cae: '',
  inicioAtividade: 0,
  atividadePrincipal: 'servicos',
  isSazonal: false,
  idade: 0,
  estadoCivil: 'solteiro',
  cônjugeRendimentos: false,
  nrDependentes: 0,
  beneficioJovem: false,
  tipoEntidade: 'eni',
  faturaçaoAnualPrevista: 0,
  nrFuncionarios: 0,
  veiculos: [],
  tipoVale: 'refeicao',
  valorTicket: 0,
  limiteDeducao: 0,
  setorTicket: 'normal',
  rendimentoMensalEni: 0,
  regimeSs: 'general',
  tipoRendimentoSs: 'servicos',
  custos: { mercadorias: 0, rendas: 0, combustiveis: 0, viaturas: 0, equipamentos: 0, servicosExternos: 0, outros: 0 },
  investimento: { equipamentos: 0, viaturas: 0, obras: 0, stock: 0, outro: 0 },
  viaturasDiag: { tem: '', tipo: { comercial: false, passageiros: false, eletrico: false, hibrido: false }, valor: 0 },
  societaria: { capitalSocial: 0, numeroSocios: 1, socios: [{ nome: '', percentagem: 100 }], gerencia: '', gerenteNome: '' },
  contabilidade: {
    ativoFixoTangivel: 0, ativoIntangivel: 0, investimentosFinanceiros: 0, inventarios: 0,
    clientes: 0, estadoOutrosAtivo: 0, outrosAtivosCorrentes: 0, caixaDepositos: 0,
    capitalRealizado: 0, reservasResultadosTransitados: 0, resultadoLiquido: 0, outrasVariacoesCapital: 0,
    financiamentosObtidos: 0, fornecedores: 0, estadoOutrosPassivo: 0, outrosPassivos: 0,
    impostoRendimento: 0, caixaInicio: 0, saftImportado: false,
  },
  distribuicao: { salario: false, dividendos: false, reinvestir: false, misto: false },
  fiscalAtual: { dividasFiscais: '', dividasSS: '', execucoesFiscais: '' },
  objetivos: { menosImpostos: false, crescer: false, imobiliario: false, variasEmpresas: false, planeamentoFamiliar: false },
  intencoes: { imoveis: false, viaturasEmpresa: false, ativosFinanceiros: false, grupoEmpresas: false, internacionalizar: false },
  documentos: { irs: false, balancete: false, ies: false, modelo22: false, dec_iva: false, contratos: false, extratos: false },
  analiseInterna: { eniVsLda: '', simplifVsOrganizada: '', art53VsNormal: '', salarioVsDividendos: '', planeamento: '', observacoes: '', recomendacoes: '' },
};
