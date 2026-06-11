// Casos-teste golden do comparador Fiscal ENI vs Lda. Correr: npx tsx src/lib/fiscal.test.ts
// Fixam o comportamento do motor extraído (anti-regressão) + as adições da Fase 2
// (derrama municipal e hipótese de dividendos). ⚠ Valores fiscais a confirmar pela
// um contabilista — ver docs/AUDITORIA-FISCAL-PENDENTE.md.

import { compararEniLda, compararEnquadramentos, type FiscalInput } from './fiscal';

let fails = 0;
function approx(label: string, got: number, exp: number, tol = 0.5) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got.toFixed(2)}`); }
  else console.log(`✓ ${label} = ${got.toFixed(2)}`);
}
function check(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); }
  else console.log(`✓ ${label}`);
}

const base: FiscalInput = {
  profSit: 'outro', currentInc: 0, isMainAct: true, monthlyNeed: 2000,
  isServices: true, rev: 50000, invEquip: 0, invLic: 0, invWorks: 0, invFundo: 0,
  fixedMo: 0, varYr: 0, accMoLda: 0, accMoEni: 0, anosAtividade: 5,
  transparenciaFiscal: false, beneficioJovem: false, idade: 40, nrDependentes: 0,
};

// ── A: serviços, 50 000 € faturação, gerente leva 2 000 €/mês ──
{
  const r = compararEniLda(base);
  approx('A: ENI SS anual', r.eni.ss, 7490);
  approx('A: ENI IRS', r.eni.irs, 9894.27);
  approx('A: ENI líquido', r.eni.net, 32615.73);
  approx('A: Lda IRC (15% sobre 500)', r.lda.irc, 75);
  approx('A: Lda líquido (lucro retido)', r.lda.net, 24425);
  approx('A: Lda líquido (lucro distribuído −28%)', r.lda.netDistribuido, 24306);
}

// ── B: derrama municipal 1,5% sobre lucro maior ──
{
  const comDerrama = compararEniLda({ ...base, rev: 120000, taxaDerramaMunicipal: 0.015 });
  const semDerrama = compararEniLda({ ...base, rev: 120000, taxaDerramaMunicipal: 0 });
  approx('B: IRC (15% até 50k + 19%)', comDerrama.lda.irc, 11395);
  approx('B: derrama municipal (1,5% × 70 500)', comDerrama.derramaMunicipal, 1057.5);
  approx('B: sem derrama = 0', semDerrama.derramaMunicipal, 0);
  approx('B: derrama reduz o líquido na exata medida', semDerrama.lda.net - comDerrama.lda.net, 1057.5);
}

// ── C: transparência fiscal → IRC = 0 (lucro tributado no IRS do sócio) ──
{
  const r = compararEniLda({ ...base, rev: 120000, transparenciaFiscal: true });
  approx('C: IRC = 0 (transparência)', r.lda.irc, 0);
  approx('C: derrama = 0 (transparência)', r.derramaMunicipal, 0);
}

// ── D: compararEnquadramentos — ENI organizada, avisos e disponibilidade ──
{
  const r = compararEnquadramentos(base); // 50k serviços, custos 0
  approx('D: organizada custos considerados = 0', r.eniOrganizada.custosConsiderados, 0);
  approx('D: organizada rend. coletável = faturação (sem custos)', r.eniOrganizada.rendColetavel, 50000);
  approx('D: organizada SS = SS do simplificado', r.eniOrganizada.ss, 7490);
  check('D: sem custos documentados, simplificado bate organizada', r.eni.net > r.eniOrganizada.net);
  check('D: simplificado disponível até 200k', r.eniSimplificadoDisponivel);
  check('D: 50k sem avisos de elegibilidade', r.avisos.length === 0);
  check('D: 6 enquadramentos informativos', r.outros.length === 6);
  check('D: EIRL listado como extinto', r.outros.some(o => o.id === 'eirl' && o.quando.includes('NÃO')));
}

// ── E: custos documentados altos → organizada compensa; coerência do líquido ──
{
  const r = compararEnquadramentos({ ...base, fixedMo: 3000 }); // 36k/ano de custos reais
  approx('E: organizada rend. coletável = 50k − 36k', r.eniOrganizada.rendColetavel, 14000);
  check('E: com custos reais altos, organizada bate simplificado', r.eniOrganizada.net > r.eni.net);
  approx('E: líquido organizada = rev − custos − SS − IRS',
    r.eniOrganizada.net, 50000 - 36000 - r.eniOrganizada.ss - r.eniOrganizada.irs);
}

// ── F: avisos de elegibilidade ──
{
  const acima = compararEnquadramentos({ ...base, rev: 250000 });
  check('F: >200k → simplificado indisponível', !acima.eniSimplificadoDisponivel);
  check('F: >200k → aviso de contabilidade organizada', acima.avisos.some(a => a.includes('200 000')));
  const profis = compararEnquadramentos({ ...base, nrSocios: 2, atividadeArt151: true });
  check('F: art. 151.º + 2 sócios → aviso transparência obrigatória', profis.avisos.some(a => a.includes('transparência') || a.includes('art. 6.º')));
  const pequeno = compararEnquadramentos({ ...base, rev: 12000 });
  check('F: ≤15k → aviso isenção de IVA art. 53.º', pequeno.avisos.some(a => a.includes('53.º')));
  const sa = compararEnquadramentos({ ...base, nrSocios: 5 });
  check('F: 5+ sócios → nota SA como alternativa real', sa.outros.some(o => o.id === 'sa' && (o.nota ?? '').includes('alternativa real')));
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden de Fiscal passaram.');
