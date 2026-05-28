import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Receipt, Plus, Trash2, Users, Wallet, Sliders } from 'lucide-react';
import { cn } from './lib/utils';
import { Tip } from './Tip';
import {
  simular,
  MUNICIPIOS_BM,
  EXPLICACOES_M3,
  type IRSSim,
  type IRSState,
  type SujeitoPassivo,
  type Cenario,
  type Regiao,
  type Tabela,
} from './lib/irs';

interface Props {
  initialState: IRSState;
  onStateChange: (s: IRSState) => void;
}

const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v || 0);
const ptEur0 = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
const ptPct = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'percent', minimumFractionDigits: 2 }).format(v || 0);

const inputCls = 'w-full px-[14px] py-[11px] bg-[#F5F7FA] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none';
const labelCls = 'block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[6px]';
const sectionTitleCls = 'flex items-center gap-2 text-[12px] font-[800] uppercase tracking-[1px] text-[#0F172A]';

function toSim(s: IRSState): IRSSim {
  return {
    agregado: s.agregado,
    cenario: s.cenario,
    dependentes: +s.dependentes,
    dep0a3: +s.dep0a3,
    regiao: s.regiao,
    concelho: s.concelho,
    despesas: s.despesas,
    pagamentosConta: +s.pagamentosConta,
    beneficioMunicipal: +(s.beneficioMunicipal || 0),
    perdas: +(s.perdas || 0),
  };
}

export default function IRSSimulator({ initialState, onStateChange }: Props) {
  const s = initialState;
  const set = (u: Partial<IRSState>) => onStateChange({ ...s, ...u });
  const setDespesa = (k: keyof IRSState['despesas'], v: number) => onStateChange({ ...s, despesas: { ...s.despesas, [k]: v } });
  const setPessoa = (i: number, u: Partial<SujeitoPassivo>) => {
    const ag = s.agregado.map((p, idx) => (idx === i ? { ...p, ...u } : p));
    onStateChange({ ...s, agregado: ag });
  };
  const addPessoa = () => onStateChange({
    ...s,
    cenario: 'conjunto',
    agregado: [...s.agregado, { relacao: 'Sujeito Passivo B', nome: '', rendTrabalho: 0, contribuicoes: 0, retencao: 0, atividade: 0, coefAtividade: 0.75, irsJovemAno: 0, pagamentosConta: 0 }],
  });
  const rmPessoa = (i: number) => onStateChange({ ...s, agregado: s.agregado.filter((_, idx) => idx !== i) });

  const result = useMemo(() => simular(toSim(s), { tabela: s.tabela }), [s]);

  // What-if — clona e aplica os ajustes dos sliders.
  const whatIf = useMemo(() => {
    if (!s.wifRend && !s.wifDep && !s.wifPpr) return null;
    const clone: IRSState = JSON.parse(JSON.stringify(s));
    if (clone.agregado[0]) clone.agregado[0].rendTrabalho = (+clone.agregado[0].rendTrabalho || 0) + s.wifRend;
    clone.dependentes = (+clone.dependentes || 0) + s.wifDep;
    clone.despesas.pensoes = (+clone.despesas.pensoes || 0) + s.wifPpr;
    const r2 = simular(toSim(clone), { tabela: s.tabela });
    return { apurado: r2.apurado, dif: r2.apurado - result.apurado };
  }, [s, result.apurado]);

  const apurado = result.apurado;
  const reembolso = apurado < 0;
  const concelhos = Object.keys(MUNICIPIOS_BM);

  const ded = result.rendGlobal - result.rendColetavel;
  const imp = result.coletaLiquida;
  const liq = Math.max(0, result.rendGlobal - ded - imp);
  const totalBar = result.rendGlobal || 1;
  const pct = (n: number) => ((n / totalBar) * 100).toFixed(1);

  return (
    <div className="overflow-y-auto lg:overflow-hidden lg:h-full lg:grid lg:grid-cols-[440px_1fr] bg-[#F5F7FA] text-[#1E293B]">
      {/* ── Formulário ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E2E8F0] lg:border-b-0 lg:border-r lg:overflow-y-auto p-4 sm:p-5 lg:p-[28px] flex flex-col gap-6 lg:h-full">
        <div>
          <h1 className="text-[22px] font-[800] text-[#0F172A] leading-tight tracking-[-0.4px] flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#0677FF]" strokeWidth={2.25} /> Simulador de IRS
          </h1>
          <p className="text-[13px] font-[500] text-[#64748B] mt-1.5 leading-relaxed">
            Estimativa do IRS anual (Modelo 3) segundo o CIRS. Atualiza a cada alteração.
          </p>
        </div>

        {/* Dados do agregado */}
        <section className="flex flex-col gap-4">
          <h2 className={sectionTitleCls}><Users className="w-4 h-4 text-[#0677FF]" /> Agregado familiar</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tributação</label>
              <select className={inputCls} value={s.cenario} onChange={(e) => set({ cenario: e.target.value as Cenario })}>
                <option value="individual">Individual</option>
                <option value="conjunto">Conjunto</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Região fiscal</label>
              <select className={inputCls} value={s.regiao} onChange={(e) => set({ regiao: e.target.value as Regiao })}>
                <option value="continente">Continente</option>
                <option value="acores">Açores (−30%)</option>
                <option value="madeira">Madeira (−23,5%)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Dependentes</label>
              <input type="number" min={0} step={1} className={inputCls} value={s.dependentes} onChange={(e) => set({ dependentes: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label className={labelCls}>… dos quais ≤ 3 anos</label>
              <input type="number" min={0} step={1} className={inputCls} value={s.dep0a3} onChange={(e) => set({ dep0a3: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Concelho de residência <Tip>Determina o benefício municipal — devolução de parte da coleta (até 5%) decidida pela câmara.</Tip></label>
            <select className={inputCls} value={s.concelho} onChange={(e) => set({ concelho: e.target.value })}>
              {concelhos.map((k) => (
                <option key={k} value={k}>
                  {k.replace(/\b\w/g, (l) => l.toUpperCase())} (BM {(MUNICIPIOS_BM[k] * 100).toFixed(2).replace('.', ',')}%)
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Sujeitos passivos */}
        <section className="flex flex-col gap-3">
          {s.agregado.map((p, i) => (
            <fieldset key={i} className="rounded-[12px] border border-[#E2E8F0] bg-[#F5F7FA] p-4">
              <legend className="px-1.5 flex items-center gap-2">
                <span className="text-[11px] font-[800] uppercase tracking-[0.5px] text-[#475569]">{p.relacao}</span>
                {s.agregado.length > 1 && (
                  <button type="button" onClick={() => rmPessoa(i)} className="text-[11px] font-[600] text-red-500 hover:text-red-700 inline-flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> remover
                  </button>
                )}
              </legend>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="col-span-2">
                  <label className={labelCls}>Nome (opcional)</label>
                  <input className={inputCls} value={p.nome} onChange={(e) => setPessoa(i, { nome: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Rend. trabalho bruto (€)</label>
                  <input type="number" step="0.01" className={inputCls} value={p.rendTrabalho || ''} onChange={(e) => setPessoa(i, { rendTrabalho: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className={labelCls}>Contribuições obrig. (€) <Tip>Descontos obrigatórios para a Segurança Social. Se forem superiores a 4 462,15 €, substituem a dedução automática.</Tip></label>
                  <input type="number" step="0.01" className={inputCls} value={p.contribuicoes || ''} onChange={(e) => setPessoa(i, { contribuicoes: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className={labelCls}>Retenção na fonte (€)</label>
                  <input type="number" step="0.01" className={inputCls} value={p.retencao || ''} onChange={(e) => setPessoa(i, { retencao: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className={labelCls}>IRS Jovem — ano <Tip>Ano de aplicação do IRS Jovem (1 a 10). 1.º=100%, 2-4=75%, 5-7=50%, 8-10=25% de isenção. 0 = não aplicável.</Tip></label>
                  <input type="number" min={0} max={10} className={inputCls} value={p.irsJovemAno || 0} onChange={(e) => setPessoa(i, { irsJovemAno: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className={labelCls}>Rend. Cat. B / atividade (€)</label>
                  <input type="number" step="0.01" className={inputCls} value={p.atividade || ''} onChange={(e) => setPessoa(i, { atividade: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className={labelCls}>Coeficiente Cat. B</label>
                  <select className={inputCls} value={p.coefAtividade} onChange={(e) => setPessoa(i, { coefAtividade: parseFloat(e.target.value) })}>
                    <option value="0.75">0,75 — serviços profissionais</option>
                    <option value="0.35">0,35 — outras prestações</option>
                    <option value="0.15">0,15 — vendas / hotelaria</option>
                    <option value="1">1,00 — pré-coletável</option>
                  </select>
                </div>
              </div>
            </fieldset>
          ))}
          <button type="button" onClick={addPessoa} className="self-start inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] border-2 border-dashed border-[#CBD5E1] text-[12px] font-[700] text-[#475569] hover:border-[#0677FF] hover:text-[#0F172A] transition-colors">
            <Plus className="w-4 h-4" /> Adicionar Sujeito Passivo B
          </button>
        </section>

        {/* Despesas dedutíveis */}
        <section className="flex flex-col gap-3">
          <h2 className={sectionTitleCls}><Wallet className="w-4 h-4 text-[#0677FF]" /> Despesas dedutíveis (anuais)</h2>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['gerais', 'Despesas gerais (€)', '35%'],
              ['saude', 'Saúde (€)', '15% até 1 000 €'],
              ['educacao', 'Educação (€)', '30% até 800 €'],
              ['habitacao', 'Habitação (€)', '15% até 700 €'],
              ['lares', 'Lares (€)', '25% até 403,75 €'],
              ['pensoes', 'PPR / pensões (€)', '20% até 400 €'],
            ] as const).map(([k, lbl, help]) => (
              <div key={k}>
                <label className={labelCls}>{lbl}</label>
                <input type="number" step="0.01" className={inputCls} value={s.despesas[k] || ''} onChange={(e) => setDespesa(k, parseFloat(e.target.value) || 0)} />
                <p className="text-[10px] font-[500] text-[#94A3B8] mt-1">{help}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Extras */}
        <section className="flex flex-col gap-3">
          <h2 className={sectionTitleCls}>Extras</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Pagamentos por conta (€)</label>
              <input type="number" step="0.01" className={inputCls} value={s.pagamentosConta || ''} onChange={(e) => set({ pagamentosConta: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className={labelCls}>Perdas a recuperar (€)</label>
              <input type="number" step="0.01" className={inputCls} value={s.perdas || ''} onChange={(e) => set({ perdas: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className={labelCls}>Tabela de escalões <Tip>Oficial 2025 (Lei 55-A/2025, taxas reduzidas) ou Demo (compatível com simuladores profissionais de referência).</Tip></label>
              <select className={inputCls} value={s.tabela} onChange={(e) => set({ tabela: e.target.value as Tabela })}>
                <option value="oficial2025">Oficial 2025</option>
                <option value="demo">Demo</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Override benefício municipal</label>
              <input type="number" step="0.005" min={0} max={0.05} className={inputCls} value={s.beneficioMunicipal || ''} placeholder="usa o do concelho" onChange={(e) => set({ beneficioMunicipal: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        </section>
      </div>

      {/* ── Resultados ─────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 lg:p-[28px] lg:overflow-y-auto lg:h-full flex flex-col gap-5">
        {/* Hero apurado */}
        <motion.div
          key={reembolso ? 'good' : 'bad'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'rounded-[20px] p-6 text-white shadow-lg',
            reembolso ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-600/20' : 'bg-gradient-to-br from-[#0B1D2D] to-[#0F172A] shadow-slate-900/20',
          )}
        >
          <p className="text-[11px] font-[800] uppercase tracking-[1.5px] opacity-80">{reembolso ? 'Estimativa de reembolso' : 'IRS a pagar'}</p>
          <p className="text-[44px] font-[800] leading-none mt-1.5 tracking-[-1px]">{ptEur(Math.abs(apurado))}</p>
          <div className="flex items-center gap-4 mt-3 text-[12px] font-[600] opacity-90">
            <span>Escalão {result.escalao}.º ({ptPct(result.taxaNominal)})</span>
            <span>Taxa efetiva {ptPct(result.taxaEfetiva)}</span>
          </div>
        </motion.div>

        {/* Barra de distribuição */}
        <div className="bg-white rounded-[16px] border border-[#E2E8F0] p-5">
          <h3 className="text-[12px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Distribuição do rendimento global</h3>
          <div className="flex h-3.5 rounded-full overflow-hidden bg-slate-100">
            <div className="bg-amber-400" style={{ width: `${pct(ded)}%` }} title={`Deduções: ${ptEur(ded)}`} />
            <div className="bg-[#0B1D2D]" style={{ width: `${pct(imp)}%` }} title={`IRS final: ${ptEur(imp)}`} />
            <div className="bg-emerald-500" style={{ width: `${pct(liq)}%` }} title={`Líquido: ${ptEur(liq)}`} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] font-[600] text-[#64748B]">
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Deduções ({pct(ded)}%)</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#0B1D2D] inline-block" /> IRS ({pct(imp)}%)</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Líquido ({pct(liq)}%)</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-5">
          {/* Modelo 3 */}
          <div className="bg-white rounded-[16px] border border-[#E2E8F0] overflow-hidden">
            <h3 className="text-[12px] font-[800] uppercase tracking-[1px] text-[#0F172A] px-5 pt-4 pb-2">Apuramento — Modelo 3</h3>
            <div className="divide-y divide-slate-50">
              {result.linhas.map((L, idx) => {
                let val: string;
                if (L.fmt === 'pct') val = ptPct(L.v as number);
                else if (L.fmt === 'num') val = String(L.v);
                else if (L.fmt === 'txt') val = String(L.v);
                else val = ptEur(L.v as number);
                const hint = EXPLICACOES_M3[L.c];
                return (
                  <div
                    key={idx}
                    title={hint}
                    className={cn(
                      'flex items-center gap-3 px-5 py-2',
                      L.total ? 'bg-slate-50 font-[800] text-[#0F172A]' : L.bold ? 'font-[700] text-[#0F172A]' : 'text-[#475569]',
                    )}
                  >
                    <span className="w-7 shrink-0 text-[10px] font-[700] text-[#94A3B8]">{L.c}</span>
                    <span className="flex-1 text-[12.5px] leading-snug">{L.l}</span>
                    <span className="text-[13px] font-[600] tabular-nums">{val}</span>
                  </div>
                );
              })}
              <div className={cn('flex items-center gap-3 px-5 py-3 text-white', reembolso ? 'bg-emerald-600' : 'bg-[#0F172A]')}>
                <span className="w-7 shrink-0 text-[12px]">★</span>
                <span className="flex-1 text-[13px] font-[700]">{reembolso ? 'Valor a receber (reembolso)' : 'Imposto a pagar'}</span>
                <span className="text-[15px] font-[800] tabular-nums">{ptEur(Math.abs(apurado))}</span>
              </div>
            </div>
          </div>

          {/* Coluna direita: resumo + what-if */}
          <div className="flex flex-col gap-5">
            <div className="bg-white rounded-[16px] border border-[#E2E8F0] p-5">
              <h3 className="text-[12px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3">Resumo</h3>
              <dl className="text-[12.5px] space-y-2">
                {[
                  ['Rend. global', ptEur(result.rendGlobal)],
                  ['Coletável', ptEur(result.rendColetavel)],
                  ['Coleta total', ptEur(result.coletaTotal)],
                  ['Deduções', `− ${ptEur(result.deducoes.total)}`],
                  ['Retenções', `− ${ptEur(result.retencoes)}`],
                  ['Coleta líquida', ptEur(result.coletaLiquida)],
                  ['Consignação 1%', ptEur(result.consignacao)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <dt className="text-[#64748B] font-[500]">{k}</dt>
                    <dd className="font-[700] text-[#0F172A] tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="bg-white rounded-[16px] border border-[#E2E8F0] p-5">
              <h3 className="text-[12px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3 flex items-center gap-2"><Sliders className="w-3.5 h-3.5 text-[#0677FF]" /> E se…</h3>
              <div className="space-y-3.5">
                <div>
                  <label className="flex items-center justify-between text-[11px] font-[600] text-[#64748B] mb-1">
                    <span>Rendimento ajustado</span>
                    <span className="font-[700] text-[#0F172A]">{s.wifRend >= 0 ? '+' : ''}{ptEur0(s.wifRend)}</span>
                  </label>
                  <input type="range" min={-10000} max={10000} step={500} value={s.wifRend} onChange={(e) => set({ wifRend: +e.target.value })} className="w-full accent-[#0B1D2D]" />
                </div>
                <div>
                  <label className="flex items-center justify-between text-[11px] font-[600] text-[#64748B] mb-1">
                    <span>Dependentes adicionais</span>
                    <span className="font-[700] text-[#0F172A]">+{s.wifDep}</span>
                  </label>
                  <input type="range" min={0} max={4} step={1} value={s.wifDep} onChange={(e) => set({ wifDep: +e.target.value })} className="w-full accent-[#0B1D2D]" />
                </div>
                <div>
                  <label className="flex items-center justify-between text-[11px] font-[600] text-[#64748B] mb-1">
                    <span>PPR adicional</span>
                    <span className="font-[700] text-[#0F172A]">+{ptEur0(s.wifPpr)}</span>
                  </label>
                  <input type="range" min={0} max={2000} step={100} value={s.wifPpr} onChange={(e) => set({ wifPpr: +e.target.value })} className="w-full accent-[#0B1D2D]" />
                </div>
                {whatIf ? (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[12.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Novo apurado</span>
                      <strong className="text-[#0F172A]">{ptEur(Math.abs(whatIf.apurado))} {whatIf.apurado < 0 ? 'reembolso' : 'a pagar'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Variação</span>
                      <strong className={whatIf.dif <= 0 ? 'text-emerald-600' : 'text-red-600'}>{whatIf.dif > 0 ? '+' : ''}{ptEur(whatIf.dif)}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] font-[500] text-[#94A3B8] pt-1">Move os controlos para ver o impacto no IRS.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] font-[500] text-[#94A3B8] leading-relaxed px-1">
          Estimativa segundo o CIRS 2025 — não substitui a liquidação oficial da Autoridade Tributária.
        </p>
      </div>
    </div>
  );
}
