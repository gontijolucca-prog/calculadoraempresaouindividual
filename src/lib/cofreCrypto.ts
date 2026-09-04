/**
 * Cofre cifrado — zero-knowledge client-side.
 * PBKDF2 (SHA-256, 120k iterações) → AES-GCM 256.
 * A chave NUNCA sai do browser. No Firestore só vai { iv, ciphertext, salt }.
 * Se o utilizador perder a passphrase, perde o cofre (avisar no onboarding).
 */

const ITER = 120_000;
const ALGO = 'AES-GCM';
const HASH = 'SHA-256';
const SALT_LEN = 16;
const IV_LEN = 12;

function b64e(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function b64d(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iter: number = ITER): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: iter, hash: HASH },
    base,
    { name: ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface CofreCipher {
  ciphertext: string; // base64
  iv: string;         // base64
  salt: string;       // base64
  iter: number;
  v: 1;
}

export async function encryptSecret(plain: string, passphrase: string): Promise<CofreCipher> {
  if (!plain) throw new Error('plain vazio');
  if (!passphrase || passphrase.length < 6) throw new Error('passphrase curta (min 6)');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder().encode(plain);
  const ct = await crypto.subtle.encrypt({ name: ALGO, iv: iv as BufferSource }, key, enc as BufferSource);
  return { ciphertext: b64e(ct), iv: b64e(iv), salt: b64e(salt), iter: ITER, v: 1 };
}

export async function decryptSecret(cipher: CofreCipher, passphrase: string): Promise<string> {
  if (!cipher?.ciphertext || !cipher?.iv || !cipher?.salt) throw new Error('cipher inválido');
  const salt = b64d(cipher.salt);
  const iv = b64d(cipher.iv);
  const ct = b64d(cipher.ciphertext);
  const key = await deriveKey(passphrase, salt, cipher.iter ?? ITER);
  const pt = await crypto.subtle.decrypt({ name: ALGO, iv: iv as BufferSource }, key, ct as BufferSource);
  return new TextDecoder().decode(pt);
}

// Derive uma chave estável por utilizador a partir do UID + passphrase do gabinete.
// Permite "desbloquear cofre" uma vez por sessão e guardar a CryptoKey em memória
// sem voltar a pedir passphrase a cada decrypt (mas nunca persiste em storage).
let _sessionPassphrase: string | null = null;
export function setCofrePassphrase(p: string | null) { _sessionPassphrase = p; }
export function getCofrePassphrase(): string | null { return _sessionPassphrase; }
export function cofreIsUnlocked(): boolean { return !!_sessionPassphrase; }

// Helpers de validação para UI
export function estimatePassphraseStrength(p: string): 'fraca' | 'ok' | 'forte' {
  if (p.length < 8) return 'fraca';
  if (p.length < 12) return 'ok';
  const hasUpper = /[A-Z]/.test(p), hasNum = /\d/.test(p), hasSym = /[^A-Za-z0-9]/.test(p);
  if (hasUpper && hasNum && hasSym) return 'forte';
  return 'ok';
}
