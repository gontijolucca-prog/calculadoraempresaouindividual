// Testes das regras fiscais duras do perfil. Correr com: npx tsx src/lib/profileRules.test.ts
// Garantem que o utilizador (ou o AI Contabilista) nunca consegue gravar uma
// combinação ilegal (ex.: regime isento a faturar > 15.000€).
import { ivaForFat, allowedIvaRegimes, regimeContabForFat, enforceProfileRules } from './profileRules';
import { defaultProfile } from '../ClientProfile';

let fails = 0;
function eq(label: string, got: unknown, exp: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${JSON.stringify(exp)}, obteve ${JSON.stringify(got)}`); }
  else console.log(`✓ ${label}`);
}

// IVA por faturação
eq('isento permitido até 15.000', ivaForFat('isento', 10000), 'isento');
eq('isento bloqueado > 15.000 → trimestral', ivaForFat('isento', 20000), 'normal_trimestral');
eq('opções > 15.000 sem isento', allowedIvaRegimes(20000).includes('isento'), false);
eq('faixa intermédia mantém trimestral', ivaForFat('normal_trimestral', 100000), 'normal_trimestral');
eq('faixa intermédia mantém mensal voluntário', ivaForFat('normal_mensal', 100000), 'normal_mensal');
eq('> 650.000 força mensal', ivaForFat('normal_trimestral', 700000), 'normal_mensal');
eq('> 650.000 só permite mensal', allowedIvaRegimes(700000), ['normal_mensal']);

// Contabilidade do ENI
eq('ENI simplificado > 200.000 → organizada', regimeContabForFat('eni', 'simplificado', 250000), 'organizada');
eq('ENI simplificado <= 200.000 mantém', regimeContabForFat('eni', 'simplificado', 150000), 'simplificado');
eq('sociedade não forçada por este limiar', regimeContabForFat('lda', 'simplificado', 250000), 'simplificado');

// Guarda-rede central
const ilegal = { ...defaultProfile, regimeIva: 'isento' as const, faturaçaoAnualPrevista: 20000 };
eq('enforce corrige isento ilegal', enforceProfileRules(ilegal).regimeIva, 'normal_trimestral');

const big = { ...defaultProfile, regimeIva: 'isento' as const, faturaçaoAnualPrevista: 700000, tipoEntidade: 'eni' as const, regimeContabilidade: 'simplificado' as const };
const once = enforceProfileRules(big);
eq('enforce idempotente', enforceProfileRules(once), once);
eq('enforce > 650k → mensal', once.regimeIva, 'normal_mensal');
eq('enforce ENI grande → organizada', once.regimeContabilidade, 'organizada');

if (fails > 0) { console.error(`\n${fails} teste(s) falhou(aram).`); process.exit(1); }
else console.log('\nTodos os testes passaram.');
