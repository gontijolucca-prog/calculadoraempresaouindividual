import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {readFileSync} from 'fs';
import {homedir} from 'os';
import {join} from 'path';
import {vitePluginVersion} from './vite-plugin-version';

// Dev-only: serve o /api/chat (AI Contabilista) com a chave do OpenCode Go local.
// Em produção quem serve é a Cloudflare Pages Function (functions/api/chat.ts).
// A chave é lida do auth.json do opencode — nunca vai para o cliente.
function devTocProxy(): Plugin {
  return {
    name: 'dev-toc-proxy',
    configureServer(server) {
      server.middlewares.use('/api/toconline', async (req, res) => {
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.end(); return; }
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"error":"metodo"}'); return; }
        try {
          let body = ''; for await (const chunk of req) body += chunk;
          const j = JSON.parse(body || '{}');
          const action = String(j.action || '');
          if (action === 'exchange' || action === 'refresh') {
            const oauthUrl = String(j.oauthUrl || '').replace(/\/$/, '');
            const clientId = String(j.clientId || '').trim();
            const secret = String(j.secret || '').trim();
            if (!oauthUrl || !clientId || !secret) { res.statusCode = 400; res.end(JSON.stringify({ error: 'credenciais_em_falta' })); return; }
            const p = new URLSearchParams();
            if (action === 'exchange') { if (!j.code) { res.statusCode = 400; res.end(JSON.stringify({ error: 'code_em_falta' })); return; } p.set('grant_type', 'authorization_code'); p.set('code', String(j.code)); p.set('scope', 'commercial'); if (j.redirectUri) p.set('redirect_uri', String(j.redirectUri)); }
            else { if (!j.refreshToken) { res.statusCode = 400; res.end(JSON.stringify({ error: 'refresh_em_falta' })); return; } p.set('grant_type', 'refresh_token'); p.set('refresh_token', String(j.refreshToken)); p.set('scope', 'commercial'); }
            const r = await fetch(`${oauthUrl}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Authorization: 'Basic ' + Buffer.from(`${clientId}:${secret}`).toString('base64') }, body: p.toString() });
            const text = await r.text(); let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
            res.statusCode = r.status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return;
          }
          if (action === 'customers') {
            const apiUrl = String(j.apiUrl || '').replace(/\/$/, ''); const token = String(j.accessToken || '').trim();
            if (!apiUrl || !token) { res.statusCode = 400; res.end(JSON.stringify({ error: 'parametros_em_falta' })); return; }
            const out: any[] = []; let page = 1;
            for (let guard = 0; guard < 25; guard++) {
              const r = await fetch(`${apiUrl}/customers?page[number]=${page}&page[size]=100`, { headers: { 'Content-Type': 'application/vnd.api+json', Accept: 'application/json', Authorization: `Bearer ${token}` } });
              if (r.status === 401) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'nao_autorizado', status: 401 })); return; }
              if (!r.ok) { const t = await r.text(); res.statusCode = r.status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'toconline_erro', status: r.status, detail: t.slice(0, 2000) })); return; }
              const data: any = await r.json(); const items = Array.isArray(data.data) ? data.data : []; if (!items.length) break;
              for (const it of items) { const a = it?.attributes ?? {}; out.push({ nome: String(a.business_name ?? a.name ?? '').trim(), nif: String(a.tax_registration_number ?? a.fiscal_id ?? '').replace(/\D/g, ''), email: a.email ?? undefined, telefone: a.mobile_number ?? a.phone_number ?? undefined, morada: a.address_detail ?? undefined, localidade: a.city ?? undefined, codigoPostal: a.postcode ?? undefined }); }
              const tp = data.meta?.totalPages ?? data.meta?.['total-pages']; if (items.length < 100 || (typeof tp === 'number' && page >= tp)) break; page++;
            }
            res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: out })); return;
          }
          res.statusCode = 400; res.end(JSON.stringify({ error: 'acao_invalida' }));
        } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: 'proxy_dev', detail: String(e?.message || e) })); }
      });
    },
  };
}

function devChatProxy(): Plugin {
  return {
    name: 'dev-chat-proxy',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"error":"metodo"}'); return; }
        try {
          let body = '';
          for await (const chunk of req) body += chunk;
          const { messages, appContext } = JSON.parse(body);
          const authPath = join(homedir(), '.local/share/opencode/auth.json');
          const auth = JSON.parse(readFileSync(authPath, 'utf8'));
          const key = auth?.['opencode-go']?.key;
          if (!key) { res.statusCode = 503; res.end(JSON.stringify({ reply: 'Sem chave OpenCode Go no auth.json local.' })); return; }
          const { SYSTEM_PROMPT } = await import('./functions/_systemPrompt');
          const { KNOWLEDGE_BASE } = await import('./functions/_kb');
          const ctx = typeof appContext === 'string' ? appContext.slice(0, 6000) : '';
          const sys = SYSTEM_PROMPT + '\n\n' + KNOWLEDGE_BASE + (ctx ? `\n\n# Contexto atual da aplicação (anonimizado)\n${ctx}` : '');
          const msgs = Array.isArray(messages) ? messages.slice(-24).map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) })) : [];
          const out = await fetch('https://opencode.ai/zen/go/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'system', content: sys }, ...msgs], max_tokens: 1100, temperature: 0.4 }),
          });
          const data: any = await out.json();
          const reply: string = data?.choices?.[0]?.message?.content?.trim() || '';
          if (!reply) { res.statusCode = 502; res.end(JSON.stringify({ reply: 'Modelo não respondeu. Tenta de novo.' })); return; }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ reply, model: 'deepseek-v4-flash' }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ reply: 'Proxy dev em erro: ' + (e?.message || 'desconhecido') }));
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // Dynamically set the base path if provided by the environment (e.g., GitHub Actions),
  // otherwise fallback to relative paths logic.
  const basePath = process.env.VITE_BASE_URL || './';

  return {
    base: basePath,
    plugins: [react(), tailwindcss(), vitePluginVersion(), devTocProxy(), devChatProxy()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // File watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      chunkSizeWarningLimit: 1200,
      // Split heavy vendors into their own chunks so the initial bundle stays
      // small and they cache independently across deploys. Gzip 450kB < 500kB.
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
            'vendor-charts': ['recharts'],
            'vendor-icons': ['lucide-react'],
            'vendor-pdf': ['jspdf', 'html2canvas'],
          },
        },
      },
    },
  };
});
