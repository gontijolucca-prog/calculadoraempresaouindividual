import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptSecret,
  decryptSecret,
  setCofrePassphrase,
  getCofrePassphrase,
  cofreIsUnlocked,
  estimatePassphraseStrength,
} from './cofreCrypto';

const PASS = 'palavra-passe-forte-123!';
const SEGREDO = 'smtp: ultrabanco-forte; çãõ áéí 😀';

// ── round-trip ─────────────────────────────────────────────────────────
describe('cofre round-trip', () => {
  it('decifra o que cifrou (inclui acentos e emoji)', async () => {
    const c = await encryptSecret(SEGREDO, PASS);
    assert.equal(await decryptSecret(c, PASS), SEGREDO);
  });

  it('duas cifrações do mesmo texto dão saídas diferentes (salt/iv aleatórios)', async () => {
    const a = await encryptSecret(SEGREDO, PASS);
    const b = await encryptSecret(SEGREDO, PASS);
    assert.notEqual(a.ciphertext, b.ciphertext);
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.salt, b.salt);
    assert.equal(await decryptSecret(a, PASS), SEGREDO);
    assert.equal(await decryptSecret(b, PASS), SEGREDO);
  });

  it('guarda metadados esperados (iter 120k, v1)', async () => {
    const c = await encryptSecret('x'.repeat(10), PASS);
    assert.equal(c.iter, 120_000);
    assert.equal(c.v, 1);
  });
});

// ── nada em claro ──────────────────────────────────────────────────────
describe('zero-knowledge (nada em claro)', () => {
  it('o payload não contém o segredo nem a passphrase', async () => {
    const c = await encryptSecret(SEGREDO, PASS);
    const blob = JSON.stringify(c);
    assert.ok(!blob.includes('ultrabanco-forte'));
    assert.ok(!blob.includes(PASS));
    assert.deepEqual(Object.keys(c).sort(), ['ciphertext', 'iter', 'iv', 'salt', 'v']);
  });
});

// ── passphrase errada / adulteração ────────────────────────────────────
describe('falhas de autenticação', () => {
  it('passphrase errada falha (não devolve lixo)', async () => {
    const c = await encryptSecret(SEGREDO, PASS);
    await assert.rejects(() => decryptSecret(c, 'pass-errada-999!'));
  });

  it('ciphertext adulterado falha (GCM autentica)', async () => {
    const c = await encryptSecret(SEGREDO, PASS);
    const raw = Buffer.from(c.ciphertext, 'base64');
    raw[0] ^= 0xff;
    await assert.rejects(() => decryptSecret({ ...c, ciphertext: raw.toString('base64') }, PASS));
  });

  it('iv adulterado falha', async () => {
    const c = await encryptSecret(SEGREDO, PASS);
    const raw = Buffer.from(c.iv, 'base64');
    raw[0] ^= 0xff;
    await assert.rejects(() => decryptSecret({ ...c, iv: raw.toString('base64') }, PASS));
  });
});

// ── validações ─────────────────────────────────────────────────────────
describe('validações', () => {
  it('texto vazio rejeita', async () => {
    await assert.rejects(() => encryptSecret('', PASS), /vazio/);
  });

  it('passphrase curta (<6) rejeita', async () => {
    await assert.rejects(() => encryptSecret(SEGREDO, 'abc'), /curta/);
  });

  it('cipher incompleto rejeita', async () => {
    await assert.rejects(() => decryptSecret({} as never, PASS), /inválido/);
  });
});

// ── sessão (só memória) ────────────────────────────────────────────────
describe('passphrase de sessão', () => {
  it('bloqueado por omissão; desbloqueia e volta a bloquear', () => {
    setCofrePassphrase(null);
    assert.equal(cofreIsUnlocked(), false);
    assert.equal(getCofrePassphrase(), null);
    setCofrePassphrase(PASS);
    assert.equal(cofreIsUnlocked(), true);
    assert.equal(getCofrePassphrase(), PASS);
    setCofrePassphrase(null);
    assert.equal(cofreIsUnlocked(), false);
  });
});

// ── força da passphrase ────────────────────────────────────────────────
describe('estimatePassphraseStrength', () => {
  it('curta = fraca', () => assert.equal(estimatePassphraseStrength('abc123'), 'fraca'));
  it('8-11 chars = ok', () => assert.equal(estimatePassphraseStrength('abcdefgh'), 'ok'));
  it('12+ completa = forte', () => assert.equal(estimatePassphraseStrength('Abcdef1234!x'), 'forte'));
  it('12+ simples = ok', () => assert.equal(estimatePassphraseStrength('abcdefghijkl'), 'ok'));
});
