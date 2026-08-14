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
    plugins: [react(), tailwindcss(), vitePluginVersion(), devChatProxy()],
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
      // Split heavy vendors into their own chunks so the initial bundle stays
      // small and they cache independently across deploys.
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/firestore'],
            'vendor-charts': ['recharts'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
  };
});
