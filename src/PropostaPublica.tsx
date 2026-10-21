/**
 * Página pública da proposta (`/p/<slug>`) — sem login.
 *
 * Lê o snapshot em `publicPropostas/<slug>`; se expirou ou foi revogado mostra
 * apenas o aviso, nunca o conteúdo.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, Printer, Clock } from 'lucide-react';
import { DeckCards, DeckPrintStyles } from './components/deck/DeckRenderer';
import { loadPublicDeck, type PublicDeck } from './lib/deck/store';
import { toMillis } from './lib/deck/share';

interface Props {
  slug: string;
}

export default function PropostaPublica({ slug }: Props) {
  const [deck, setDeck] = useState<PublicDeck | null>(null);
  const [reason, setReason] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    document.title = 'Proposta · Estudo 360°';
    loadPublicDeck(slug).then((r) => {
      if (!alive) return;
      setDeck(r.deck);
      setReason(r.reason);
      setLoading(false);
      if (r.deck) document.title = `${r.deck.titulo} · ${r.deck.escritorio?.nome || 'Estudo 360°'}`;
    });
    return () => { alive = false; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] text-[#64748B]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] px-4">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 max-w-[440px] text-center">
          <Clock className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <h1 className="mt-3 text-[18px] font-[800] text-[#0F172A]">
            {reason === 'expirada' ? 'Proposta expirada' : 'Proposta indisponível'}
          </h1>
          <p className="mt-1.5 text-[13px] text-[#64748B] font-[500]">
            Este link já não está ativo. Pede uma nova proposta ao escritório.
          </p>
        </div>
      </div>
    );
  }

  const brand = {
    nome: deck.escritorio?.nome || 'Estudo 360°',
    corPrimaria: deck.escritorio?.corPrimaria || '#0677FF',
    logoDataUrl: deck.escritorio?.logoDataUrl,
    email: deck.escritorio?.email,
    telefone: deck.escritorio?.telefone,
    website: deck.escritorio?.website,
  };

  const expira = toMillis(deck.expiresAt);
  const expiraTxt = expira ? new Date(expira).toLocaleDateString('pt-PT') : null;

  return (
    <div className="min-h-screen bg-[#EEF2F7]">
      <DeckPrintStyles />

      <header className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#E2E8F0]">
        <div className="max-w-[1120px] mx-auto px-4 py-2.5 flex items-center gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-[800] text-[#0F172A] truncate">{deck.titulo}</div>
            <div className="text-[11px] font-[600] text-[#64748B] truncate">{brand.nome}{expiraTxt ? ` · válida até ${expiraTxt}` : ''}</div>
          </div>
          <button
            onClick={() => window.print()}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[12px] font-[700] text-[#334155] hover:border-[#0677FF] shrink-0"
          >
            <Printer className="w-4 h-4" /> PDF
          </button>
        </div>
      </header>

      <main className="max-w-[1120px] mx-auto px-3 md:px-6 py-4 md:py-6">
        <DeckCards cards={deck.cards} tema={deck.tema} brand={brand} />
      </main>

      <footer className="no-print text-center pb-8 text-[11px] font-[600] text-[#94A3B8]">
        Proposta gerada no Estudo 360°{expiraTxt ? ` · link válido até ${expiraTxt}` : ''}
      </footer>

      {/* Impressão: um card por página */}
      <div id="deck-print-root" style={{ display: 'none' }}>
        {deck.cards.map((c, i) => (
          <div key={c.id} className="deck-page">
            <div style={{ width: '100%', height: '100%' }}>
              <DeckCards cards={[c]} tema={deck.tema} brand={brand} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
