// Testes dos helpers do PDF. Correr: npx tsx src/lib/reportPdf.test.ts
import { paginarLinhas, slugFicheiro, formatarEuros, RelatorioPdf } from './reportPdf';

let fails = 0;
function eq(label: string, got: unknown, exp: unknown) {
  if (JSON.stringify(got) !== JSON.stringify(exp)) { fails++; console.error(`✗ ${label}: esperado ${JSON.stringify(exp)}, obteve ${JSON.stringify(got)}`); }
  else console.log(`✓ ${label} = ${JSON.stringify(got)}`);
}
function ok(label: string, cond: boolean) { if (!cond) { fails++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`); }

// ── A: paginação
eq('A: uma página', paginarLinhas(3, 10, 100), [3]);
eq('A: exatamente no limite', paginarLinhas(10, 10, 100), [10]);
eq('A: duas páginas', paginarLinhas(11, 10, 100), [10, 1]);
eq('A: três páginas', paginarLinhas(25, 10, 100), [10, 10, 5]);
eq('A: sem linhas', paginarLinhas(0, 10, 100), []);
eq('A: linha maior que a página ainda paga', paginarLinhas(2, 500, 100), [1, 1]);

// ── B: nomes de ficheiro
eq('B: acentos e espaços', slugFicheiro('Relatório de Simulação — Empresa A'), 'Relatorio-de-Simulacao-Empresa-A');
eq('B: vazio cai no nome base', slugFicheiro('   '), 'Estudo360');
ok('B: tamanho máximo', slugFicheiro('a'.repeat(300)).length <= 90);

// ── C: euros pt-PT
ok('C: euros com símbolo', formatarEuros(1234.5).includes('€'));
ok('C: inválido vira 0', formatarEuros(Number.NaN).includes('0'));

// ── D: gerar PDF real (jsPDF corre em Node) e crescer em páginas
{
  const pdf = new RelatorioPdf({
    titulo: 'Simulação de teste',
    subtitulo: 'Relatório gerado nos testes',
    cliente: 'Empresa A',
    nif: '123456789',
    escritorio: { nome: 'Gabinete Teste', corPrimaria: '#0677FF' },
  });
  pdf.seccao('Parâmetros').tabela([{ label: 'Preço', valor: '30 000 €' }, { label: 'Prazo', valor: '48 meses' }]);
  pdf.seccao('Resultado').tabela([{ label: 'TA', valor: '1 234 €' }], { destaquePrimeira: true });
  pdf.seccao('Mapa').matriz(['Cliente', 'JAN', 'FEV', 'MAR'], [['Empresa A', '—', '✓', '✕']]);
  pdf.nota('Valores indicativos.');
  eq('D: inicia com 1 página', pdf.numeroPaginas, 1);
  for (let i = 0; i < 60; i++) pdf.tabela([{ label: `Linha ${i}`, valor: '1 000 €' }]);
  ok('D: cresce para várias páginas', pdf.numeroPaginas > 1);
}

// ── E: regra "uma folha" — o save() encolhe até caber
{
  const grande = new RelatorioPdf({ titulo: 'Simulação grande', cliente: 'Empresa A', nif: '501234567' });
  grande.seccao('Parâmetros');
  for (let i = 0; i < 45; i++) grande.tabela([{ label: `Parâmetro ${i}`, valor: `${i * 10} €` }]);
  grande.seccao('Mapa');
  grande.matriz(['Cliente', 'JAN', 'FEV'], [['A', 'OK', 'X'], ['B', 'X', 'OK']]);
  grande.nota('Valores indicativos.');
  ok('E: em tamanho normal passaria de uma página', grande.numeroPaginas > 1);
  eq('E: página final = 1', grande.paginasFinais(), 1);
  ok('E: fator dentro do piso', grande.fatorFinal() >= 0.72 && grande.fatorFinal() <= 1);
}

// ── F: relatório curto fica no tamanho normal
{
  const curto = new RelatorioPdf({ titulo: 'Curto' });
  curto.seccao('Resumo').tabela([{ label: 'Total', valor: '100 €' }]);
  eq('F: curto continua em fator 1', curto.fatorFinal(), 1);
  eq('F: curto numa página', curto.paginasFinais(), 1);
}

// ── G: matriz gigante nunca sai em 2 páginas (trunca com aviso)
{
  const m = new RelatorioPdf({ titulo: 'Mapa enorme', paisagem: true });
  const linhas = Array.from({ length: 120 }, (_, i) => [`Cliente ${i}`, 'OK', 'X', 'OK']);
  m.matriz(['Cliente', 'JAN', 'FEV', 'MAR'], linhas);
  eq('G: matriz de 120 linhas fica numa folha', m.paginasFinais(), 1);
}

if (fails > 0) { console.error(`\n${fails} falha(s)`); process.exit(1); }
console.log('\nTodos os testes do PDF passaram.');
