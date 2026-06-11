// Casos-teste golden da retenção na fonte 2026. Correr com: npx tsx src/lib/retencao.test.ts
// Valores calculados À MÃO a partir das tabelas oficiais verificadas:
//  - Continente: XLSX oficial do Portal das Finanças (Despacho SEAF de 05/01/2026)
//  - Madeira: Despacho n.º 19/2026 AT-RAM (verificado contra o PDF oficial)
// Fórmula: R × taxa − parcela (− parcela×dependentes), arredondada por defeito ao euro.

import { calcRetencaoMensal, calcRetencaoSubsidio, calcRetencaoDuodecimos, tabelaAplicavel } from './retencao';

let fails = 0;
function eq(label: string, got: number | string | boolean | null, exp: number | string | boolean | null) {
  const ok = got === exp;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got}`); }
  else console.log(`✓ ${label} = ${got}`);
}

const base = { situacao: 'solteiro' as const, nrDependentes: 0, deficiente: false, regiao: 'continente' as const };

// ── Seleção de tabela ──
eq('tabela: solteiro s/ dep', tabelaAplicavel('solteiro', 0, false), 'I');
eq('tabela: casado 2 tit c/ dep', tabelaAplicavel('casado_2titulares', 2, false), 'I');
eq('tabela: solteiro c/ dep', tabelaAplicavel('solteiro', 1, false), 'II');
eq('tabela: casado 1 titular', tabelaAplicavel('casado_1titular', 0, false), 'III');
eq('tabela: deficiente solteiro s/ dep', tabelaAplicavel('solteiro', 0, true), 'IV');
eq('tabela: deficiente solteiro c/ dep', tabelaAplicavel('solteiro', 1, true), 'V');
eq('tabela: deficiente casado 2 tit c/ dep', tabelaAplicavel('casado_2titulares', 1, true), 'VI');
eq('tabela: deficiente casado 1 titular', tabelaAplicavel('casado_1titular', 0, true), 'VII');

// ── Continente — Tabela I ──
// €1.500: escalão até 1819 → 1500×0,241 − 193,33 = 168,17 → 168
eq('CONT €1500 solteiro', calcRetencaoMensal({ ...base, remuneracao: 1500 }).retencao, 168);
// €920: 1.º escalão, taxa 0
eq('CONT €920 (SMN) = 0', calcRetencaoMensal({ ...base, remuneracao: 920 }).retencao, 0);
// €1.000: parcela variável 0,125×2,6×(1273,85−1000) → 125 − 89,00125 = 35,99875 → 35
eq('CONT €1000 (parcela variável)', calcRetencaoMensal({ ...base, remuneracao: 1000 }).retencao, 35);
// €6.000 casado 2 titulares 1 dep (Tabela I): 6000×0,4495 − 823,40 − 21,43 = 1852,17 → 1852
eq('CONT €6000 casado 2tit 1dep', calcRetencaoMensal({ ...base, remuneracao: 6000, situacao: 'casado_2titulares', nrDependentes: 1 }).retencao, 1852);

// ── Continente — Tabela II ──
// €1.500, 2 dep: 361,50 − 193,33 − 2×34,29 = 99,59 → 99
eq('CONT €1500 solteiro 2dep', calcRetencaoMensal({ ...base, remuneracao: 1500, nrDependentes: 2 }).retencao, 99);

// ── Continente — Tabela III ──
// €1.500 casado único titular: escalão até 1962 → 235,50 − 141,32 = 94,18 → 94
eq('CONT €1500 casado 1tit', calcRetencaoMensal({ ...base, remuneracao: 1500, situacao: 'casado_1titular' }).retencao, 94);
// €1.100 casado único titular: parcela variável 0,125×1,35×(1677,85−1100) → 137,50 − 97,5122 = 39,99 → 39
eq('CONT €1100 casado 1tit (variável)', calcRetencaoMensal({ ...base, remuneracao: 1100, situacao: 'casado_1titular' }).retencao, 39);

// ── Continente — deficiência (Tabela IV) ──
// €2.500: escalão até 4487 → 2500×0,349 − 658,07 = 214,43 → 214
eq('CONT €2500 deficiente', calcRetencaoMensal({ ...base, remuneracao: 2500, deficiente: true }).retencao, 214);
// €1.694: isento (limite da 1.ª linha)
eq('CONT €1694 deficiente = 0', calcRetencaoMensal({ ...base, remuneracao: 1694, deficiente: true }).retencao, 0);

// ── IRS Jovem na retenção: taxa efetiva só sobre a parte não isenta ──
// €1.500 ano 2 (75% isento): 168,17 × 0,25 = 42,04 → 42
eq('CONT €1500 jovem 75% isento', calcRetencaoMensal({ ...base, remuneracao: 1500 }, 0.75).retencao, 42);
eq('CONT €1500 jovem 100% isento', calcRetencaoMensal({ ...base, remuneracao: 1500 }, 1).retencao, 0);

// ── Madeira (tabelas regionais próprias — NÃO é fator 0,70) ──
// €1.500: escalão até 1623 → 1500×0,1763 − 164,31 = 100,14 → 100
eq('MAD €1500 solteiro', calcRetencaoMensal({ ...base, remuneracao: 1500, regiao: 'madeira' }).retencao, 100);
// €1.000: variável 0,0872×2,6×(1356,92−1000) → 87,20 − 80,92 = 6,28 → 6
eq('MAD €1000 (parcela variável)', calcRetencaoMensal({ ...base, remuneracao: 1000, regiao: 'madeira' }).retencao, 6);
// €3.000 casado 1 tit 1 dep: 3000×0,1236 − 150,04 − 42,86 = 177,90 → 177
eq('MAD €3000 casado 1tit 1dep', calcRetencaoMensal({ ...base, remuneracao: 3000, situacao: 'casado_1titular', nrDependentes: 1, regiao: 'madeira' }).retencao, 177);
eq('MAD oficial = true', calcRetencaoMensal({ ...base, remuneracao: 1500, regiao: 'madeira' }).oficial, true);

// ── Açores: SEM tabelas oficiais localizadas → estimativa sinalizada ──
const az = calcRetencaoMensal({ ...base, remuneracao: 1500, regiao: 'acores' });
eq('AÇO €1500 estimativa (168×0,80)', az.retencao, 134);
eq('AÇO oficial = false', az.oficial, false);
eq('AÇO tabelaId = null', az.tabelaId, null);

// ── Subsídios e duodécimos ──
// retenção autónoma do subsídio = mesma tabela sobre o valor do subsídio
eq('subsídio €1500 = retenção do mês', calcRetencaoSubsidio(1500, base).retencao, 168);
// duodécimos de 2 subsídios: parte proporcional 168×2/12 = 28
eq('duodécimos 2×€1500', calcRetencaoDuodecimos(1500, 2, base), 28);

// ── Invariantes estruturais ──
{
  let prev = -1; let mono = true;
  for (let R = 700; R <= 25000; R += 50) {
    const r = calcRetencaoMensal({ ...base, remuneracao: R }).retencao;
    if (r < prev) { mono = false; console.error(`  não-monótono em R=${R}`); break; }
    prev = r;
  }
  eq('CONT Tabela I monótona em R', mono, true);
}
{
  // casado 1 titular nunca retém mais do que solteiro (mesmo R)
  let ok = true;
  for (let R = 700; R <= 25000; R += 250) {
    const s = calcRetencaoMensal({ ...base, remuneracao: R }).retencao;
    const c = calcRetencaoMensal({ ...base, remuneracao: R, situacao: 'casado_1titular' }).retencao;
    if (c > s) { ok = false; console.error(`  casado1tit > solteiro em R=${R}`); break; }
  }
  eq('casado 1 titular ≤ solteiro', ok, true);
}
{
  // deficiente nunca retém mais do que não deficiente (mesmo R)
  let ok = true;
  for (let R = 700; R <= 25000; R += 250) {
    const n = calcRetencaoMensal({ ...base, remuneracao: R }).retencao;
    const d = calcRetencaoMensal({ ...base, remuneracao: R, deficiente: true }).retencao;
    if (d > n) { ok = false; console.error(`  deficiente > normal em R=${R}`); break; }
  }
  eq('deficiente ≤ não deficiente', ok, true);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden de Retenção passaram.');
