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

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden de IRS passaram.');
