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
  let base = cfg.oauthUrl.replace(/\/$/, '');
  if (!base.toLowerCase().includes('/auth')) base = base + '/auth';
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'commercial',
    state,
  });
  return `${base}?${p.toString()}`;
}

async function callTocProxy(payload: Record<string, unknown>): Promise<any> {
  const r = await fetch('/api/toconline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detail = j?.detail ? ` — ${typeof j.detail === 'string' ? j.detail.slice(0, 300) : JSON.stringify(j.detail).slice(0, 300)}` : '';
    const msg = j?.error ? `${j.error} (${r.status})${detail}` : `TOConline devolveu ${r.status}${detail}`;
    throw new Error(msg);
  }
  return j;
}

export async function exchangeTocCode(cfg: TocConfig, code: string): Promise<TocTokens> {
  const j = await callTocProxy({
    action: 'exchange',
    oauthUrl: cfg.oauthUrl,
    clientId: cfg.clientId,
    secret: cfg.secret,
    code,
    redirectUri: redirectUri(),
  });
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
  const j = await callTocProxy({
    action: 'refresh',
    oauthUrl: cfg.oauthUrl,
    clientId: cfg.clientId,
    secret: cfg.secret,
    refreshToken: cur.refreshToken,
  });
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

export let lastTocDebug: any = null;
export function getLastTocDebug(): any { return lastTocDebug; }
/** Lista clientes da empresa ligada — via proxy /api/toconline (evita CORS). */
export async function fetchTocCustomers(cfg: TocConfig): Promise<TocCustomerDraft[]> {
  const token = await getValidTocToken(cfg);
  try {
    const j = await callTocProxy({ action: 'customers', apiUrl: cfg.apiUrl, accessToken: token });
    lastTocDebug = (j as any)?.debug ?? null;
    if (Array.isArray(j.data)) return j.data as TocCustomerDraft[];
    if (Array.isArray(j)) return j as TocCustomerDraft[];
    return [];
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('nao_autorizado') || msg.includes('401')) {
      const nt = await refreshTocToken(cfg);
      const j2 = await callTocProxy({ action: 'customers', apiUrl: cfg.apiUrl, accessToken: nt.accessToken });
      lastTocDebug = (j2 as any)?.debug ?? null;
      if (Array.isArray(j2.data)) return j2.data as TocCustomerDraft[];
      return [];
    }
    throw e;
  }
}

function mapTocCustomer(_it: any): TocCustomerDraft {
  const a = _it?.attributes ?? {};
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
void mapTocCustomer;

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
