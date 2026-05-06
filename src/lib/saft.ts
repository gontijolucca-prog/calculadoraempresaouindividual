import type { ClientProfile } from '../ClientProfile';

export interface SAFTParseResult {
  profile: Partial<ClientProfile>;
  warnings: string[];
  filled: string[];
}

function el(parent: Element | Document, tag: string): string {
  return parent.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
}

export function parseSAFT(xmlText: string): SAFTParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Ficheiro XML inválido ou corrompido');

  const warnings: string[] = [];
  const filled: string[] = [];
  const profile: Partial<ClientProfile> = {};

  const headerEl = doc.getElementsByTagName('Header')[0];
  if (!headerEl) throw new Error('Elemento <Header> não encontrado — não é um ficheiro SAF-T PT válido');

  // ── Company identity ─────────────────────────────────────────────────────
  const companyName = el(headerEl, 'CompanyName');
  if (companyName) {
    profile.nomeCliente = companyName;
    filled.push('Nome');
  }

  const taxRegNr = el(headerEl, 'TaxRegistrationNumber').replace(/\D/g, '').slice(0, 9);
  if (taxRegNr) {
    profile.nif = taxRegNr;
    filled.push('NIF');
  }

  // ── Address ───────────────────────────────────────────────────────────────
  const addrEl = headerEl.getElementsByTagName('CompanyAddress')[0];
  if (addrEl) {
    const addressDetail = el(addrEl, 'AddressDetail');
    const buildingNumber = el(addrEl, 'BuildingNumber');
    const city = el(addrEl, 'City');
    const postalCode = el(addrEl, 'PostalCode');

    if (addressDetail || buildingNumber) {
      const parts = [addressDetail, buildingNumber].filter(Boolean);
      profile.morada = parts.join(', ');
      filled.push('Morada');
    }
    if (postalCode && postalCode !== '0000-000') {
      profile.codigoPostal = postalCode;
      filled.push('Código Postal');
    }
    if (city && city.toLowerCase() !== 'desconhecido') {
      profile.localidade = city;
      filled.push('Localidade');
    }
  }

  // ── Accounting basis → entity type & accounting regime ───────────────────
  const taxBasis = el(headerEl, 'TaxAccountingBasis');
  // F = faturação (ENI / simplified), C = contabilidade organizada,
  // S = simplificado, L = livre, R = caixa, T = terceiros
  if (taxBasis === 'C' || taxBasis === 'L') {
    profile.tipoEntidade = 'lda';
    profile.regimeContabilidade = 'organizada';
    warnings.push(`TaxAccountingBasis "${taxBasis}" sugere contabilidade organizada — confirme o tipo de entidade`);
    filled.push('Regime de contabilidade');
  } else if (taxBasis === 'S') {
    profile.tipoEntidade = 'eni';
    profile.regimeContabilidade = 'simplificado';
    filled.push('Tipo de entidade', 'Regime de contabilidade');
  } else if (taxBasis === 'F') {
    // Faturação: typically ENI / simplified
    profile.tipoEntidade = 'eni';
    profile.regimeContabilidade = 'simplificado';
    filled.push('Tipo de entidade', 'Regime de contabilidade');
  }

  // ── Fiscal year / inicio atividade ───────────────────────────────────────
  const fiscalYear = el(headerEl, 'FiscalYear');
  const startDate = el(headerEl, 'StartDate');
  const endDate = el(headerEl, 'EndDate');

  const year = fiscalYear ? parseInt(fiscalYear, 10)
    : startDate ? new Date(startDate).getFullYear()
    : 0;
  if (year > 2000) {
    profile.inicioAtividade = year;
    filled.push('Ano de atividade');
  }

  // ── IVA regime: inspect tax codes used in sales invoices ─────────────────
  const invoiceEls = doc.getElementsByTagName('Invoice');
  let hasNormal = false;
  let hasISE = false;

  for (let i = 0; i < invoiceEls.length; i++) {
    const lines = invoiceEls[i].getElementsByTagName('Line');
    for (let j = 0; j < lines.length; j++) {
      const taxCode = lines[j].getElementsByTagName('TaxCode')[0]?.textContent?.trim();
      if (taxCode === 'NOR' || taxCode === 'INT' || taxCode === 'RED') hasNormal = true;
      if (taxCode === 'ISE') hasISE = true;
    }
  }

  if (hasISE && !hasNormal) {
    profile.regimeIva = 'isento';
    filled.push('Regime de IVA (isento)');
  } else if (hasNormal) {
    profile.regimeIva = 'normal_mensal';
    filled.push('Regime de IVA (normal)');
  }

  // ── Activity type: services vs goods ─────────────────────────────────────
  // Sample product descriptions; default to 'servicos' for now
  profile.atividadePrincipal = 'servicos';
  filled.push('Tipo de atividade');

  // ── Revenue: annualise from the period's TotalCredit ─────────────────────
  const salesEl = doc.getElementsByTagName('SalesInvoices')[0];
  const totalCredit = parseFloat(salesEl?.getElementsByTagName('TotalCredit')[0]?.textContent ?? '0') || 0;

  if (totalCredit > 0 && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = (end.getTime() - start.getTime()) / 86400000 + 1;
    const months = days / 30.44;

    let fatAnual: number;
    if (months < 11.5) {
      fatAnual = Math.round((totalCredit / months) * 12);
      warnings.push(
        `Faturação anualizada: ${totalCredit.toFixed(2)} € em ${months.toFixed(1)} mês(es) → estimativa anual ${fatAnual.toLocaleString('pt-PT')} €`
      );
    } else {
      fatAnual = Math.round(totalCredit);
    }

    if (fatAnual > 0) {
      profile.faturaçaoAnualPrevista = fatAnual;
      filled.push('Faturação anual estimada');
    }
  }

  return { profile, warnings, filled };
}
