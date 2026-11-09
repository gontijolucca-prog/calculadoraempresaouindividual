// Validação da cópia de segurança do gabinete. Correr: npx tsx src/lib/backupGabinete.test.ts
// Só a parte pura: um ficheiro inválido nunca pode chegar a escrever dados.

import { BACKUP_FORMATO, BACKUP_VERSAO, validarBackup, nomeFicheiroBackup } from './backupGabinete';

let fails = 0;
function ok(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`);
}

const base = {
  formato: BACKUP_FORMATO,
  versao: BACKUP_VERSAO,
  criadoEm: '2026-11-09T10:00:00.000Z',
  app: 'Estudo360',
  gabinete: { id: 'gab_x', nome: 'Gabinete Teste' },
  escritorio: {},
  empresas: [{ id: 'e1', nome: 'Cliente', nif: '501234567' }],
  colecoes: {
    clientes: [{ id: 'c1', nome: 'Cliente' }],
    tarefas: [{ id: 't1', titulo: 'Tarefa' }],
  },
  contagens: { empresas: 1, clientes: 1, tarefas: 1 },
};

const copia = () => JSON.parse(JSON.stringify(base));

// A: cópia válida
{
  const r = validarBackup(copia());
  ok('A: cópia válida é aceite', r.ok === true);
}

// B: não é JSON de backup
{
  const r = validarBackup({ hello: 'world' });
  ok('B: ficheiro alheio é recusado', r.ok === false);
  ok('B: explica que não é do Estudo360', r.ok === false && /Estudo360/.test(r.erro));
}

// C: versão futura
{
  const b = copia(); b.versao = BACKUP_VERSAO + 1;
  const r = validarBackup(b);
  ok('C: versão mais recente é recusada', r.ok === false);
}

// D: registo sem id
{
  const b = copia(); b.colecoes.clientes.push({ nome: 'Sem id' });
  const r = validarBackup(b);
  ok('D: registo sem id é recusado', r.ok === false);
  ok('D: diz qual a coleção', r.ok === false && /clientes/.test(r.erro));
}

// E: coleção que não é lista
{
  const b = copia(); b.colecoes.tarefas = { id: 'x' };
  const r = validarBackup(b);
  ok('E: coleção corrompida é recusada', r.ok === false);
}

// F: empresas que não é lista
{
  const b = copia(); b.empresas = 'nada';
  const r = validarBackup(b);
  ok('F: carteira corrompida é recusada', r.ok === false);
}

// G: sem gabinete identificado
{
  const b = copia(); delete b.gabinete;
  const r = validarBackup(b);
  ok('G: cópia sem gabinete é recusada', r.ok === false);
}

// H: nome do ficheiro normalizado
{
  const f = nomeFicheiroBackup(base as never);
  ok('H: nome do ficheiro sem acentos nem espaços', f === 'estudo360-backup-gabinete-teste-2026-11-09.json');
}

// I: null / undefined não rebentam
{
  ok('I: null é recusado sem exceção', validarBackup(null).ok === false);
  ok('I: undefined é recusado sem exceção', validarBackup(undefined).ok === false);
}

// J: coleção vazia é válida
{
  const b = copia(); b.colecoes.clientes = [];
  ok('J: coleção vazia é aceite', validarBackup(b).ok === true);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos da cópia de segurança passaram.');
