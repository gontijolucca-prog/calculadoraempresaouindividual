// Testes do comparador de aquisição de viatura. Correr: npx tsx src/lib/viaturasFinanciamento.test.ts
import { pmt, calcularModo, compararModos, ivaRendaDedutivel, mesesValidos } from './viaturasFinanciamento';
import type { FinanciamentoInput } from './viaturasFinanciamento';
import type { ViaturaInput } from './viaturas';

let fails = 0;
function approx(label: string, got: number, exp: number, tol = 0.5) {
  if (!Number.isFinite(got) || Math.abs(got - exp) > tol) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got}`); }
  else console.log(`✓ ${label} = ${got.toFixed(2)}`);
}
function is(label: string, got: unknown, exp: unknown) {
  if (got !== exp) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got}`); } else console.log(`✓ ${label}`);
}
function ok(label: string, cond: boolean) { if (!cond) { fails++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

const base: FinanciamentoInput = {
  preco: 30000, duracaoMeses: 60, entrada: 6000, valorResidual: 0, tanPercent: 6,
  maintenanceCost: 1230, insuranceCost: 500, fuelCost: 1230,
};

// ── A: anuidade
{
  approx('A: pmt 30k/6k/6%/60m', pmt(30000, 6000, 6, 60), 463.9, 0.6);
  approx('A: pmt sem juros', pmt(30000, 6000, 0, 60), 400, 0.01);
  approx('A: pmt com residual 6k', pmt(30000, 6000, 6, 60, 6000), 377.9, 0.8);
  approx('A: pmt capital coberto pela entrada', pmt(30000, 35000, 6, 60), 0, 0.01);
  is('A: prazo mínimo 12', mesesValidos(5), 12);
  is('A: prazo máximo 120', mesesValidos(500), 120);
  is('A: prazo inválido cai em 48', mesesValidos(0), 48);
}

// ── B: compra e crédito
{
  const compra = calcularModo('compra', base);
  is('B: compra sem mensalidade', compra.mensalidade, 0);
  approx('B: compra cash inicial = preço', compra.cashInicial, 30000, 0.01);
  approx('B: compra custo = preço + encargos 5 anos', compra.custoTotal, 30000 + (1230 + 500 + 1230) * 5, 1);

  const credito = calcularModo('credito', base);
  approx('B: crédito mensalidade', credito.mensalidade, 463.9, 0.6);
  approx('B: crédito cash inicial = entrada', credito.cashInicial, 6000, 0.01);
  ok('B: crédito custa mais que a compra', credito.custoTotal > compra.custoTotal);
  ok('B: crédito tem juros', credito.jurosTotais > 3000);
  ok('B: crédito aceita mais gasto (juros)', credito.gastoAceite > compra.gastoAceite);
}

// ── C: leasing/renting
{
  const leasing = calcularModo('leasing', base);
  const renting = calcularModo('renting', { ...base, incluiManutencao: true, incluiSeguro: true });
  ok('C: leasing tem mensalidade', leasing.mensalidade > 0);
  ok('C: renting inclui serviços → mensalidade calculada igual, mas custo extra menor', renting.custoTotal <= leasing.custoTotal + 1);
  // Num ligeiro comercial, a renda com fatura discriminada dá IVA; sem discriminar não dá.
  const comercial = { ...base, fiscal: { category: 'comercial' as const, engineType: 'diesel' } };
  const comDiscrim = calcularModo('leasing', { ...comercial, rentingDiscriminada: true });
  const semDiscrim = calcularModo('leasing', { ...comercial, rentingDiscriminada: false });
  ok('C: fatura discriminada recupera IVA da renda', comDiscrim.ivaDedutivel > semDiscrim.ivaDedutivel);
  approx('C: sem discriminar só recupera IVA operacional', semDiscrim.ivaDedutivel, 1725, 2);
  ok('C: renda aceite limitada (gasto aceite < custo)', leasing.gastoAceite < leasing.custoTotal);
}

// ── D: comparador devolve 4 modos e um vencedor coerente
{
  const { resultados, melhor } = compararModos(base);
  is('D: 4 modos', Object.keys(resultados).length, 4);
  const menor = Math.min(...Object.values(resultados).map(r => r.custoLiquido));
  approx('D: vencedor tem o menor custo líquido', resultados[melhor].custoLiquido, menor, 0.01);
  is('D: empate resolve para compra', compararModos({ ...base, tanPercent: 0, entrada: 30000 }).melhor, 'compra');
}

// ── E: IVA da renda por atividade/categoria
{
  const passageiros: ViaturaInput = { category: 'passageiros', engineType: 'diesel', price: 30000, ivaRegime: 'normal', activity: 'other', maintenanceCost: 0, insuranceCost: 0, fuelCost: 0, exemptTA: false, phevCompliant: false };
  is('E: passageiros não recuperam IVA da renda', ivaRendaDedutivel(passageiros, true), 0);
  is('E: fatura não discriminada = 0', ivaRendaDedutivel({ ...passageiros, activity: 'tvde' }, false), 0);
  is('E: TVDE recupera', ivaRendaDedutivel({ ...passageiros, activity: 'tvde' }, true), 1);
  is('E: comercial recupera', ivaRendaDedutivel({ ...passageiros, category: 'comercial' }, true), 1);
}

// ── F: sem preço não rebenta
{
  const zero = calcularModo('credito', { ...base, preco: 0, entrada: 0, valorResidual: 0 });
  ok('F: preço 0 → mensalidade 0', zero.mensalidade === 0);
  ok('F: preço 0 → custo finito', Number.isFinite(zero.custoTotal));
}

if (fails > 0) { console.error(`\n${fails} falha(s)`); process.exit(1); }
console.log('\nTodos os testes de financiamento passaram.');
