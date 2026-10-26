import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {readFileSync} from 'fs';
import {homedir} from 'os';
import {join} from 'path';
import {vitePluginVersion} from './vite-plugin-version';

// Dev-only: relaxa o CSP do index.html para a app poder falar com o
// Firebase Emulator Suite local (auth 9199 / firestore 8180). Em produção
// o index.html fica intocado.
function devEmulatorCsp(): Plugin {
  return {
    name: 'dev-emulator-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        "connect-src 'self'",
        "connect-src 'self' http://127.0.0.1:9199 http://127.0.0.1:8180",
      );
    },
  };
}

// Dev-only: serve o /api/chat (AI Contabilista) com a chave do OpenCode Go local.
// Em produção quem serve é a Cloudflare Pages Function (functions/api/chat.ts).
// A chave é lida do auth.json do opencode — nunca vai para o cliente.
function devTocProxy(): Plugin {
  return {
    name: 'dev-toc-proxy',
    configureServer(server) {
      // Usa a Function real (dev == produção), como o /api/chat e o /api/deck.
      server.middlewares.use('/api/toconline', async (req, res) => {
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.end(); return; }
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"error":"metodo"}'); return; }
        try {
          let body = '';
          for await (const chunk of req) body += chunk;
          const { onRequestPost } = await import('./functions/api/toconline');
          const request = new Request('http://localhost/api/toconline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Referer: 'http://localhost:3000/' },
            body,
          });
          const response = await onRequestPost({ request });
          const text = await response.text();
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(text);
        } catch (e: any) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'proxy_dev', detail: String(e?.message || e) }));
        }
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
          // Chave do OpenCode Go local (opcional: o Kilo responde sem chave).
          let key = process.env.OPENCODE_GO_KEY || '';
          if (!key) {
            try {
              const authPath = join(homedir(), '.local/share/opencode/auth.json');
              key = JSON.parse(readFileSync(authPath, 'utf8'))?.['opencode-go']?.key || '';
            } catch { /* sem auth local */ }
          }
          // Usa a Function real (dev == produção), como o /api/deck.
          const { onRequestPost } = await import('./functions/api/chat');
          const request = new Request('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
            body,
          });
          const t0 = Date.now();
          const response = await onRequestPost({ request, env: { OPENCODE_GO_KEY: key } });
          const text = await response.text();
          const provider = (() => { try { return JSON.parse(text).provider || '-'; } catch { return '-'; } })();
          console.log(`[dev-chat] ${response.status} em ${Date.now() - t0}ms (${provider})`);
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(text);
        } catch (e: any) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'proxy_dev', detail: String(e?.message || e) }));
        }
      });
    },
  };
}

// Dev-only: serve o /api/deck (gerador de propostas) com a mesma lógica da
// Function de produção. A chave vem do auth.json do opencode — como no /api/chat.
function devDeckProxy(): Plugin {
  return {
    name: 'dev-deck-proxy',
    configureServer(server) {
      server.middlewares.use('/api/deck', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"error":"metodo"}'); return; }
        try {
          let body = '';
          for await (const chunk of req) body += chunk;
          let key = process.env.OPENCODE_GO_KEY || '';
          if (!key) {
            try {
              const authPath = join(homedir(), '.local/share/opencode/auth.json');
              key = JSON.parse(readFileSync(authPath, 'utf8'))?.['opencode-go']?.key || '';
            } catch { /* sem auth local — a Function responde config */ }
          }
          const { onRequestPost } = await import('./functions/api/deck');
          const request = new Request('http://localhost/api/deck', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
            body,
          });
          const t0 = Date.now();
          const response = await onRequestPost({ request, env: { OPENCODE_GO_KEY: key } });
          const text = await response.text();
          console.log(`[dev-deck] ${response.status} em ${Date.now() - t0}ms (brief ${body.length} chars)`);
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(text);
        } catch (e: any) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'proxy_dev', detail: String(e?.message || e) }));
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
    plugins: [react(), tailwindcss(), vitePluginVersion(), devTocProxy(), devChatProxy(), devDeckProxy(), devEmulatorCsp()],
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
