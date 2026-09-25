/**
 * TOConline — importação de clientes via API oficial (api-docs.toconline.pt).
 *
 * As credenciais (client_id/secret + URLs) são do GABINETE — cada empresa gera as
 * suas em Empresa › Configurações › Dados API e cola aqui. Ficam só no browser
 * (localStorage por gabinete), nunca vão para o Firestore.
 *
 * Fluxo OAuth: auth?client_id&redirect_uri → code → token (4h) → GET /customers.
 */
import { loadFromStorage, saveToStorage } from './storage';

export interface TocConfig {
  oauthUrl: string;
  apiUrl: string;
  clientId: string;
  secret: string;
}

export interface TocTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface TocCustomerDraft {
  nome: string;
  nif: string;
  email?: string;
  telefone?: string;
  morada?: string;
  localidade?: string;
  codigoPostal?: string;
}

const CFG_KEY = 'toconline:config';
const TOK_KEY = 'toconline:tokens';
const PENDING_KEY = 'toconline:pending';
const DRAFT_KEY = 'toconline:draft';
const OPEN_KEY = 'toconline:open-import';

export function getTocConfig(): TocConfig | null {
  try { return loadFromStorage<TocConfig | null>(CFG_KEY, null); } catch { return null; }
}
export function saveTocConfig(c: TocConfig): void { saveToStorage(CFG_KEY, c); }
export function clearTocConfig(): void {
  try { localStorage.removeItem('estudo360:v1:' + CFG_KEY); } catch {}
  try { localStorage.removeItem(CFG_KEY); } catch {}
  clearTocTokens();
}
export function getTocTokens(): TocTokens | null {
  try { return loadFromStorage<TocTokens | null>(TOK_KEY, null); } catch { return null; }
}
export function saveTocTokens(t: TocTokens): void { saveToStorage(TOK_KEY, t); }
export function clearTocTokens(): void {
  try { localStorage.removeItem('estudo360:v1:' + TOK_KEY); } catch {}
  try { localStorage.removeItem(TOK_KEY); } catch {}
}
export function isTocConnected(): boolean {
  const t = getTocTokens();
  return !!t && !!t.accessToken;
}

function redirectUri(): string {
  return window.location.origin + '/';
}

export function buildTocAuthUrl(cfg: TocConfig, state: string): string {
  const base = cfg.oauthUrl.replace(/\/$/, '');
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'commercial',
    state,
  });
  return `${base}/auth?${p.toString()}`;
}

function basicAuth(cfg: TocConfig): string {
  return 'Basic ' + btoa(`${cfg.clientId}:${cfg.secret}`);
}

export async function exchangeTocCode(cfg: TocConfig, code: string): Promise<TocTokens> {
  const base = cfg.oauthUrl.replace(/\/$/, '');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    scope: 'commercial',
  });
  const r = await fetch(`${base}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: basicAuth(cfg),
    },
    body: body.toString(),
  });
  if (!r.ok) throw new Error(`TOConline recusou o código (${r.status}). Verifique as credenciais.`);
  const j = await r.json();
  if (!j.access_token) throw new Error('TOConline não devolveu access_token.');
  const tokens: TocTokens = {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || '',
    expiresAt: Date.now() + (Number(j.expires_in) || 14400) * 1000,
  };
  saveTocTokens(tokens);
  return tokens;
}

export async function refreshTocToken(cfg: TocConfig): Promise<TocTokens> {
  const cur = getTocTokens();
  if (!cur?.refreshToken) throw new Error('Sem refresh_token — ligue novamente.');
  const base = cfg.oauthUrl.replace(/\/$/, '');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: cur.refreshToken,
    scope: 'commercial',
  });
  const r = await fetch(`${base}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: basicAuth(cfg),
    },
    body: body.toString(),
  });
  if (!r.ok) throw new Error('Sessão TOConline expirou — ligue novamente.');
  const j = await r.json();
  const tokens: TocTokens = {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || cur.refreshToken,
    expiresAt: Date.now() + (Number(j.expires_in) || 14400) * 1000,
  };
  saveTocTokens(tokens);
  return tokens;
}

export async function getValidTocToken(cfg: TocConfig): Promise<string> {
  const cur = getTocTokens();
  if (cur && cur.accessToken && cur.expiresAt - Date.now() > 60000) return cur.accessToken;
  if (cur?.refreshToken) return (await refreshTocToken(cfg)).accessToken;
  throw new Error('Ligue a sua conta TOConline primeiro.');
}

/** Lista clientes da empresa ligada (JSONAPI: {data:[{attributes}]}, com paginação). */
export async function fetchTocCustomers(cfg: TocConfig): Promise<TocCustomerDraft[]> {
  const token = await getValidTocToken(cfg);
  const base = cfg.apiUrl.replace(/\/$/, '');
  const out: TocCustomerDraft[] = [];
  let page = 1;
  for (let guard = 0; guard < 25; guard++) {
    const r = await fetch(`${base}/customers?page[number]=${page}&page[size]=100`, {
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (r.status === 401) {
      const nt = await refreshTocToken(cfg);
      const r2 = await fetch(`${base}/customers?page[number]=${page}&page[size]=100`, {
        headers: {
          'Content-Type': 'application/vnd.api+json',
          Accept: 'application/json',
          Authorization: `Bearer ${nt.accessToken}`,
        },
      });
      if (!r2.ok) throw new Error(`TOConline devolveu ${r2.status} ao listar clientes.`);
      const j2 = await r2.json();
      const items2 = Array.isArray(j2.data) ? j2.data : [];
      if (!items2.length) break;
      for (const it of items2) out.push(mapTocCustomer(it));
      if (items2.length < 100) break;
      page++;
      continue;
    }
    if (!r.ok) throw new Error(`TOConline devolveu ${r.status} ao listar clientes.`);
    const j = await r.json();
    const items = Array.isArray(j.data) ? j.data : [];
    if (!items.length) break;
    for (const it of items) out.push(mapTocCustomer(it));
    const totalPages = j.meta?.totalPages ?? j.meta?.['total-pages'];
    if (items.length < 100 || (typeof totalPages === 'number' && page >= totalPages)) break;
    page++;
  }
  return out;
}

function mapTocCustomer(it: any): TocCustomerDraft {
  const a = it?.attributes ?? {};
  return {
    nome: String(a.business_name ?? a.name ?? '').trim(),
    nif: String(a.tax_registration_number ?? a.fiscal_id ?? '').replace(/\D/g, ''),
    email: a.email ?? undefined,
    telefone: a.mobile_number ?? a.phone_number ?? undefined,
    morada: a.address_detail ?? undefined,
    localidade: a.city ?? undefined,
    codigoPostal: a.postcode ?? undefined,
  };
}

// ——— estado do fluxo OAuth entre redirects ———
export function setTocPending(v: boolean): string {
  try {
    if (v) {
      const state = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      saveToStorage(PENDING_KEY, { state, at: Date.now() });
      return state;
    }
    try { localStorage.removeItem('estudo360:v1:' + PENDING_KEY); } catch {}
    try { localStorage.removeItem(PENDING_KEY); } catch {}
  } catch {}
  return '';
}
export function pendingState(): string {
  try {
    const p = loadFromStorage<{ state?: string } | null>(PENDING_KEY, null);
    if (p?.state) return p.state;
  } catch {}
  return '';
}
export function saveTocDraft(list: TocCustomerDraft[]): void { saveToStorage(DRAFT_KEY, list); }
export function getTocDraft(): TocCustomerDraft[] {
  try { return loadFromStorage<TocCustomerDraft[]>(DRAFT_KEY, []); } catch { return []; }
}
export function clearTocDraft(): void {
  try { localStorage.removeItem('estudo360:v1:' + DRAFT_KEY); } catch {}
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}
export function requestTocOpen(): void { saveToStorage(OPEN_KEY, true); }
export function consumeTocOpen(): boolean {
  let v = false;
  try { v = loadFromStorage<boolean>(OPEN_KEY, false); } catch {}
  try { localStorage.removeItem('estudo360:v1:' + OPEN_KEY); } catch {}
  try { localStorage.removeItem(OPEN_KEY); } catch {}
  return v;
}
export function tocRedirectUri(): string { return redirectUri(); }
