/**
 * Validação do identificador de entrada dos colaboradores.
 * Correr: npx tsx functions/_equipaAccess.test.ts  (ou pela suite)
 */
import { identificadorValido, emailValido, passwordValida } from './_equipaAccess';

let fails = 0;
function ok(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`);
}

// A: utilizadores simples são aceites (não precisam de email)
ok('A: "ana" é válido', identificadorValido('ana'));
ok('A: "ana.silva" é válido', identificadorValido('ana.silva'));
ok('A: "recepcao-2" é válido', identificadorValido('recepcao-2'));
ok('A: "equipa_1" é válido', identificadorValido('equipa_1'));
ok('A: maiúsculas normalizam', identificadorValido('ANA'));

// B: emails continuam a funcionar (acessos antigos)
ok('B: email é válido', identificadorValido('ana@escritorio.pt'));
ok('B: email com subdomínio', identificadorValido('a.b@mail.escritorio.pt'));

// C: lixo é recusado
ok('C: vazio recusado', !identificadorValido(''));
ok('C: dois caracteres recusados', !identificadorValido('ab'));
ok('C: arroba solta recusada', !identificadorValido('ana@'));
ok('C: espaços recusados', !identificadorValido('ana silva'));
ok('C: começar por ponto recusado', !identificadorValido('.ana'));
ok('C: símbolos recusados', !identificadorValido('ana!#$'));
ok('C: acentos recusados no utilizador', !identificadorValido('joão'));

// D: limites
ok('D: 40 caracteres aceites', identificadorValido('a'.repeat(40)));
ok('D: 41 caracteres recusados', !identificadorValido('a'.repeat(41)));

// E: emailValido continua estrito (dono, contas normais)
ok('E: emailValido rejeita "ana"', !emailValido('ana'));
ok('E: emailValido aceita email', emailValido('ana@x.pt'));

// F: passwords (inalterado)
ok('F: password forte aceite', passwordValida('Equipa2026'));
ok('F: password sem número recusada', !passwordValida('EquipaForte'));
ok('F: password curta recusada', !passwordValida('Ab1'));

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos do identificador passaram.');
