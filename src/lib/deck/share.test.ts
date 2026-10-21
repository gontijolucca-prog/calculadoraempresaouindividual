// Testes do link público — slug, expiração e parsing da rota.
// Correr: npx tsx src/lib/deck/share.test.ts

import {
  SLUG_LENGTH, SHARE_DAYS, SHARE_MS, expiryFromNow, isExpired, newSlug,
  publicPath, publicUrl, slugFromPath, toMillis,
} from './share';

let fails = 0;
function check(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); }
  else console.log(`✓ ${label}`);
}

const slug = newSlug();
check('slug tem o tamanho certo', slug.length === SLUG_LENGTH);
check('slug é base62', /^[0-9A-Za-z]+$/.test(slug));

const many = new Set(Array.from({ length: 500 }, () => newSlug()));
check('500 slugs são todos diferentes', many.size === 500);

check('expira em 90 dias', expiryFromNow(0) === SHARE_MS);
check('90 dias em ms', SHARE_DAYS === 90 && SHARE_MS === 90 * 24 * 60 * 60 * 1000);
check('link vivo não expirou', !isExpired(expiryFromNow()));
check('link de ontem expirou', isExpired(Date.now() - 1000));
check('exatamente agora já expirou', isExpired(Date.now()));
check('valor inválido conta como expirado', isExpired(undefined) && isExpired('não é data'));

check('Timestamp-like é lido', toMillis({ toMillis: () => 123 }) === 123);
check('Timestamp seconds é lido', toMillis({ seconds: 5 }) === 5000);
check('ISO é lido', toMillis('2026-01-01T00:00:00.000Z') === Date.parse('2026-01-01T00:00:00.000Z'));

check('rota /p/<slug>', slugFromPath(`/p/${slug}`) === slug);
check('rota com barra final', slugFromPath(`/p/${slug}/`) === slug);
check('rota inválida', slugFromPath('/p/') === null && slugFromPath('/proposta/abc') === null);

check('publicPath', publicPath(slug) === `/p/${slug}`);
check('publicUrl respeita a origem', publicUrl(slug, 'https://estudo360.pt/') === `https://estudo360.pt/p/${slug}`);

if (fails > 0) {
  console.error(`\n${fails} falha(s)`);
  process.exit(1);
}
console.log('\nTodos os testes do link público passaram.');
