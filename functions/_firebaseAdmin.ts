const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const IDENTITY_BASE = 'https://identitytoolkit.googleapis.com/v1';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform';
const CUSTOM_TOKEN_AUD = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
const FIREBASE_WEB_API_KEY = 'AIzaSyChJKEBjPKZcRVF4R_n07UoUB9QO0q_EzM';

type Env = Record<string, unknown>;

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface StoredDoc<T = Record<string, unknown>> {
  data: T;
  updateTime?: string;
}

let tokenCache: { key: string; token: string; expiresAt: number } | null = null;

function emulatorHost(env: Env, kind: 'auth' | 'firestore'): string {
  const raw = kind === 'auth'
    ? env.FIREBASE_AUTH_EMULATOR_HOST
    : env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_FIRESTORE_EMULATOR_HOST;
  return String(raw || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function projectId(env: Env): string {
  const configured = String(env.FIREBASE_PROJECT_ID || '').trim();
  if (configured) return configured;
  try { return sa(env).project_id; } catch { return 'estudo360-app'; }
}

function sa(env: Env): ServiceAccount {
  const raw = String(env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON em falta');
  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválido');
  }
  return {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64Url(value: string | Uint8Array): string {
  const b64 = typeof value === 'string' ? btoa(value) : bytesToBase64(value);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToBytes(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function signJwt(account: ServiceAccount, payload: Record<string, unknown>): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function googleAccessToken(env: Env, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (emulatorHost(env, 'auth') || emulatorHost(env, 'firestore')) return 'owner';
  const account = sa(env);
  const key = `${account.project_id}:${account.client_email}`;
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAt > now + 60) return tokenCache.token;
  const assertion = await signJwt(account, {
    iss: account.client_email,
    sub: account.client_email,
    aud: TOKEN_URL,
    scope: OAUTH_SCOPE,
    iat: now,
    exp: now + 3600,
  });
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  const data = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) throw new Error(`OAuth Google falhou (${res.status})`);
  tokenCache = {
    key,
    token: data.access_token,
    expiresAt: now + Math.max(300, Number(data.expires_in) || 3600),
  };
  return data.access_token;
}

async function identityCall<T>(
  env: Env,
  method: string,
  path: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const emulator = emulatorHost(env, 'auth');
  const token = emulator ? '' : await googleAccessToken(env, fetchImpl);
  const base = emulator
    ? `http://${emulator}/identitytoolkit.googleapis.com/v1`
    : IDENTITY_BASE;
  const key = emulator ? `?key=${encodeURIComponent(String(env.FIREBASE_API_KEY || FIREBASE_WEB_API_KEY))}` : '';
  const res = await fetchImpl(`${base}/projects/${encodeURIComponent(projectId(env))}${path}${key}`, {
    method,
    headers: {
      Authorization: `Bearer ${token || 'owner'}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String((data as { error?: { message?: string } })?.error?.message || data);
    throw new Error(`Firebase Auth Admin falhou (${res.status}): ${msg}`);
  }
  return data as T;
}

export async function createAuthUser(
  env: Env,
  input: { localId: string; email: string; password: string; displayName: string; claims: Record<string, unknown> },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  // O endpoint Admin `/accounts` cria passwords com hash no servidor. O
  // batchCreate serve para importar hashes e não aceita rawPassword sem opções
  // de hashing, por isso não é o endpoint correto para este fluxo.
  await identityCall(env, 'POST', '/accounts', {
    localId: input.localId,
    email: input.email,
    password: input.password,
    displayName: input.displayName,
    emailVerified: false,
    disabled: false,
  }, fetchImpl);
  await updateAuthUser(env, { localId: input.localId, claims: input.claims }, fetchImpl);
}

export async function updateAuthUser(
  env: Env,
  input: { localId: string; password?: string; claims?: Record<string, unknown>; disable?: boolean; revoke?: boolean },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const body: Record<string, unknown> = { localId: input.localId };
  if (input.password) body.password = input.password;
  if (input.claims) body.customAttributes = JSON.stringify(input.claims);
  if (typeof input.disable === 'boolean') body.disableUser = input.disable;
  if (input.revoke) body.validSince = String(Math.floor(Date.now() / 1000));
  await identityCall(env, 'POST', '/accounts:update', body, fetchImpl);
}

export async function lookupAuthByEmail(
  env: Env,
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ uid: string; email: string; emailVerified?: boolean; customAttributes?: string } | null> {
  const data = await identityCall<{ users?: Array<{ localId?: string; email?: string; customAttributes?: string }> }>(
    env,
    'POST',
    '/accounts:lookup',
    { email: [email] },
    fetchImpl,
  );
  const u = data.users?.[0];
  return u?.localId ? {
    uid: u.localId,
    email: String(u.email || ''),
    emailVerified: !!(u as { emailVerified?: boolean }).emailVerified,
    customAttributes: u.customAttributes,
  } : null;
}

export async function lookupAuthByUid(
  env: Env,
  uid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ uid: string; email: string; emailVerified?: boolean; customAttributes?: string } | null> {
  const data = await identityCall<{ users?: Array<{ localId?: string; email?: string; customAttributes?: string }> }>(
    env,
    'POST',
    '/accounts:lookup',
    { localId: [uid] },
    fetchImpl,
  );
  const u = data.users?.[0];
  return u?.localId ? {
    uid: u.localId,
    email: String(u.email || ''),
    emailVerified: !!(u as { emailVerified?: boolean }).emailVerified,
    customAttributes: u.customAttributes,
  } : null;
}

export async function deleteAuthUser(env: Env, uid: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  await identityCall(env, 'POST', '/accounts:delete', { localId: uid }, fetchImpl);
}

export async function createEmployeeCustomToken(
  env: Env,
  uid: string,
  claims: Record<string, unknown>,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: CUSTOM_TOKEN_AUD,
    iat: now,
    exp: now + 300,
    uid,
    claims,
  };
  // O emulador Auth aceita tokens customizados sem assinatura. Em produção a
  // assinatura RSA abaixo é obrigatória.
  if (emulatorHost(env, 'auth')) {
    const header = base64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const body = base64Url(JSON.stringify(payload));
    return `${header}.${body}.`;
  }
  const account = sa(env);
  return signJwt(account, {
    ...payload,
    iss: account.client_email,
    sub: account.client_email,
  });
}

export interface PasswordSignInResult {
  uid: string;
  email: string;
  idToken: string;
}

/**
 * Valida uma password com a API pública do Identity Toolkit. A password nunca
 * é persistida nem registada; é usada apenas durante este pedido.
 */
export async function signInAuthPassword(
  env: Env,
  email: string,
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PasswordSignInResult | null> {
  const apiKey = String(env.FIREBASE_API_KEY || FIREBASE_WEB_API_KEY).trim();
  const emulator = emulatorHost(env, 'auth');
  const base = emulator
    ? `http://${emulator}/identitytoolkit.googleapis.com/v1`
    : IDENTITY_BASE;
  const key = apiKey || 'fake-api-key';
  try {
    const res = await fetchImpl(`${base}/accounts:signInWithPassword?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const data = await res.json().catch(() => ({})) as {
      localId?: string;
      email?: string;
      idToken?: string;
    };
    if (!res.ok) {
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return null;
      throw new Error(`Firebase Auth Admin indisponível (${res.status})`);
    }
    if (!data.localId || !data.idToken) return null;
    return { uid: data.localId, email: String(data.email || email), idToken: data.idToken };
  } catch (error) {
    if (String((error as Error)?.message || '').includes('Firebase Auth Admin indisponível')) throw error;
    throw new Error('Firebase Auth Admin temporariamente indisponível');
  }
}

function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, toFirestoreValue(v)]),
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

function fromFirestoreValue(value: Record<string, unknown>): unknown {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) {
    const values = (value.arrayValue as { values?: Record<string, unknown>[] })?.values || [];
    return values.map(fromFirestoreValue);
  }
  if ('mapValue' in value) {
    const fields = (value.mapValue as { fields?: Record<string, Record<string, unknown>> })?.fields || {};
    return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromFirestoreValue(v)]));
  }
  return null;
}

function fromFirestoreDoc<T>(doc: { name?: string; fields?: Record<string, Record<string, unknown>>; updateTime?: string }): StoredDoc<T> {
  const fields = doc.fields || {};
  return {
    data: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromFirestoreValue(v)])) as T,
    updateTime: doc.updateTime,
  };
}

function firestoreUrl(env: Env, path: string): string {
  const clean = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const emulator = emulatorHost(env, 'firestore');
  if (emulator) {
    return `http://${emulator}/v1/projects/${encodeURIComponent(projectId(env))}/databases/(default)/documents/${clean}`;
  }
  return `${FIRESTORE_BASE}/projects/${encodeURIComponent(projectId(env))}/databases/(default)/documents/${clean}`;
}

function firestoreCommitUrl(env: Env): string {
  const emulator = emulatorHost(env, 'firestore');
  if (emulator) {
    return `http://${emulator}/v1/projects/${encodeURIComponent(projectId(env))}/databases/(default)/documents:commit`;
  }
  return `${FIRESTORE_BASE}/projects/${encodeURIComponent(projectId(env))}/databases/(default)/documents:commit`;
}

async function firestoreHeaders(env: Env, fetchImpl: typeof fetch): Promise<Record<string, string>> {
  if (emulatorHost(env, 'firestore')) return { Authorization: 'Bearer owner' };
  return { Authorization: `Bearer ${await googleAccessToken(env, fetchImpl)}` };
}

export async function getFirestoreDoc<T = Record<string, unknown>>(
  env: Env,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<StoredDoc<T> | null> {
  const headers = await firestoreHeaders(env, fetchImpl);
  const res = await fetchImpl(firestoreUrl(env, path), { headers });
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Firestore GET falhou (${res.status})`);
  return fromFirestoreDoc<T>(data as never);
}

export async function patchFirestoreDoc<T = Record<string, unknown>>(
  env: Env,
  path: string,
  data: T,
  opts: { merge?: boolean } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const headers = await firestoreHeaders(env, fetchImpl);
  const fields = Object.fromEntries(
    Object.entries(data as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, toFirestoreValue(v)]),
  );
  const params = new URLSearchParams();
  if (opts.merge) {
    for (const k of Object.keys(fields)) params.append('updateMask.fieldPaths', k);
  }
  const suffix = params.size ? `?${params.toString()}` : '';
  const res = await fetchImpl(`${firestoreUrl(env, path)}${suffix}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Firestore PATCH falhou (${res.status})`);
}

export interface FirestoreArrayTransform {
  fieldPath: string;
  append?: unknown[];
  remove?: unknown[];
}

/**
 * Atualiza campos e arrays na mesma escrita atómica. Usado para members e
 * memberUids: dois administradores podem adicionar pessoas ao mesmo tempo sem
 * um substituir o mapa inteiro do outro.
 */
export async function commitFirestoreFields<T = Record<string, unknown>>(
  env: Env,
  path: string,
  data: T,
  updatePaths: string[],
  transforms: FirestoreArrayTransform[] = [],
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const headers = await firestoreHeaders(env, fetchImpl);
  const cleanPath = path.split('/').filter(Boolean).join('/');
  const name = `projects/${projectId(env)}/databases/(default)/documents/${cleanPath}`;
  const fields = Object.fromEntries(
    Object.entries(data as Record<string, unknown>)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, toFirestoreValue(value)]),
  );
  const updateTransforms = transforms.map((transform) => ({
    fieldPath: transform.fieldPath,
    ...(transform.append?.length
      ? { appendMissingElements: { values: transform.append.map(toFirestoreValue) } }
      : {}),
    ...(transform.remove?.length
      ? { removeAllFromArray: { values: transform.remove.map(toFirestoreValue) } }
      : {}),
  }));
  const write = {
    update: { name, fields },
    ...(updatePaths.length ? { updateMask: { fieldPaths: updatePaths } } : {}),
    ...(updateTransforms.length ? { updateTransforms } : {}),
  };
  const res = await fetchImpl(firestoreCommitUrl(env), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [write] }),
  });
  if (!res.ok) throw new Error(`Firestore COMMIT falhou (${res.status})`);
}

export async function deleteFirestoreDoc(env: Env, path: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const headers = await firestoreHeaders(env, fetchImpl);
  const res = await fetchImpl(firestoreUrl(env, path), {
    method: 'DELETE',
    headers,
  });
  if (!res.ok && res.status !== 404) throw new Error(`Firestore DELETE falhou (${res.status})`);
}

export async function firestoreList(
  env: Env,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Array<{ path: string; data: Record<string, unknown> }>> {
  const headers = await firestoreHeaders(env, fetchImpl);
  const out: Array<{ path: string; data: Record<string, unknown> }> = [];
  let pageToken = '';
  do {
    const url = new URL(firestoreUrl(env, path));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetchImpl(url.toString(), { headers });
    if (res.status === 404) break;
    const data = await res.json().catch(() => ({})) as {
      documents?: Array<{ name?: string; fields?: Record<string, Record<string, unknown>> }>;
      nextPageToken?: string;
    };
    if (!res.ok) throw new Error(`Firestore LIST falhou (${res.status})`);
    for (const d of data.documents || []) {
      const decoded = fromFirestoreDoc<Record<string, unknown>>(d).data;
      out.push({ path: String(d.name || '').split('/documents/')[1] || '', data: decoded });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}

export async function hashEmail(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function writeAccessAudit(
  env: Env,
  input: { uid: string; email?: string; type: string; detail?: string; gabineteId?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const id = `aud_${crypto.randomUUID()}`;
  await patchFirestoreDoc(env, `audit_events/${id}`, {
    uid: input.uid,
    email: input.email || '',
    type: input.type,
    detail: input.detail || '',
    empresaId: input.gabineteId || '',
    ts: Date.now(),
  }, {}, fetchImpl).catch(() => {});
}
