import { instalarMarcasObrigatorias } from './lib/requiredMarks';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import PropostaPublica from './PropostaPublica.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import { AuthProvider } from './lib/auth';
import { slugFromPath } from './lib/deck/share';
import './index.css';

// O version-checker é iniciado dentro do App (useEffect), para poder mostrar o
// aviso "nova versão" e respeitar edições por guardar antes de recarregar.

// Link público da proposta: /p/<slug> — sem login, sem App (nem auth gate).
const publicSlug = slugFromPath(window.location.pathname);

// Deploy a meio: um chunk antigo pode já não existir (ou o Pages devolveu o
// index.html no lugar dele). Em vez do ecrã de erro, recarrega uma vez —
// sempre com a entrada falhada refrescada, para não voltar ao mesmo ficheiro.
function recuperarChunk(entry?: string) {
  try {
    const ultimo = Number(sessionStorage.getItem('estudo360:chunk-reload') || 0);
    if (Date.now() - ultimo < 15000) return; // já tentou há pouco → não entra em loop
    sessionStorage.setItem('estudo360:chunk-reload', String(Date.now()));
  } catch { /* modo privado */ }
  if (entry) {
    Promise.resolve(fetch(entry, { cache: 'reload' })).catch(() => {}).then(() => location.reload());
  } else {
    location.reload();
  }
}

window.addEventListener('vite:preloadError', (event) => {
  const e = event as Event & { payload?: { entry?: string } };
  e.preventDefault?.();
  recuperarChunk(e.payload?.entry);
});

instalarMarcasObrigatorias();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {publicSlug ? (
        <PropostaPublica slug={publicSlug} />
      ) : (
        <AuthProvider>
          <App />
        </AuthProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
);

// Recolha mínima de erros (sem dados de clientes). Silenciosa e limitada.
const BUILD = (document.querySelector('meta[name="build"]') as HTMLMetaElement)?.content || '';
const vistos = new Set<string>();
function reportarErro(msg: string, stack?: string) {
  const chave = `${msg}|${stack || ''}`.slice(0, 300);
  if (vistos.has(chave) || vistos.size > 20) return;
  vistos.add(chave);
  void fetch('/api/erros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg, stack, url: location.pathname, build: BUILD }),
    keepalive: true,
  }).catch(() => {});
}
window.addEventListener('error', (e) => reportarErro(e.message || 'erro', e.error?.stack));
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason as { message?: string; stack?: string } | undefined;
  reportarErro(r?.message || String(e.reason), r?.stack);
});
