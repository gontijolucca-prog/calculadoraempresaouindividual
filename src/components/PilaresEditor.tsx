import { useMemo, useState } from 'react';
import { Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import {
  getMapaControloPilares, getMapaRHPilares, getMapaControloVisiveis, getMapaRHVisiveis,
  setMapaControloVisiveis, setMapaRHVisiveis, addMapaControloPilar, deleteMapaControloPilar, resetMapaControloPilares,
  addMapaRHPilar, deleteMapaRHPilar, resetMapaRHPilares,
  getPilaresCliente, addPilarCliente, renamePilarCliente, togglePilarCliente, removePilarCliente, resetPilaresCliente,
  type GabineteCliente, type MapaPilarDef, type PilarCliente,
} from '../lib/gabinete';
import { toast } from '../lib/toast';

type Mapa = 'controlo' | 'rh';

/**
 * Editor de pilares com dois âmbitos: o catálogo do gabinete (todos) ou só um
 * cliente. Editar um cliente copia o global na primeira vez (copy-on-write) e
 * nunca altera os outros.
 */
export function PilaresEditor({
  mapa, clientes, onClose, onChanged,
}: {
  mapa: Mapa;
  clientes: GabineteCliente[];
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [scope, setScope] = useState<string>('global');
  const [versao, setVersao] = useState(0);
  const [novoCurto, setNovoCurto] = useState('');
  const [novoLongo, setNovoLongo] = useState('');
  const [editarId, setEditarId] = useState<string | null>(null);
  const [editCurto, setEditCurto] = useState('');
  const [editLongo, setEditLongo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const cliente = useMemo(() => clientes.find(c => c.id === scope) || null, [clientes, scope]);
  const globais: MapaPilarDef[] = useMemo(
    () => (mapa === 'controlo' ? getMapaControloPilares() : getMapaRHPilares()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapa, versao],
  );
  const visiveisGlobais: string[] | null = useMemo(
    () => (mapa === 'controlo' ? getMapaControloVisiveis() : getMapaRHVisiveis()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapa, versao],
  );
  const doCliente: PilarCliente[] = useMemo(
    () => (cliente ? getPilaresCliente(cliente, mapa) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cliente, mapa, versao],
  );

  const refresh = () => { setVersao(v => v + 1); onChanged?.(); };

  const run = async (fn: () => Promise<unknown> | unknown, ok: string) => {
    setErro(null);
    try { await fn(); toast(ok); refresh(); }
    catch (e) { const m = e instanceof Error ? e.message : String(e); setErro(m); toast(m, 'erro'); }
  };

  const adicionar = async () => {
    const curto = novoCurto.trim();
    if (!curto) { setErro('Escreve o nome curto'); return; }
    if (cliente) {
      await run(() => addPilarCliente(cliente, mapa, curto, novoLongo), `✓ “${curto}” adicionado a ${cliente.nome} — gravado`);
    } else {
      await run(() => (mapa === 'controlo' ? addMapaControloPilar(curto, novoLongo) : addMapaRHPilar(curto, novoLongo)), `✓ “${curto}” adicionado ao gabinete — gravado`);
    }
    setNovoCurto(''); setNovoLongo('');
  };

  const apagar = async (id: string, label: string) => {
    if (!confirm(`Apagar “${label}”?`)) return;
    if (cliente) await run(() => removePilarCliente(cliente, mapa, id), `✓ “${label}” apagado — gravado`);
    else await run(() => (mapa === 'controlo' ? deleteMapaControloPilar(id) : deleteMapaRHPilar(id)), `✓ “${label}” apagado — gravado`);
  };

  const gravarNome = async (id: string) => {
    const curto = editCurto.trim();
    if (!curto) { setErro('Nome curto vazio'); return; }
    if (cliente) await run(() => renamePilarCliente(cliente, mapa, id, curto, editLongo), '✓ Nome gravado');
    else setErro('O nome dos pilares do gabinete é fixo — apague e crie outro, ou edite só neste cliente.');
    setEditarId(null);
  };

  const toggleVisivel = async (id: string) => {
    if (cliente) {
      await run(() => togglePilarCliente(cliente, mapa, id), '✓ Gravado');
      return;
    }
    const todos = globais.map(p => p.id);
    const atuais = visiveisGlobais ?? todos;
    const next = atuais.includes(id) ? atuais.filter(x => x !== id) : [...atuais, id];
    if (next.length === 0) { setErro('Tem de ficar pelo menos um pilar visível'); return; }
    await run(() => {
      const ids = next.length === todos.length ? null : next;
      if (mapa === 'controlo') setMapaControloVisiveis(ids); else setMapaRHVisiveis(ids);
    }, '✓ Visibilidade gravada');
  };

  const repor = async () => {
    if (!confirm(cliente ? `Repor os pilares de ${cliente.nome} com os do gabinete?` : 'Repor os pilares originais?')) return;
    if (cliente) await run(() => resetPilaresCliente(cliente, mapa), '✓ Reposto — gravado');
    else await run(() => (mapa === 'controlo' ? resetMapaControloPilares() : resetMapaRHPilares()), '✓ Reposto — gravado');
  };

  const lista = cliente
    ? doCliente.map(p => ({ id: p.id, curto: p.labelShort, longo: p.labelFull, ativo: p.ativo !== false }))
    : globais.map(p => ({ id: p.id, curto: p.labelShort, longo: p.labelFull, ativo: visiveisGlobais === null || visiveisGlobais.includes(p.id) }));

  const tituloMapa = mapa === 'controlo' ? 'Mapa Controlo' : 'Mapa RH';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[620px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-[800] text-[#0B1D2D]">Pilares · {tituloMapa}</h3>
            <p className="mt-0.5 text-[11.5px] text-zinc-500">Escolha o âmbito: o gabinete inteiro ou só uma empresa. Cada alteração grava logo.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-[700] uppercase tracking-wide text-zinc-500">Âmbito</label>
          <select
            value={scope}
            onChange={e => { setScope(e.target.value); setEditarId(null); setErro(null); }}
            className="min-w-[220px] rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-[12.5px]"
          >
            <option value="global">Gabinete (todos os clientes)</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          {cliente && <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10.5px] font-[700] text-amber-800">pilares próprios desta empresa</span>}
        </div>

        <div className="mt-3 max-h-[42vh] space-y-1.5 overflow-y-auto pr-0.5">
          {lista.map(p => (
            <div key={p.id} className={`rounded-lg border px-2.5 py-2 ${p.ativo ? 'border-emerald-200 bg-emerald-50/40' : 'border-zinc-200 bg-zinc-50'}`}>
              {editarId === p.id ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <input value={editCurto} onChange={e => setEditCurto(e.target.value)} placeholder="Nome curto" className="w-[140px] rounded border border-zinc-300 px-2 py-1 text-[12px]" />
                  <input value={editLongo} onChange={e => setEditLongo(e.target.value)} placeholder="Nome completo" className="min-w-[180px] flex-1 rounded border border-zinc-300 px-2 py-1 text-[12px]" />
                  <button onClick={() => gravarNome(p.id)} className="rounded bg-[#0F172A] px-2.5 py-1 text-[11px] font-[700] text-white">Gravar</button>
                  <button onClick={() => setEditarId(null)} className="rounded border border-zinc-300 px-2 py-1 text-[11px]">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={p.ativo} onChange={() => toggleVisivel(p.id)} className="h-3.5 w-3.5 accent-emerald-600" />
                    <span className="text-[12.5px] font-[600] text-[#0F172A]">{p.curto}</span>
                    <span className="hidden text-[11px] text-zinc-500 sm:inline">{p.longo !== p.curto ? p.longo : ''}</span>
                  </label>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => { setEditarId(p.id); setEditCurto(p.curto); setEditLongo(p.longo); setErro(null); }}
                      title="Renomear neste âmbito"
                      className="rounded p-1 text-zinc-500 hover:bg-white"
                    ><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => apagar(p.id, p.curto)} title="Apagar" className="rounded p-1 text-zinc-500 hover:bg-white"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {lista.length === 0 && <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-[12px] text-zinc-500">Sem pilares.</div>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-3">
          <input value={novoCurto} onChange={e => setNovoCurto(e.target.value)} placeholder="Nome curto (ex: IVA)" className="w-[130px] rounded-lg border border-zinc-300 px-2 py-1.5 text-[12px]" />
          <input value={novoLongo} onChange={e => setNovoLongo(e.target.value)} placeholder="Nome completo (opcional)" className="min-w-[160px] flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-[12px]" onKeyDown={e => { if (e.key === 'Enter') void adicionar(); }} />
          <button onClick={adicionar} className="inline-flex items-center gap-1 rounded-lg bg-[#0677FF] px-3 py-1.5 text-[11.5px] font-[700] text-white"><Plus className="h-3.5 w-3.5" /> Adicionar</button>
          <button onClick={repor} className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[11.5px] font-[600] text-zinc-600"><RotateCcw className="h-3.5 w-3.5" /> Repor</button>
        </div>

        {erro && <div className="mt-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1.5 text-[11.5px] text-[#991B1B]">{erro}</div>}
        <p className="mt-2 text-[10.5px] leading-snug text-zinc-500">Ao editar uma empresa pela primeira vez, os pilares do gabinete são copiados só para ela. As outras não mudam.</p>
      </div>
    </div>
  );
}

export default PilaresEditor;
