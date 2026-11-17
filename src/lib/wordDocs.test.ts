// Testes da Ata de Assembleia Geral. Correr: npx tsx src/lib/wordDocs.test.ts
//
// Regra que este ficheiro protege: a Ata é assinada por clientes reais e não
// pode afirmar factos que a app não tem (presenças, unanimidade, votação).
// Se voltar a afirmar, o teste falha.
import { buildActaAG } from './wordDocs';
import type { EmpresaRecord } from './empresas';
import type { OfficeSettings } from './officeSettings';

let fails = 0;
function ok(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`);
}
function naoContem(label: string, html: string, agulha: string) {
  ok(`${label}: não afirma "${agulha}"`, !html.toLowerCase().includes(agulha.toLowerCase()));
}

const escritorio = { nome: 'Gabinete Teste', corPrimaria: '#0677FF', localEscritorio: 'Leiria' } as unknown as OfficeSettings;

// ── Empresa sem sócios preenchidos: o pior caso, o que sai impresso hoje
const semSocios = {
  id: 'teste', nome: 'Empresa Sem Sócios, Lda', nif: '123456789',
  createdAt: 0, updatedAt: 0, profile: {}, sims: {},
} as unknown as EmpresaRecord;

const vazia = buildActaAG(semSocios, escritorio);

naoContem('empresa sem sócios', vazia, 'Todos os Sócios estiveram presentes');
naoContem('empresa sem sócios', vazia, 'estão todos os Sócios presentes');
naoContem('empresa sem sócios', vazia, 'por unanimidade');
naoContem('empresa sem sócios', vazia, 'todos os Sócios presentes');
// O espaço para preencher é o span .fill (………) — o mesmo que já se usa no presidente.
ok('empresa sem sócios: deliberações ficam em branco', /Delibera[^<]*<\/strong>|Delibera[\s\S]{0,80}class="fill"/.test(vazia) && vazia.includes('class="fill"'));
ok('empresa sem sócios: dispensa de formalidades em branco', /Dispensa de formalidades pr&eacute;vias de convocat&oacute;ria[\s\S]{0,120}class="fill"/.test(vazia));

// ── Empresa com sócios: os dados aparecem, as afirmações continuam a não existir
const comSocios = {
  id: 'teste2', nome: 'Empresa Com Sócios, Lda', nif: '987654321',
  createdAt: 0, updatedAt: 0, sims: {},
  profile: {
    societaria: {
      capitalSocial: 5000,
      gerenteNome: 'Ana Silva',
      socios: [{ nome: 'Ana Silva', percentagem: 60 }, { nome: 'Rui Costa', percentagem: 40 }],
    },
  },
} as unknown as EmpresaRecord;

const cheia = buildActaAG(comSocios, escritorio);

ok('com sócios: nome do sócio presente', cheia.includes('Ana Silva'));
ok('com sócios: nome do segundo sócio presente', cheia.includes('Rui Costa'));
ok('com sócios: capital total', cheia.includes('5.000,00'));
naoContem('com sócios', cheia, 'Todos os Sócios estiveram presentes');
naoContem('com sócios', cheia, 'por unanimidade');
naoContem('com sócios', cheia, 'todos os Sócios presentes');

// ── Ata continua a ser um documento com assinaturas
ok('tem bloco de assinaturas', cheia.includes('_______________________________'));

if (fails) { console.error(`\n${fails} falha(s)`); process.exit(1); }
console.log('\nTodos os testes da Ata passaram.');
