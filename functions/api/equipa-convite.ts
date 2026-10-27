/**
 * Envio do convite de equipa pelo servidor (o browser não fala com o fornecedor).
 *
 * POST /api/equipa-convite
 *  { to, nome, gabinete, cargo, idToken }
 *
 * - Verifica o idToken do Firebase (Google valida a assinatura) para impedir abuso.
 * - Envia por Resend se existir RESEND_API_KEY; senão pela binding SEND_EMAIL
 *   (Cloudflare Email Routing); senão devolve 501 email_nao_configurado.
 */

type PagesFunction = (ctx: { request: Request; env: Record<string, unknown> }) => Promise<Response>;

const ALLOWED_ORIGINS = ['https://estudo360.pt', 'https://www.estudo360.pt', 'https://estudo360.pages.dev', 'http://localhost:3000', 'http://localhost:3100', 'http://localhost:3200', 'http://localhost:3300', 'http://localhost:3400', 'http://127.0.0.1:3000'];
const FIREBASE_PROJECT = 'recofatima-ferramenta';
const FIREBASE_KEY = 'AIzaSyBxc-JFWwxlauY6U4A3IKTxxd5UFiDzjhI';
const RL = new Map<string, number[]>();

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://estudo360.pt',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  Vary: 'Origin',
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });

export function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
}

export function montarEmailConvite(nome: string, email: string, gabinete: string, cargo: string, link = 'https://estudo360.pt'): { subject: string; text: string; html: string } {
  const primeiro = String(nome || '').trim().split(/\s+/)[0] || 'olá';
  const cargoTxt = cargo === 'admin' ? 'administrador' : cargo === 'contabilista' ? 'contabilista' : 'estagiária';
  const subject = `Convite para a equipa ${gabinete ? `do gabinete ${gabinete}` : 'do Estudo360'}`;
  const text = `Olá ${primeiro},

Fui convidar-te para a equipa ${gabinete ? `do gabinete ${gabinete} ` : ''}no Estudo360, como ${cargoTxt}.

1. Abre o link: ${link}
2. Define uma password forte (duas vezes)
3. Entras direto no gabinete, pronta a trabalhar

A conta fica criada com este email: ${email}. Qualquer dúvida, responde a este email.`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1A1A18">
  <h2 style="font-size:18px;margin:0 0 8px">Convite para a equipa${gabinete ? ` do gabinete <b>${escapeHtml(gabinete)}</b>` : ''}</h2>
  <p style="margin:0 0 12px;line-height:1.6">Olá ${escapeHtml(primeiro)}, foi criado um convite para <b>${escapeHtml(email)}</b> como <b>${cargoTxt}</b>.</p>
  <ol style="line-height:1.8;margin:0 0 14px 18px;padding:0">
    <li>Abre o <a href="${link}" style="color:#0677FF">link do convite</a></li>
    <li>Define uma password forte (duas vezes)</li>
    <li>Entras direto no gabinete, pronta a trabalhar</li>
  </ol>
  <p style="margin:0;color:#64748B;font-size:13px">A conta fica criada com este email.</p>
</div>`;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string));
}

export const onRequestOptions: PagesFunction = async ({ request }) => new Response(null, { status: 204, headers: cors(request.headers.get('Origin')) });

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const origin = request.headers.get('Origin');
  let body: any = {};
  try { body = await request.json(); } catch { return json({ erro: 'json_invalido' }, 400, origin); }

  const to = String(body.to || '').trim().toLowerCase();
  const nome = String(body.nome || '').trim();
  const gabinete = String(body.gabinete || '').trim();
  const cargo = String(body.cargo || 'contabilista').trim();
  const idToken = String(body.idToken || '').trim();
  if (!emailValido(to)) return json({ erro: 'email_invalido' }, 400, origin);
  if (!nome) return json({ erro: 'nome_em_falta' }, 400, origin);
  if (!idToken) return json({ erro: 'sem_sessao' }, 401, origin);

  // Google valida o token; só quem tem sessão pode pedir convites.
  let uid = '';
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${(env as any).FIREBASE_API_KEY || FIREBASE_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
    });
    const j: any = await r.json();
    uid = j?.users?.[0]?.localId || '';
    if (!r.ok || !uid) return json({ erro: 'sessao_invalida' }, 401, origin);
  } catch {
    return json({ erro: 'sessao_invalida' }, 401, origin);
  }

  // Limite simples: 30 convites por hora por utilizador (best-effort por isolate).
  const now = Date.now();
  const hits = (RL.get(uid) || []).filter((t) => now - t < 60 * 60_000);
  if (hits.length >= 30) return json({ erro: 'limite_de_convites' }, 429, origin);
  hits.push(now); RL.set(uid, hits);

  const token = String(body.token || '').trim();
  const link = token ? `https://estudo360.pt/convite?t=${encodeURIComponent(token)}` : 'https://estudo360.pt';
  const mail = montarEmailConvite(nome, to, gabinete, cargo, link);
  const from = String((env as any).MAIL_FROM || 'Estudo360 <convites@estudo360.pt>');

  // 1) Resend
  const resend = (env as any).RESEND_API_KEY;
  if (resend) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) return json({ erro: 'resend_recusou', detalhe: j?.message || r.status }, 502, origin);
      return json({ ok: true, via: 'resend', id: j?.id || null }, 200, origin);
    } catch (e: any) {
      return json({ erro: 'resend_falhou', detalhe: String(e?.message || e) }, 502, origin);
    }
  }

  // 2) Binding de email da Cloudflare (se estiver configurada)
  const sendEmail = (env as any).SEND_EMAIL;
  if (sendEmail && typeof sendEmail.send === 'function') {
    try {
      await sendEmail.send({ to, from, subject: mail.subject, html: mail.html, text: mail.text });
      return json({ ok: true, via: 'cloudflare' }, 200, origin);
    } catch (e: any) {
      return json({ erro: 'email_binding_falhou', detalhe: String(e?.message || e) }, 502, origin);
    }
  }

  return json({ erro: 'email_nao_configurado', como: 'Definir RESEND_API_KEY (ou a binding SEND_EMAIL) no projeto Cloudflare Pages.' }, 501, origin);
};
