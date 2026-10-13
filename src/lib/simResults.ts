/**
 * Resultados-chave calculados por simulação, para o histórico permitir COMPARAR
 * resultados (não só inputs) sem reabrir cada uma. Reutiliza as libs de cálculo
 * (pt2026, salario) e, no caso ENI vs Lda, replica o núcleo do PDFPreviewEditor.
 *
 * Devolve [{label, valor}] — gravado em SimulationRecord.detalhes ao auto-guardar.
 */
import {
  calculateIRS, calcIRSJovem, calcDependentsDeduction,
  calcTicketSavings, calcSelfSSContribution, calculateIRC,
} from './pt2026';
import { calcSalarioLiquido } from './salario';
import { DED_ESPECIFICA_CAT_A_2026, LIMIAR_JUSTIFICACAO_15PCT } from './fiscal';
import { raiFromPrevisa, totalRendimentosClasse7, totalGastosClasse6 } from './previsaCalc';

const eur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

type Profileish = { beneficioJovem?: boolean; idade?: number; nrDependentes?: number };

/** ENI vs Lda — núcleo alinhado ao PDFPreviewEditor (resumo do rendimento líquido). */
function resultadoFiscal(s: any, profile: Profileish): { label: string; valor: string }[] {
  const totalInv = num(s.invEquip) + num(s.invLic) + num(s.invWorks) + num(s.invFundo);
  const invCapex = num(s.invEquip) + num(s.invLic) + num(s.invWorks);
  const fixedYr = num(s.fixedMo) * 12;
  const costsEni = fixedYr + num(s.varYr) + num(s.accMoEni) * 12;
  const costsLda = fixedYr + num(s.varYr) + num(s.accMoLda) * 12;
  const dpNaoAceite = invCapex * 0.25;

  let eniSS = 0;
  if (!(s.profSit === 'tco' && !s.isMainAct && num(s.rev) <= 20000)) {
    // Mesmo motor do TaxSimulator (teto 12×IAS + mínimo) — o histórico tinha a
    // fórmula sem teto e divergia do simulador acima de ~110 k€/ano.
    eniSS = calcSelfSSContribution(num(s.rev) / 12, s.isServices ? 'servicos' : 'bens', false).anual;
  }
  let eniRC = num(s.rev) * (s.isServices ? 0.75 : 0.15);
  if (s.isServices && num(s.rev) > LIMIAR_JUSTIFICACAO_15PCT) {
    const rj = num(s.rev) * 0.15;
    const jd = costsEni + DED_ESPECIFICA_CAT_A_2026;
    if (jd < rj) eniRC += rj - jd;
  }
  if (profile.beneficioJovem && num(profile.idade) <= 35) {
    eniRC = Math.max(0, eniRC - calcIRSJovem(num(s.anosAtividade), eniRC, num(profile.idade)));
  }
  const depsDed = calcDependentsDeduction(num(profile.nrDependentes));
  const eniIRS = Math.max(0, calculateIRS(num(s.currentInc) + eniRC) - calculateIRS(num(s.currentInc)) - depsDed);
  const eniNet = num(s.rev) - costsEni - eniSS - eniIRS;

  const grossSalaryYr = (num(s.monthlyNeed) / 0.70) * 14;
  const ldaSSComp = grossSalaryYr * 0.2375;
  const profit = num(s.rev) - costsLda - dpNaoAceite - grossSalaryYr - ldaSSComp;
  const ldaNet = (profit - calculateIRC(profit)) + num(s.monthlyNeed) * 12;

  const winner = ldaNet > eniNet ? 'Sociedade' : 'ENI';
  void totalInv;
  return [
    { label: 'Melhor regime', valor: winner },
    { label: 'Líquido ENI', valor: eur(eniNet) },
    { label: 'Líquido Sociedade', valor: eur(ldaNet) },
    { label: 'Diferença/ano', valor: eur(Math.abs(ldaNet - eniNet)) },
  ];
}

export function resultSimulacao(tipo: string, state: unknown, profile?: Profileish): { label: string; valor: string }[] {
  const s = (state ?? {}) as any;
  const p = profile ?? {};
  try {
    switch (tipo) {
      case 'tax':
        return num(s.rev) > 0 ? resultadoFiscal(s, p) : [];
      case 'selfss': {
        const r = calcSelfSSContribution(num(s.income), s.tipoRendimento === 'bens' ? 'bens' : 'servicos', !!s.primeiroAno);
        return r.isento
          ? [{ label: 'Contribuição', valor: 'Isento (1.º ano)' }]
          : [{ label: 'Contribuição mensal', valor: eur(r.mensal) }, { label: 'Anual', valor: eur(r.anual) }];
      }
      case 'ticket': {
        const r = calcTicketSavings(num(s.employees), num(s.ticketValue), num(s.daysPerMonth), num(s.months));
        return [{ label: 'Poupança SS/ano', valor: eur(r.savings) }, { label: 'Custo dedutível', valor: eur(r.custoDedutivelEmpresa) }];
      }
      case 'salario': {
        if (num(s.salarioBruto) <= 0) return [];
        const r = calcSalarioLiquido({
          salarioBruto: num(s.salarioBruto), estadoCivil: s.estadoCivil ?? 'solteiro',
          nrDependentes: num(s.nrDependentes), localizacao: s.localizacao ?? 'continente',
          duodecimos: !!s.duodecimos, subsidioAlimentacaoDiario: num(s.subsidioAlimentacaoDiario),
          tipoSubsidio: s.tipoSubsidio ?? 'cartao', diasSubsidio: num(s.diasSubsidio) || 22,
          irsJovem: !!s.irsJovem, anosAtividade: num(s.anosAtividade), idade: num(s.idade) || 30,
          taxaSeguroTrabalho: num(s.taxaSeguroTrabalho) || 0.01,
          deficiente: !!s.deficiente,
        });
        return [
          { label: 'Líquido mensal', valor: eur(r.salarioLiquido) },
          { label: 'Custo empregador', valor: eur(r.custoEmpregadorReal ?? r.custoEmpregador) },
        ];
      }
      case 'irs': {
        const ag = Array.isArray(s.agregado) ? s.agregado : [];
        const rend = ag.reduce((t: number, x: any) => t + num(x?.rendTrabalho) + num(x?.rendEmpresarial), 0);
        if (rend <= 0) return [];
        return [{ label: 'IRS estimado', valor: eur(calculateIRS(rend)) }, { label: 'Taxa efetiva', valor: `${((calculateIRS(rend) / rend) * 100).toFixed(1)}%` }];
      }
      case 'previsa': {
        const rend = totalRendimentosClasse7(s as any);
        const gastos = totalGastosClasse6(s as any);
        const rai = s.useRaiCalc ? raiFromPrevisa(s as any) : num(s.c701_rai);
        if (rend === 0 && gastos === 0 && !num(s.c701_rai)) return [];
        const lucro = Math.max(0, rai);
        return [
          { label: rai >= 0 ? 'Lucro (RAI)' : 'Prejuízo (RAI)', valor: eur(Math.abs(rai)) },
          { label: 'IRC estimado', valor: eur(calculateIRC(lucro)) },
        ];
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}
