import React, { useEffect, useMemo, useState } from 'react';
import { X, Link2, Unlink, Download, Loader2, CheckCircle, AlertTriangle, Copy, Check } from 'lucide-react';
import {
  getTocConfig, saveTocConfig, clearTocConfig, isTocConnected,
  buildTocAuthUrl, setTocPending, getTocDraft, clearTocDraft,
  fetchTocCustomers, getValidTocToken,
  type TocConfig, type TocCustomerDraft,
} from '../lib/toconline';

interface Props {
  onClose: () => void;
  onImport: (drafts: TocCustomerDraft[]) => number;
  existingNifs: Set<string>;
}

type Step = 'config' | 'fetching' | 'preview';

export default function TOCOnlineImport({ onClose, onImport, existingNifs }: Props) {
  const [cfg, setCfg] = useState<TocConfig>(() => getTocConfig() ?? { oauthUrl: '', apiUrl: '', clientId: '', secret: '' });
  const [connected, setConnected] = useState(() => isTocConnected());
  const [step, setStep] = useState<Step>(() => (getTocDraft().length ? 'preview' : 'config'));
  const [list, setList] = useState<TocCustomerDraft[]>(() => getTocDraft());
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const novos = useMemo(() => list.filter(d => d.nif && !existingNifs.has(d.nif)), [list, existingNifs]);
  const jaExistem = list.length - novos.length;

  useEffect(() => {
    if (step === 'preview') {
      const idx = new Set<number>();
      list.forEach((d, i) => { if (d.nif && !existingNifs.has(d.nif)) idx.add(i); });
      setSel(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const validCfg = cfg.oauthUrl.trim() && cfg.apiUrl.trim() && cfg.clientId.trim() && cfg.secret.trim();

  const handleConnect = () => {
    setError(null);
    if (!validCfg) { setError('Preencha os 4 dados da API (vêm do TOConline: Empresa › Configurações › Dados API).'); return; }
    saveTocConfig({ oauthUrl: cfg.oauthUrl.trim(), apiUrl: cfg.apiUrl.trim(), clientId: cfg.clientId.trim(), secret: cfg.secret.trim() });
    const state = setTocPending(true);
    window.location.href = buildTocAuthUrl(getTocConfig()!, state);
  };

  const handleFetch = async () => {
    setError(null);
    const c = getTocConfig();
    if (!c) { setError('Configure primeiro.'); return; }
    setLoading(true);
    try {
      await getValidTocToken(c);
      const items = await fetchTocCustomers(c);
      setList(items);
      setSel(new Set(items.map((_, i) => i)));
      setStep('preview');
      setConnected(isTocConnected());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao buscar clientes.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearTocConfig();
    clearTocDraft();
    setConnected(false);
    setList([]);
    setStep('config');
  };

  const handleImport = () => {
    const chosen = [...sel].map(i => list[i]).filter(d => d && d.nif && !existingNifs.has(d.nif));
    if (!chosen.length) { setError('Selecione pelo menos um cliente novo.'); return; }
    const n = onImport(chosen);
    setDone(n);
    clearTocDraft();
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] text-[13px] focus:bg-white focus:border-[#0677FF] outline-none font-mono';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="Importar do TOConline">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default" />
      <div className="relative bg-white rounded-[20px] shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto">
        <div className="h-1.5 bg-gradient-to-r from-[#0677FF] to-[#00C2FF] w-full rounded-t-[20px]" />
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-[20px] font-[800] text-[#0B1D2D]">Importar do TOConline</h2>
              <p className="text-[12.5px] text-[#64748B] mt-0.5">As credenciais são suas e ficam só neste computador.</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100" aria-label="Fechar"><X className="w-4 h-4" /></button>
          </div>

          {error && <div className="mt-3 flex gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-[13px]"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span></div>}
          {done !== null && (
            <div className="mt-3 flex gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2.5 rounded-xl text-[13px]">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{done} cliente{done === 1 ? '' : 's'} importado{done === 1 ? '' : 's'} para a lista.</span>
            </div>
          )}

          {step === 'config' && done === null && (
            <div className="mt-4 space-y-3">
              <div className="bg-[#F5F7FA] border border-[#E2E8F0] rounded-xl p-3.5 text-[12.5px] text-[#475569] leading-relaxed space-y-2">
                <div><strong className="text-[#0B1D2D]">Passo 1 —</strong> no TOConline, entre na empresa com conta de Empresário → <strong>Empresa › Configurações › Dados API</strong> → indique o seu email → abra o link de 72h que recebe.</div>
                <div><strong className="text-[#0B1D2D]">Passo 2 —</strong> nessa página, ponha este endereço de retorno:</div>
                <CopyRow value={typeof window !== 'undefined' ? window.location.origin + '/' : 'https://estudo360.pt/'} />
                <div><strong className="text-[#0B1D2D]">Passo 3 —</strong> cole abaixo os 4 dados e carregue em <strong>Entrar com TOConline</strong>. Vai entrar no site deles e voltar sozinho.</div>
              </div>
              <label className="block"><span className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]">Endereço OAuth</span><input value={cfg.oauthUrl} onChange={e => setCfg({ ...cfg, oauthUrl: e.target.value })} placeholder="https://…" className={inputCls + ' mt-1'} /></label>
              <label className="block"><span className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]">Endereço da API</span><input value={cfg.apiUrl} onChange={e => setCfg({ ...cfg, apiUrl: e.target.value })} placeholder="https://…" className={inputCls + ' mt-1'} /></label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block"><span className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]">Client ID</span><input value={cfg.clientId} onChange={e => setCfg({ ...cfg, clientId: e.target.value })} className={inputCls + ' mt-1'} /></label>
                <label className="block"><span className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]">Segredo</span><input type="password" value={cfg.secret} onChange={e => setCfg({ ...cfg, secret: e.target.value })} className={inputCls + ' mt-1'} /></label>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {!connected ? (
                  <button onClick={handleConnect} disabled={!validCfg} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#0B1D2D] text-white text-[14px] font-[700] hover:bg-black disabled:opacity-40">
                    <Link2 className="w-4 h-4" /> Entrar com TOConline
                  </button>
                ) : (
                  <>
                    <button onClick={handleFetch} disabled={loading} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#0677FF] text-white text-[14px] font-[700] hover:bg-[#0556CC] disabled:opacity-60">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {loading ? 'A buscar…' : 'Buscar clientes'}
                    </button>
                    <button onClick={handleDisconnect} className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-[#E2E8F0] text-[13px] font-[600] text-[#64748B] hover:bg-zinc-50">
                      <Unlink className="w-3.5 h-3.5" /> Desligar
                    </button>
                  </>
                )}
              </div>
              {connected && <p className="text-[12px] text-emerald-700 font-[600]">✓ Conta ligada. Carregue em "Buscar clientes".</p>}
            </div>
          )}

          {step === 'fetching' && (
            <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0677FF]" /><p className="mt-3 text-[14px] text-[#475569]">A buscar clientes no TOConline…</p></div>
          )}

          {step === 'preview' && done === null && (
            <div className="mt-4">
              <p className="text-[13px] text-[#475569]"><strong className="text-[#0B1D2D]">{novos.length}</strong> novo{novos.length === 1 ? '' : 's'} · {jaExistem} já na lista (ignorados).</p>
              <div className="mt-3 max-h-[320px] overflow-y-auto border border-[#E2E8F0] rounded-xl divide-y divide-zinc-100">
                {list.map((d, i) => {
                  const dup = !d.nif || existingNifs.has(d.nif);
                  return (
                    <label key={i} className={`flex items-center gap-3 px-3.5 py-2.5 text-[13px] ${dup ? 'opacity-40' : 'hover:bg-zinc-50 cursor-pointer'}`}>
                      <input type="checkbox" checked={sel.has(i)} disabled={dup} onChange={() => setSel(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} className="w-4 h-4 accent-[#0677FF]" />
                      <span className="flex-1 min-w-0"><span className="font-[600] text-[#0B1D2D] truncate block">{d.nome || '—'}</span><span className="text-[#64748B] text-[12px]">NIF {d.nif || '—'}{d.email ? ` · ${d.email}` : ''}</span></span>
                      {dup && <span className="text-[11px] text-[#94A3B8]">já existe</span>}
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setStep('config'); }} className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[13px] font-[600]">Voltar</button>
                <button onClick={handleImport} className="px-5 py-2.5 rounded-xl bg-[#0677FF] text-white text-[13px] font-[700] hover:bg-[#0556CC]">Importar selecionados</button>
              </div>
            </div>
          )}

          {done !== null && (
            <div className="flex justify-end mt-4"><button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-[#0B1D2D] text-white text-[13px] font-[700]">Fechar</button></div>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyRow({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-2">
      <code className="flex-1 min-w-0 truncate text-[12px] font-mono text-[#0B1D2D]">{value}</code>
      <button
        type="button"
        onClick={async () => { try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }}
        className="shrink-0 p-1.5 rounded-md hover:bg-zinc-100 text-[#64748B]"
        aria-label="Copiar endereço"
      >
        {ok ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
