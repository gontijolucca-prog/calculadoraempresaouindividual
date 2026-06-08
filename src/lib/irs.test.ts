// Casos-teste golden do motor de IRS (Modelo 3). Correr com: npx tsx src/lib/irs.test.ts
// Protegem contra regressões ao adicionar anexos (E/F/G/C) na Fase 2.
// Valores ESPERADOS calculados à mão a partir das regras 2026 no código
// (escalões art. 68.º, dedução específica art. 25.º). NÃO são a liquidação
// oficial da AT — a validação fiscal final fica para a Sandrine.

import { simular, defaultIRSState, type IRSSim, type IRSState } from './irs';

let fails = 0;
function approx(label: string, got: number, exp: number, tol = 0.05) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got.toFixed(2)}`); }
  else console.log(`✓ ${label} = ${got.toFixed(2)}`);
}

function simFrom(state: IRSState): IRSSim {
  return {
    agregado: state.agregado, cenario: state.cenario, dependentes: +state.dependentes,
    dep0a3: +state.dep0a3, regiao: state.regiao, concelho: state.concelho,
    despesas: state.despesas, pagamentosConta: +state.pagamentosConta,
    beneficioMunicipal: +state.beneficioMunicipal, perdas: +state.perdas,
    rendimentosAutonomos: state.rendimentosAutonomos,
  };
}

// ── Caso A: solteiro, só trabalho dependente 20 000 €, sem deduções ──
// dedEsp = 4 587,09 ; coletável = 15 412,91 ; 3.º escalão (21,2%, parcela 959,22)
// imposto = 15 412,91 × 0,212 − 959,22 = 2 308,32
{
  const st = defaultIRSState();
  st.agregado[0].rendTrabalho = 20000;
  const r = simular(simFrom(st));
  approx('A: IRS apurado (20k, solteiro)', r.apurado, 2308.32);
  approx('A: coleta líquida', r.coletaLiquida, 2308.32);
  approx('A: escalão', r.escalao, 3, 0);
}

// ── Caso B: igual ao A mas com 2 500 € de retenções → reembolso ──
{
  const st = defaultIRSState();
  st.agregado[0].rendTrabalho = 20000;
  st.agregado[0].retencao = 2500;
  const r = simular(simFrom(st));
  approx('B: apurado (reembolso negativo)', r.apurado, 2308.32 - 2500);
}

// ── Caso C: casal, tributação conjunta, cada um 20 000 € ──
// rendGlobal 40 000 ; dedEsp 9 174,18 ; coletável 30 825,82 ; qf=2
// baseTaxa = 15 412,91 → imposto/SP 2 308,32 ; × qf = 4 616,64
{
  const st = defaultIRSState();
  st.cenario = 'conjunto';
  st.agregado[0].rendTrabalho = 20000;
  st.agregado.push({ relacao: 'Sujeito Passivo B', nome: '', rendTrabalho: 20000, contribuicoes: 0, retencao: 0, atividade: 0, coefAtividade: 0.75, irsJovemAno: 0, pagamentosConta: 0 });
  const r = simular(simFrom(st));
  approx('C: apurado (casal 20k+20k conjunto)', r.apurado, 4616.64);
}

// ── Caso D: rendimento muito baixo (10 000 €) abaixo do mínimo de existência ──
// rendGlobal 10 000 ≤ 12 880 → imposto final 0
{
  const st = defaultIRSState();
  st.agregado[0].rendTrabalho = 10000;
  const r = simular(simFrom(st));
  approx('D: mínimo de existência (10k → 0)', r.coletaLiquida, 0);
}

// ── Caso E: IRS Jovem ano 1 (isenção 100% até ao limite) com 20 000 € ──
// Isento = min(20 000 × 1,0 ; 29 542,15) = 20 000 → tributável 0
{
  const st = defaultIRSState();
  st.agregado[0].rendTrabalho = 20000;
  st.agregado[0].irsJovemAno = 1;
  const r = simular(simFrom(st));
  approx('E: IRS Jovem ano 1 (isenção total) coleta', r.coletaLiquida, 0);
}

// ── Anexos E/F/G (Fase 2): tributação autónoma 28% e englobamento ──
// Base: solteiro, trabalho 20 000 € → coleta 2 308,32 (caso A).
// ── F: + capitais 10 000 € a 28% (autónoma) → 2308,32 + 2800 ──
{
  const st = defaultIRSState();
  st.agregado[0].rendTrabalho = 20000;
  st.rendimentosAutonomos!.capitais = 10000;
  const r = simular(simFrom(st));
  approx('F: capitais 28% (coleta + 2800)', r.coletaLiquida, 5108.32);
}

// ── G: capitais 10 000 € ENGLOBADOS (escalões) — diferente de 28% ──
{
  const st = defaultIRSState();
  st.agregado[0].rendTrabalho = 20000;
  st.rendimentosAutonomos!.capitais = 10000;
  st.rendimentosAutonomos!.englobarCapitais = true;
  const r = simular(simFrom(st));
  approx('G: capitais englobados', r.coletaLiquida, 4810.66);
}

// ── H: mais-valias mobiliárias 5 000 € a 28% → 2308,32 + 1400 ──
{
  const st = defaultIRSState();
  st.agregado[0].rendTrabalho = 20000;
  st.rendimentosAutonomos!.maisValiasMobiliarias = 5000;
  const r = simular(simFrom(st));
  approx('H: mais-valias mobiliárias 28%', r.coletaLiquida, 3708.32);
}

// ── I: mais-valias imobiliárias 10 000 € → 50% englobado ──
{
  const st = defaultIRSState();
  st.agregado[0].rendTrabalho = 20000;
  st.rendimentosAutonomos!.maisValiasImobiliarias = 10000;
  const r = simular(simFrom(st));
  approx('I: mais-valias imobiliárias (50% englobado)', r.coletaLiquida, 3442.98);
}

// ── Categoria B / Anexo B (regime simplificado + organizado) ──
// Valores validados pelo probe_catb.ts (arit. independente). Protegem a regra dos 15%
// (art.31 n.13/14), o IRS Jovem na Cat. B e a contabilidade organizada (Anexo C).

// ── J: Cat B simplificado, 20 000 € × 0,75, ABAIXO do limiar 27 360 (sem acréscimo) ──
// coletável 15 000 → mínimo de existência baixa o imposto a 15 000 − 12 880 = 2 120
{
  const st = defaultIRSState();
  st.agregado[0].atividade = 20000;
  st.agregado[0].coefAtividade = 0.75;
  const r = simular(simFrom(st));
  approx('J: Cat B simplificado 20k (sem regra 15%)', r.coletaLiquida, 2120.00);
}

// ── K: Cat B 40 000 € × 0,75 ACIMA do limiar, SEM despesas → acréscimo 15% ──
// acréscimo = 0,15×40 000 − 4 587,09 = 1 412,91 ; coletável 31 412,91
{
  const st = defaultIRSState();
  st.agregado[0].atividade = 40000;
  st.agregado[0].coefAtividade = 0.75;
  const r = simular(simFrom(st));
  approx('K: Cat B regra dos 15% sem despesas', r.coletaLiquida, 6753.27);
}

// ── L: igual ao K mas com 6 000 € de despesas documentadas → acréscimo anulado ──
// 0,15×40 000 = 6 000 ≤ 6 000 + 4 587,09 → acréscimo 0 ; coletável 30 000 (imposto menor que K)
{
  const st = defaultIRSState();
  st.agregado[0].atividade = 40000;
  st.agregado[0].coefAtividade = 0.75;
  st.agregado[0].despesasCatB = 6000;
  const r = simular(simFrom(st));
  approx('L: Cat B com despesas (acréscimo anulado)', r.coletaLiquida, 6260.16);
}

// ── M: IRS Jovem ano 1 aplicado à Cat B (20 000 × 0,75 = 15 000, isento 100%) → 0 ──
{
  const st = defaultIRSState();
  st.agregado[0].atividade = 20000;
  st.agregado[0].coefAtividade = 0.75;
  st.agregado[0].irsJovemAno = 1;
  const r = simular(simFrom(st));
  approx('M: IRS Jovem ano 1 sobre Cat B', r.coletaLiquida, 0);
}

// ── N: contabilidade organizada (Anexo C), lucro 25 000 € → coletável 25 000 ──
{
  const st = defaultIRSState();
  st.agregado[0].regimeCatB = 'organizado';
  st.agregado[0].lucroCatBOrganizado = 25000;
  const r = simular(simFrom(st));
  approx('N: contabilidade organizada (lucro real)', r.coletaLiquida, 4682.24);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden de IRS passaram.');
