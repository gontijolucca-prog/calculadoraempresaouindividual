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
