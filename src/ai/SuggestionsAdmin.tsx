import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Inbox, Eye, CheckCircle2, Cloud, HardDrive } from 'lucide-react';
import { listSuggestions, setSuggestionStatus, type Suggestion } from './suggestions';

// Vista de administração ESCONDIDA das sugestões do AI Contabilista.
// Acede-se via #ai-sugestoes no URL (ex.: estudo360.pt/#ai-sugestoes). Não está
// na navegação — é para a equipa de dev / Sandrine verem o que o bot recolheu.

const HASH = '#ai-sugestoes';

function fmtDate(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_META: Record<Suggestion['status'], { label: string; cls: string }> = {
  novo: { label: 'Novo', cls: 'bg-[#0677FF]/10 text-[#0677FF]' },
  visto: { label: 'Visto', cls: 'bg-amber-100 text-amber-700' },
  feito: { label: 'Feito', cls: 'bg-emerald-100 text-emerald-700' },
};

export default function SuggestionsAdmin() {
  const [active, setActive] = useState(() => typeof location !== 'undefined' && location.hash === HASH);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setItems(await listSuggestions()); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const onHash = () => {
      const on = location.hash === HASH;
      setActive(on);
      if (on) refresh();
    };
    window.addEventListener('hashchange', onHash);
    if (location.hash === HASH) refresh();
    return () => window.removeEventListener('hashchange', onHash);
  }, [refresh]);

  if (!active) return null;

  const close = () => { history.replaceState(null, '', location.pathname + location.search); setActive(false); };

  const cycle = async (s: Suggestion) => {
    if (!s.id) return; // fila local não tem id de cloud
    const next: Suggestion['status'] = s.status === 'novo' ? 'visto' : s.status === 'visto' ? 'feito' : 'novo';
    setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
    await setSuggestionStatus(s.id, next);
  };

  const novos = items.filter((i) => i.status === 'novo').length;

  return (
    <div className="no-print fixed inset-0 z-[200] bg-[#F5F7FA] flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 flex items-center gap-3 text-white"
        style={{ background: 'linear-gradient(135deg, #0B1D2D 0%, #0677FF 100%)' }}>
        <Inbox className="w-6 h-6" strokeWidth={2.2} />
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-[800] leading-tight">Sugestões do AI Contabilista</div>
          <div className="text-[12px] font-[600] text-white/70">{items.length} no total · {novos} por ver</div>
        </div>
        <button type="button" onClick={refresh} aria-label="Atualizar"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          <RefreshCw className={`w-4.5 h-4.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.3} style={{ width: 18, height: 18 }} />
        </button>
        <button type="button" onClick={close} aria-label="Fechar"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          <X className="w-5 h-5" strokeWidth={2.4} />
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-3">
          {items.length === 0 && !loading && (
            <div className="text-center py-20">
              <Inbox className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-[15px] font-[700] text-[#64748B]">Ainda não há sugestões.</p>
              <p className="text-[13px] font-[500] text-[#94A3B8] mt-1">
                Quando alguém pedir uma melhoria ao bot, aparece aqui.
              </p>
            </div>
          )}

          {items.map((s, i) => {
            const meta = STATUS_META[s.status];
            return (
              <div key={s.id ?? `local-${i}`} className="bg-white rounded-[16px] border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10.5px] font-[800] uppercase tracking-[0.4px] px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                      {s.area && <span className="text-[11px] font-[700] text-[#0677FF] bg-[#0677FF]/8 px-2 py-0.5 rounded-full">{s.area}</span>}
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-[600] text-[#94A3B8]">
                        {s.origem === 'cloud' ? <Cloud className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
                        {s.origem === 'cloud' ? 'cloud' : 'local'}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-[800] text-[#0F172A] leading-snug">{s.title}</h3>
                    {s.detail && <p className="text-[13px] font-[500] text-[#475569] leading-relaxed mt-1 whitespace-pre-wrap">{s.detail}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] font-[600] text-[#94A3B8]">
                      <span>{fmtDate(s.createdAt)}</span>
                      {s.autor && <span>· {s.autor}</span>}
                      {s.vista && <span>· em {s.vista}</span>}
                    </div>
                  </div>
                  {s.id && (
                    <button type="button" onClick={() => cycle(s)}
                      title="Alternar estado"
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12px] font-[700] text-[#334155] bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors">
                      {s.status === 'novo' ? <Eye className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {s.status === 'novo' ? 'Marcar visto' : s.status === 'visto' ? 'Marcar feito' : 'Reabrir'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
