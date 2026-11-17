// Testes do Excel da tabela de honorários. Correr: npx tsx src/lib/honorariosExcel.test.ts
//
// Protege o botão "Exportar tabela de honorários": o ficheiro tem de ser um
// .xlsx válido (zip) com as duas folhas e os valores da configuração.
import { unzipSync, strFromU8 } from 'fflate';
import { buildHonorariosXlsx } from './honorariosExcel';
import { defaultHonorariosConfig } from './honorarios';

let fails = 0;
function ok(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`);
}

const bytes = buildHonorariosXlsx();
ok('tem assinatura de zip (xlsx)', bytes[0] === 0x50 && bytes[1] === 0x4B);
ok('tem tamanho de ficheiro real', bytes.length > 2000);

const zip = unzipSync(bytes);
const nomes = Object.keys(zip);
ok('contém xl/workbook.xml', nomes.includes('xl/workbook.xml'));
ok('contém duas folhas', nomes.includes('xl/worksheets/sheet1.xml') && nomes.includes('xl/worksheets/sheet2.xml'));

const sheet1 = strFromU8(zip['xl/worksheets/sheet1.xml']);
const sheet2 = strFromU8(zip['xl/worksheets/sheet2.xml']);

ok('folha 1 tem o título', sheet1.includes('TABELA DE HONOR') || sheet1.includes('Honor'));
ok('folha 1 tem os escalões', sheet1.includes('ESCAL') || sheet1.toLowerCase().includes('escal'));
ok('folha 1 tem a mensalidade mínima', sheet1.includes(String(defaultHonorariosConfig.minimoMensal)));
ok('folha 2 tem exemplos por tipo', sheet2.toLowerCase().includes('exemplos') || sheet2.includes('EXEMPLOS'));

// Configuração personalizada tem de chegar ao ficheiro (não pode ser sempre o default).
const custom = { ...defaultHonorariosConfig, minimoMensal: 137 };
const zipCustom = unzipSync(buildHonorariosXlsx(custom));
ok('configuração personalizada entra no ficheiro',
  strFromU8(zipCustom['xl/worksheets/sheet1.xml']).includes('137'));

if (fails) { console.error(`\n${fails} falha(s)`); process.exit(1); }
console.log('\nTodos os testes do Excel de honorários passaram.');
