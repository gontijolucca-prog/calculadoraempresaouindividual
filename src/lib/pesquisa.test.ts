/**
 * Pesquisa global — lógica pura e ordem dos resultados.
 * Correr: npx tsx src/lib/pesquisa.test.ts
 */
import { normalizarBusca, filtrarResultados, type ResultadoBusca } from '../components/CommandPalette';

let fails = 0;
function ok(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`);
}

const item = (id: string, titulo: string, detalhe = ''): ResultadoBusca => ({
  id,
  tipo: 'empresa',
  titulo,
  detalhe,
  acao: () => {},
});

const base = [
  item('1', 'Padaria Central', '501234567'),
  item('2', 'Central de Contabilidade', '509999999'),
  item('3', 'Clínica São João', 'Padaria'),
];

// A: normalização sem acentos e sem maiúsculas
ok('A: normaliza acentos', normalizarBusca('Clínica São João') === 'clinica sao joao');
ok('A: normaliza maiúsculas', normalizarBusca('PADARIA') === 'padaria');
ok('A: espaços nas pontas não contam', normalizarBusca('  x  ') === 'x');

// B: prefixo vem antes de "contém"
{
  const r = filtrarResultados(base, 'central');
  ok('B: prefixo primeiro', r[0].id === '2');
  ok('B: título com "central" no meio também aparece', r.some((x) => x.id === '1'));
}

// C: encontra pelo detalhe (NIF)
{
  const r = filtrarResultados(base, '509999999');
  ok('C: encontra pelo NIF no detalhe', r.length === 1 && r[0].id === '2');
}

// D: termo sem resultados
ok('D: termo inexistente devolve vazio', filtrarResultados(base, 'zzzz').length === 0);

// E: termo vazio devolve os primeiros
ok('E: termo vazio devolve itens', filtrarResultados(base, '').length === base.length);

// F: limite respeitado
{
  const muitos = Array.from({ length: 50 }, (_, i) => item(String(i), `Cliente ${i}`));
  ok('F: limite aplicado', filtrarResultados(muitos, 'cliente', 10).length === 10);
}

// G: acentos no termo de pesquisa
ok('G: pesquisa com acento encontra sem acento', filtrarResultados(base, 'clínica').length === 1);

// H: termo de detalhe acentuado
{
  const itens = [item('x', 'Empresa', 'Fátima')];
  ok('H: detalhe com acento é encontrado', filtrarResultados(itens, 'fatima').length === 1);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos da pesquisa passaram.');
