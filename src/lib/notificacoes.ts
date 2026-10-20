/**
 * Prazos notificáveis — obrigações, alertas e datas SAF-T.
 * Cálculo puro (testável): dias por data local, sem horas, para evitar o
 * clássico off-by-one de vencimentos às 00:00.
 */
import type { AlertaGabinete, GabineteCliente, Obrigacao } from './gabinete';

export type Severidade = 'atrasado' | 'hoje' | 'proximo' | 'futuro';
export type TipoPrazo = 'obrigacao' | 'alerta' | 'saft' | 'calendario';

export interface PrazoNotificavel {
  chave: string;
  tipo: TipoPrazo;
  id: string;
  titulo: string;
  clienteId?: string;
  cliente?: string;
  vencimento: number;
  dias: number;
  severidade: Severidade;
}

export function diaLocal(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function diaChave(ms: number = Date.now()): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dias de calendário até ao vencimento (negativo = atrasado). */
export function diasAte(vencimento: number, hoje: number = Date.now()): number {
  return Math.round((diaLocal(vencimento) - diaLocal(hoje)) / 86400000);
}

export function severidadeDe(dias: number, janelaDias = 7): Severidade {
  if (dias < 0) return 'atrasado';
  if (dias === 0) return 'hoje';
  if (dias <= janelaDias) return 'proximo';
  return 'futuro';
}

export function chaveNotificacao(p: Pick<PrazoNotificavel, 'tipo' | 'id'>): string {
  return `${p.tipo}|${p.id}`;
}

export interface EntradaPrazos {
  clientes?: GabineteCliente[];
  obrigacoes: Obrigacao[];
  alertas?: AlertaGabinete[];
  hoje?: number;
  janelaDias?: number;
}

function tituloCurto(t: string, max = 90): string {
  const s = (t || '').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Prazos em atraso ou a vencer dentro da janela, ordenados do mais urgente. */
export function prazosNotificaveis({
  clientes = [], obrigacoes, alertas = [], hoje = Date.now(), janelaDias = 7,
}: EntradaPrazos): PrazoNotificavel[] {
  const out: PrazoNotificavel[] = [];
  const nomePorId = new Map(clientes.map(c => [c.id, c.nome]));

  for (const o of obrigacoes) {
    if (o.deletedAt) continue;
    if (o.origem === 'calendario_fiscal') continue;
    if (o.estado === 'entregue' || o.estado === 'dispensada') continue;
    if (!o.vencimento) continue;
    const dias = diasAte(o.vencimento, hoje);
    if (dias > janelaDias) continue;
    const tipo: TipoPrazo = o.catalogoId === 'saft' ? 'saft' : 'obrigacao';
    out.push({
      chave: chaveNotificacao({ tipo, id: o.id }),
      tipo,
      id: o.id,
      titulo: tituloCurto(o.titulo),
      clienteId: o.clienteId,
      cliente: o.clienteNome || nomePorId.get(o.clienteId),
      vencimento: o.vencimento,
      dias,
      severidade: severidadeDe(dias, janelaDias),
    });
  }

  for (const a of alertas) {
    if (a.deletedAt) continue;
    if ((a.estado ?? 'aberto') !== 'aberto') continue;
    if (!a.vencimento) continue;
    const dias = diasAte(a.vencimento, hoje);
    if (dias > janelaDias) continue;
    out.push({
      chave: chaveNotificacao({ tipo: 'alerta', id: a.id }),
      tipo: 'alerta',
      id: a.id,
      titulo: tituloCurto(a.texto),
      clienteId: a.clienteId,
      cliente: a.clienteNome || nomePorId.get(a.clienteId),
      vencimento: a.vencimento,
      dias,
      severidade: severidadeDe(dias, janelaDias),
    });
  }

  return out.sort((x, y) => x.vencimento - y.vencimento);
}

export function resumoBadge(lista: PrazoNotificavel[]): { total: number; atrasados: number; hoje: number } {
  return {
    total: lista.length,
    atrasados: lista.filter(p => p.severidade === 'atrasado').length,
    hoje: lista.filter(p => p.severidade === 'hoje').length,
  };
}

/** Só os ainda não vistos hoje (por chave). */
export function porLer(
  lista: PrazoNotificavel[],
  lidas: Record<string, string>,
  hoje: number = Date.now(),
): PrazoNotificavel[] {
  const dia = diaChave(hoje);
  return lista.filter(p => lidas[p.chave] !== dia);
}

/** Próximas datas de SAF-T online (dia 5 do mês seguinte). */
export function proximosSaft(obrigacoes: Obrigacao[], hoje: number = Date.now(), limite = 3): PrazoNotificavel[] {
  return obrigacoes
    .filter(o => o.catalogoId === 'saft' && !o.deletedAt && o.origem !== 'calendario_fiscal')
    .map(o => {
      const dias = diasAte(o.vencimento, hoje);
      return {
        chave: chaveNotificacao({ tipo: 'saft', id: o.id }),
        tipo: 'saft' as const,
        id: o.id,
        titulo: o.titulo,
        clienteId: o.clienteId,
        cliente: o.clienteNome,
        vencimento: o.vencimento,
        dias,
        severidade: severidadeDe(dias),
      };
    })
    .filter(p => p.dias >= 0)
    .sort((a, b) => a.vencimento - b.vencimento)
    .slice(0, limite);
}

// ─── Preferência do utilizador (localStorage) ────────────────────────────────
const CHAVE_LIDAS = 'estudo360:notif:lidas';
const CHAVE_ATIVAS = 'estudo360:notif:ativas';

export function lerLidas(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CHAVE_LIDAS);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
  } catch { return {}; }
}

export function marcarLida(p: PrazoNotificavel, hoje: number = Date.now()): void {
  try {
    const atuais = lerLidas();
    atuais[p.chave] = diaChave(hoje);
    // poda: guarda só os últimos 60 dias de chaves
    const limite = diaChave(hoje - 60 * 86400000);
    const podado = Object.fromEntries(Object.entries(atuais).filter(([, v]) => v >= limite));
    localStorage.setItem(CHAVE_LIDAS, JSON.stringify(podado));
  } catch {}
}

export function notificacoesAtivas(): boolean {
  try { return localStorage.getItem(CHAVE_ATIVAS) === '1'; } catch { return false; }
}

export function setNotificacoesAtivas(v: boolean): void {
  try { localStorage.setItem(CHAVE_ATIVAS, v ? '1' : '0'); } catch {}
}

export function permissaoNotificacoes(): 'granted' | 'denied' | 'default' | 'indisponivel' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'indisponivel';
  return Notification.permission;
}

export function pedirPermissaoNotificacoes(): Promise<NotificationPermission | 'indisponivel'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve('indisponivel');
  return Notification.requestPermission();
}

/** Dispara notificações do sistema para prazos ainda não vistos hoje. */
export function enviarNotificacoes(lista: PrazoNotificavel[], hoje: number = Date.now()): number {
  if (!notificacoesAtivas() || permissaoNotificacoes() !== 'granted') return 0;
  const novas = porLer(lista, lerLidas(), hoje).filter(p => p.severidade !== 'futuro');
  let n = 0;
  for (const p of novas.slice(0, 3)) {
    try {
      const quando = p.dias === 0 ? 'vence hoje' : p.dias === 1 ? 'vence amanhã' : `vence em ${p.dias} dias`;
      const corpo = p.dias < 0
        ? `Atrasado ${Math.abs(p.dias)} dia(s)${p.cliente ? ` · ${p.cliente}` : ''}`
        : `${quando}${p.cliente ? ` · ${p.cliente}` : ''}`;
      new Notification(p.titulo, { body: corpo, tag: p.chave, lang: 'pt-PT' });
      marcarLida(p, hoje);
      n++;
    } catch {}
  }
  return n;
}
