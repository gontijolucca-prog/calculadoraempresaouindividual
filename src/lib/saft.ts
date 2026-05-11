import type { ClientProfile } from '../ClientProfile';

export interface SAFTDetail {
  label: string;
  value: string;
}

export interface SAFTParseResult {
  profile: Partial<ClientProfile>;
  warnings: string[];
  filled: string[];
  empty: string[];
  details: SAFTDetail[];
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
  const details: SAFTDetail[] = [];
  const profile: Partial<ClientProfile> = {};

  const headerEl = doc.getElementsByTagName('Header')[0];
  if (!headerEl) throw new Error('Elemento <Header> não encontrado — não é um ficheiro SAF-T PT válido');

  // ═════════════════════════════════════════════════════════════════
  // 1. Company identity (Header)
  // ═════════════════════════════════════════════════════════════════
  const companyName = el(headerEl, 'CompanyName');
  if (companyName) {
    profile.nomeCliente = companyName;
    filled.push('Nome');
    details.push({ label: 'Nome', value: companyName });
  }

  const taxRegNr = el(headerEl, 'TaxRegistrationNumber').replace(/\D/g, '').slice(0, 9);
  if (taxRegNr) {
    profile.nif = taxRegNr;
    filled.push('NIF');
    details.push({ label: 'NIF', value: taxRegNr });
  }

  // Contactos (opcional no SAF-T)
  const contactEl = headerEl.getElementsByTagName('CompanyContact')[0];
  if (contactEl) {
    const telephone = el(contactEl, 'Telephone');
    const email = el(contactEl, 'Email');
    if (telephone) {
      profile.telefone = telephone;
      filled.push('Telefone');
      details.push({ label: 'Telefone', value: telephone });
    }
    if (email && email.includes('@')) {
      profile.email = email;
      filled.push('Email');
      details.push({ label: 'Email', value: email });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // 2. Address (Header)
  // ═════════════════════════════════════════════════════════════════
  const addrEl = headerEl.getElementsByTagName('CompanyAddress')[0];
  if (addrEl) {
    const addressDetail = el(addrEl, 'AddressDetail');
    const buildingNumber = el(addrEl, 'BuildingNumber');
    const city = el(addrEl, 'City');
    const postalCode = el(addrEl, 'PostalCode');

    if (addressDetail || buildingNumber) {
      const parts = [addressDetail, buildingNumber].filter(Boolean);
      const morada = parts.join(', ');
      profile.morada = morada;
      filled.push('Morada');
      details.push({ label: 'Morada', value: morada });
    }
    if (postalCode && postalCode !== '0000-000') {
      profile.codigoPostal = postalCode;
      filled.push('Código Postal');
      details.push({ label: 'Código Postal', value: postalCode });
    }
    if (city && city.toLowerCase() !== 'desconhecido') {
      profile.localidade = city;
      filled.push('Localidade');
      details.push({ label: 'Localidade', value: city });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // 3. Accounting basis → entity type & accounting regime
  // ═════════════════════════════════════════════════════════════════
  const taxBasis = el(headerEl, 'TaxAccountingBasis');
  if (taxBasis === 'C' || taxBasis === 'L') {
    profile.tipoEntidade = 'lda';
    profile.regimeContabilidade = 'organizada';
    warnings.push(`TaxAccountingBasis "${taxBasis}" sugere contabilidade organizada — confirme o tipo de entidade`);
    filled.push('Tipo de entidade', 'Regime de contabilidade');
    details.push({ label: 'Tipo de Entidade', value: 'Sociedade por Quotas (Lda)' });
    details.push({ label: 'Regime de Contabilidade', value: 'Contabilidade Organizada' });
  } else if (taxBasis === 'S') {
    profile.tipoEntidade = 'eni';
    profile.regimeContabilidade = 'simplificado';
    filled.push('Tipo de entidade', 'Regime de contabilidade');
    details.push({ label: 'Tipo de Entidade', value: 'ENI / Recibos Verdes' });
    details.push({ label: 'Regime de Contabilidade', value: 'Regime Simplificado' });
  } else if (taxBasis === 'F') {
    profile.tipoEntidade = 'eni';
    profile.regimeContabilidade = 'simplificado';
    filled.push('Tipo de entidade', 'Regime de contabilidade');
    details.push({ label: 'Tipo de Entidade', value: 'ENI / Recibos Verdes' });
    details.push({ label: 'Regime de Contabilidade', value: 'Regime Simplificado' });
  }

  // ═════════════════════════════════════════════════════════════════
  // 4. Fiscal year / start date
  // ═════════════════════════════════════════════════════════════════
  const fiscalYear = el(headerEl, 'FiscalYear');
  const startDate = el(headerEl, 'StartDate');
  const endDate = el(headerEl, 'EndDate');

  const year = fiscalYear ? parseInt(fiscalYear, 10)
    : startDate ? new Date(startDate).getFullYear()
    : 0;
  if (year > 2000) {
    profile.inicioAtividade = year;
    filled.push('Ano de atividade');
    details.push({ label: 'Ano Fiscal', value: String(year) + (startDate && endDate ? ` (${startDate} → ${endDate})` : '') });
  }

  // ═════════════════════════════════════════════════════════════════
  // 5. IVA regime: inspect tax codes in sales invoices
  // ═════════════════════════════════════════════════════════════════
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
    details.push({ label: 'Regime de IVA', value: 'Isento (art.º 9.º CIVA)' });
  } else if (hasNormal) {
    profile.regimeIva = 'normal_mensal';
    filled.push('Regime de IVA (normal)');
    details.push({ label: 'Regime de IVA', value: 'Regime Normal Mensal' });
  }

  // ═════════════════════════════════════════════════════════════════
  // 6. CAE — EACCode appears in SalesInvoices (not in Header)
  // ═════════════════════════════════════════════════════════════════
  let eacCode = '';
  for (let i = 0; i < invoiceEls.length && !eacCode; i++) {
    const eac = invoiceEls[i].getElementsByTagName('EACCode')[0]?.textContent?.trim();
    if (eac && /^\d{5}$/.test(eac)) {
      eacCode = eac;
      break;
    }
  }
  if (eacCode) {
    profile.cae = eacCode;
    filled.push('CAE');
    details.push({ label: 'CAE', value: eacCode });
  }

  // ═════════════════════════════════════════════════════════════════
  // 7. Activity type: services vs goods (infer from invoice lines)
  // ═════════════════════════════════════════════════════════════════
  let serviceCount = 0;
  let goodsCount = 0;
  const allLines = doc.getElementsByTagName('Line');
  for (let i = 0; i < Math.min(allLines.length, 200); i++) {
    const desc = allLines[i].getElementsByTagName('Description')[0]?.textContent?.trim().toLowerCase() ?? '';
    const code = allLines[i].getElementsByTagName('ProductCode')[0]?.textContent?.trim() ?? '';
    // Heuristic: service keywords or 5-digit CAE-like service codes
    const isService = /(consultoria|serviço|servico|prestação|prestacao|assessoria|formação|formacao|reparação|reparacao|manutenção|manutencao|transporte|aluguer|aluguer|software|design|marketing|contabilidade|auditoria|jurídico|juridico|médico|medico|arquitetura|engenharia|informática|informatica)/.test(desc);
    const isGoods = /(venda|produto|mercadoria|artigo|material|equipamento|stock|armazém|armazem|compra|fornecedor)/.test(desc);
    if (isService) serviceCount++;
    else if (isGoods) goodsCount++;
    else {
      // Default based on CAE section: services usually start with 62-96, goods with 01-47
      const caePrefix = parseInt(eacCode.slice(0, 2), 10) || 0;
      if (caePrefix >= 45 && caePrefix <= 47) goodsCount++;
      else if (caePrefix >= 49 && caePrefix <= 99) serviceCount++;
    }
  }
  if (serviceCount > 0 || goodsCount > 0) {
    profile.atividadePrincipal = serviceCount >= goodsCount ? 'servicos' : 'bens';
    const actLabel = serviceCount >= goodsCount ? 'Serviços' : 'Venda de Bens';
    filled.push('Tipo de atividade (' + (serviceCount >= goodsCount ? 'serviços' : 'bens') + ')');
    details.push({ label: 'Tipo de Atividade', value: `${actLabel} (${serviceCount} linhas serviços, ${goodsCount} bens)` });
  } else {
    profile.atividadePrincipal = 'servicos';
  }

  // ═════════════════════════════════════════════════════════════════
  // 8. Revenue: annualise from SalesInvoices TotalCredit
  // ═════════════════════════════════════════════════════════════════
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
      const raw = totalCredit.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const est = fatAnual.toLocaleString('pt-PT') + ' €';
      details.push({ label: 'Faturação do Período', value: `${raw} € (${months < 11.5 ? `anualizado → ${est}` : est})` });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // 9. Rendimento mensal ENI (if entity type is ENI)
  // ═════════════════════════════════════════════════════════════════
  if ((profile.tipoEntidade === 'eni' || profile.tipoEntidade === 'unipessoal') && profile.faturaçaoAnualPrevista && profile.faturaçaoAnualPrevista > 0) {
    profile.rendimentoMensalEni = Math.round(profile.faturaçaoAnualPrevista / 12);
    filled.push('Rendimento mensal ENI (estimado)');
    details.push({ label: 'Rendimento Mensal ENI (est.)', value: profile.rendimentoMensalEni.toLocaleString('pt-PT') + ' €/mês' });
  }

  // ═════════════════════════════════════════════════════════════════
  // 10. Regime SS (if ENI)
  // ═════════════════════════════════════════════════════════════════
  if (profile.tipoEntidade === 'eni' || profile.tipoEntidade === 'unipessoal') {
    profile.regimeSs = profile.regimeContabilidade === 'simplificado' ? 'simplified' : 'general';
    profile.tipoRendimentoSs = profile.atividadePrincipal === 'bens' ? 'bens' : 'servicos';
    filled.push('Regime SS (estimado)');
    const ssLabel = profile.regimeSs === 'simplified' ? 'Regime Simplificado' : 'Regime Geral';
    details.push({ label: 'Regime SS', value: ssLabel });
  }

  // ═════════════════════════════════════════════════════════════════
  // 11. Number of employees — infer from Payments (salary documents)
  // ═════════════════════════════════════════════════════════════════
  const paymentEls = doc.getElementsByTagName('Payment');
  const workerNifs = new Set<string>();
  for (let i = 0; i < paymentEls.length; i++) {
    const type = paymentEls[i].getElementsByTagName('PaymentType')[0]?.textContent?.trim() ?? '';
    // RG = recibo de vencimentos, salary payment
    if (type === 'RG' || type === 'RV') {
      const lineEls = paymentEls[i].getElementsByTagName('Line');
      for (let j = 0; j < lineEls.length; j++) {
        const workerNif = lineEls[j].getElementsByTagName('EmployeeID')[0]?.textContent?.trim() ?? '';
        if (workerNif) workerNifs.add(workerNif);
      }
    }
  }
  if (workerNifs.size > 0) {
    profile.nrFuncionarios = workerNifs.size;
    filled.push('Nº de funcionários (estimado)');
    details.push({ label: 'Nº de Funcionários', value: `${workerNifs.size} (via recibos de vencimento)` });
  }

  // Alternative: count WorkDocuments related to salaries
  if (!profile.nrFuncionarios || profile.nrFuncionarios === 0) {
    const workDocEls = doc.getElementsByTagName('WorkDocument');
    let salaryDocs = 0;
    for (let i = 0; i < workDocEls.length; i++) {
      const docType = workDocEls[i].getElementsByTagName('WorkType')[0]?.textContent?.trim() ?? '';
      if (docType === 'RG' || docType === 'RV' || docType === 'AR') salaryDocs++;
    }
    if (salaryDocs > 0) {
      profile.nrFuncionarios = salaryDocs;
      filled.push('Nº de funcionários (estimado via documentos)');
      details.push({ label: 'Nº de Funcionários', value: `${salaryDocs} (via documentos de trabalho)` });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // 12. Vehicles — look in FixedAssets or PurchaseInvoices
  // ═════════════════════════════════════════════════════════════════
  const fixedAssetEls = doc.getElementsByTagName('Asset');
  const vehicles: any[] = [];
  for (let i = 0; i < fixedAssetEls.length; i++) {
    const desc = fixedAssetEls[i].getElementsByTagName('Description')[0]?.textContent?.trim().toLowerCase() ?? '';
    const isVehicle = /(viatura|veículo|veiculo|carro|automovel|automóvel|carrinha|camião|camioneta|motociclo|moto)/.test(desc);
    if (isVehicle) {
      const val = parseFloat(fixedAssetEls[i].getElementsByTagName('AcquisitionAndProductionCosts')[0]?.textContent ?? '0') || 0;
      if (val > 0) {
        vehicles.push({ desc, value: val });
      }
    }
  }
  // Also check PurchaseInvoices for vehicle descriptions
  const purchaseEls = doc.getElementsByTagName('Invoice');
  for (let i = 0; i < purchaseEls.length; i++) {
    const docType = purchaseEls[i].getElementsByTagName('InvoiceType')[0]?.textContent?.trim() ?? '';
    if (docType === 'FT' || docType === 'FR') {  // Purchase invoices
      const lines = purchaseEls[i].getElementsByTagName('Line');
      for (let j = 0; j < lines.length; j++) {
        const desc = lines[j].getElementsByTagName('Description')[0]?.textContent?.trim().toLowerCase() ?? '';
        const isVehicle = /(viatura|veículo|veiculo|carro|automovel|automóvel|carrinha|camião|camioneta|motociclo|moto)/.test(desc);
        if (isVehicle) {
          const val = parseFloat(lines[j].getElementsByTagName('UnitPrice')[0]?.textContent ?? '0') || 0;
          if (val > 1000) vehicles.push({ desc, value: val });
        }
      }
    }
  }
  if (vehicles.length > 0) {
    profile.veiculos = vehicles;
    filled.push('Veículos (' + vehicles.length + ' encontrado(s))');
    vehicles.forEach((v, i) => {
      details.push({ label: `Veículo ${i + 1}`, value: `${v.desc} — ${v.value.toLocaleString('pt-PT')} €` });
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // 13. Determine empty fields (not filled by SAFT)
  // ═════════════════════════════════════════════════════════════════
  const allProfileFields: (keyof ClientProfile)[] = [
    'nomeCliente', 'nif', 'email', 'telefone', 'morada', 'codigoPostal', 'localidade',
    'regimeIva', 'regimeContabilidade', 'cae', 'inicioAtividade', 'atividadePrincipal',
    'isSazonal', 'idade', 'estadoCivil', 'cônjugeRendimentos', 'nrDependentes',
    'beneficioJovem', 'tipoEntidade', 'faturaçaoAnualPrevista', 'nrFuncionarios',
    'veiculos', 'tipoVale', 'valorTicket', 'limiteDeducao', 'setorTicket',
    'rendimentoMensalEni', 'regimeSs', 'tipoRendimentoSs'
  ];
  const empty = allProfileFields.filter(f => !(f in profile) || (profile as any)[f] === '' || (profile as any)[f] === 0 || ((profile as any)[f] ?? []).length === 0);

  return { profile, warnings, filled, empty, details };
}
