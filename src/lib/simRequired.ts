// Validação de campos obrigatórios por simulador — gating do botão Simular + PDF.
// Cada view retorna a lista de campos em falta (human-readable). isSimReady = lista vazia.

import type { SimView } from './simSummary';

function num(v: unknown): number { return typeof v === 'number' && Number.isFinite(v) ? v : 0; }

export function getMissingFields(view: SimView | string, state: unknown): string[] {
  const s: any = (state ?? {}) as any;
  switch (view) {
    case 'ticket': {
      const missing: string[] = [];
      if (num(s.employees) <= 0) missing.push('Nº de beneficiários / funcionários');
      const tipo = s.tipoTicket as string | undefined;
      if (tipo === 'restaurante') {
        if (num(s.ticketValue) <= 0) missing.push('Valor diário');
        if (num(s.daysPerMonth) <= 0) missing.push('Dias úteis/mês');
        if (num(s.months) <= 0) missing.push('Meses/ano');
      } else {
        if (num(s.valorAnualPorPessoa) <= 0) missing.push('Valor anual por pessoa/viatura');
      }
      return missing;
    }
    case 'vehicle': {
      if (num(s.price) <= 0) return ['Custo de aquisição'];
      return [];
    }
    case 'tax': {
      if (num(s.rev) <= 0) return ['Faturação anual prevista'];
      return [];
    }
    case 'imt': {
      if (num(s.valor) <= 0) return ['Valor do imóvel'];
      return [];
    }
    case 'salario': {
      if (num(s.salarioBruto) <= 0) return ['Salário bruto mensal'];
      return [];
    }
    case 'irs': {
      const ag = Array.isArray(s.agregado) ? s.agregado : [];
      const ra: any = s.rendimentosAutonomos ?? {};
      const hasRend = ag.some((p: any) => num(p.rendTrabalho) > 0 || num(p.atividade) > 0)
        || num(ra.capitais) > 0 || num(ra.prediais) > 0 || num(ra.maisValiasMobiliarias) > 0 || num(ra.maisValiasImobiliarias) > 0;
      if (!hasRend) return ['Rendimento do agregado (trabalho, atividade ou capitais)'];
      return [];
    }
    case 'selfss': {
      if (num(s.income) <= 0) return ['Rendimento mensal'];
      return [];
    }
    case 'imoveis': {
      if (num(s.valorImovel) <= 0) return ['Valor do imóvel'];
      return [];
    }
    case 'diagnostico': {
      const missing: string[] = [];
      if (num(s.ativoTotal) <= 0) missing.push('Ativo total');
      if (num(s.volumeNegocios) <= 0) missing.push('Volume de negócios');
      return missing;
    }
    case 'previsa': {
      const hasVendas = num(s.volumeNegocios) > 0;
      const hasRai = num(s.c701_rai) !== 0 || num(s.rai_711) !== 0 || num(s.rai_712) !== 0 || num(s.rai_72) !== 0 || num(s.c753) !== 0;
      if (!hasVendas && !hasRai) return ['Volume de negócios ou RAI'];
      return [];
    }
    default:
      return [];
  }
}

export function isSimReady(view: SimView | string, state: unknown): boolean {
  return getMissingFields(view, state).length === 0;
}
