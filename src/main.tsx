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
