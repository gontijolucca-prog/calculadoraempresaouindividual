import { useMemo } from 'react';
import {
  ArrowLeft, Scale, AlertTriangle, CheckCircle2, XCircle, Trophy, Landmark,
} from 'lucide-react';
import {
  compararEnquadramento2026, defaultInputEnq2026, PARAMS_2026,
  type InputEnq2026, type CenarioEnq,
} from './lib/enquadramento2026';
import { numInput, pctInput } from './lib/inputGuards';

/**
 * Análise completa de enquadramento 2026 — desenho da contabilista:
 * camada 1 valida que regimes são legalmente possíveis; camada 2 compara a
 * disponibilidade líquida anual SÓ entre cenários elegíveis. O IVA mensal vs
 * trimestral aparece como tesouraria/carga administrativa, nunca como
 * "poupança fiscal".
 */

const eur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export default function EnquadramentoCompleto({ value, onChange, onVoltar }: {
  value: Partial<InputEnq2026>;
  onChange: (patch: Partial<InputEnq2026>) => void;
  onVoltar: () => void;
}) {
  const input: InputEnq2026 = useMemo(() => ({ ...defaultInputEnq2026(), ...value }), [value]);
  const r = useMemo(() => compararEnquadramento2026(input), [input]);
  const set = (patch: Partial<InputEnq2026>) => onChange(patch);
  const setRend = (k: keyof InputEnq2026['rend'], v: number) => onChange({ rend: { ...input.rend, [k]: v } });

  const inputCls = "w-full px-3 py-[9px] bg-[#F1F5F9] border-2 border-[#E2E8F0] rounded-[8px] text-[13.5px] font-[600] text-[#0F172A] focus:border-[#0677FF] outline-none mt-1 transition-all focus:bg-white";
  const lblCls = "text-[10.5px] font-[700] uppercase tracking-[0.5px] text-[#475569] leading-tight";
  const secCls = "bg-white border border-slate-200 rounded-[16px] p-5";
  const secHdr = "text-[12px] font-[800] uppercase tracking-[1px] text-[#0677FF] mb-3";

  const Num = ({ label, k, step = 100 }: { label: string; k: keyof InputEnq2026; step?: number }) => (
    <label className="block">
      <span className={lblCls}>{label}</span>
      <input type="number" min={0} step={step} value={(input[k] as number) === 0 ? '' : (input[k] as number)} placeholder="0"
        onChange={e => set({ [k]: numInput(e.target.value) } as Partial<InputEnq2026>)} className={inputCls} />
    </label>
  );
  const RendNum = ({ label, k }: { label: string; k: keyof InputEnq2026['rend'] }) => (
    <label className="block">
      <span className={lblCls}>{label}</span>
      <input type="number" min={0} step={500} value={input.rend[k] === 0 ? '' : input.rend[k]} placeholder="0"
        onChange={e => setRend(k, numInput(e.target.value))} className={inputCls} />
    </label>
  );
  const Bool = ({ label, k }: { label: string; k: 'microentidade' | 'revisaoLegalContas' | 'renunciouSimplificado3Anos' }) => (
    <label className="flex items-center gap-2 text-[12.5px] font-[600] text-slate-700 cursor-pointer">
      <input type="checkbox" checked={input[k]} onChange={e => set({ [k]: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" />
      {label}
    </label>
  );

  // Dashboard: indicadores em linhas × melhores cenários em colunas (top 3).
  const top = r.cenarios.slice(0, 3);
  const linhas: { label: string; get: (c: CenarioEnq) => string }[] = [
    { label: 'Segurança Social total', get: c => eur(c.ss) },
    { label: 'IRS / IRC', get: c => eur(c.imposto) },
    { label: 'Derrama e tribut. autónomas', get: c => eur(c.derramaTA) },
    { label: 'Imposto sobre dividendos', get: c => eur(c.impostoDividendos) },
    { label: 'Contabilidade', get: c => eur(c.custosAdmin) },
    { label: 'IVA das compras não deduzido', get: c => eur(c.custoIvaNaoDeduzido) },
    { label: 'Lucro retido na empresa', get: c => eur(c.lucroRetido) },
    { label: 'Pico de tesouraria do IVA', get: c => eur(c.ivaPicoTesouraria) },
    { label: 'Obrigações declarativas/ano', get: c => `${c.obrigacoes}` },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-[#0677FF]/10 flex items-center justify-center"><Scale className="w-5 h-5 text-[#0677FF]" /></div>
          <div>
            <h2 className="text-[18px] font-[800] text-[#0B1D2D] leading-tight">Análise completa de enquadramento 2026</h2>
            <p className="text-[12px] text-slate-500 font-[500]">1.º valida o que é legalmente possível; 2.º compara só os cenários elegíveis.</p>
          </div>
        </div>
        <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[12.5px] font-[700] text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">
          <ArrowLeft className="w-4 h-4" /> Comparação rápida
        </button>
      </div>

      {/* ── Inputs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={secCls}>
          <h3 className={secHdr}>Rendimentos anuais (sem IVA)</h3>
          <div className="grid grid-cols-2 gap-3">
            <RendNum label="Venda de mercadorias" k="vendas" />
            <RendNum label="Serviços art. 151.º" k="servicosProf" />
            <RendNum label="Outros serviços" k="outrosServicos" />
            <RendNum label="Subsídios e restantes" k="restantes" />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Num label="Faturação do ano anterior" k="faturacaoAnoAnterior" step={1000} />
            <label className="block">
              <span className={lblCls}>Ano de atividade</span>
              <select value={input.anoAtividade} onChange={e => set({ anoAtividade: Number(e.target.value) as 1 | 2 | 3 })} className={inputCls}>
                <option value={1}>1.º ano (coef. reduzidos 50%)</option>
                <option value={2}>2.º ano (reduzidos 25%)</option>
                <option value={3}>3.º ano ou seguinte</option>
              </select>
            </label>
          </div>
        </div>

        <div className={secCls}>
          <h3 className={secHdr}>Gastos e IVA</h3>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Gastos reais/ano (sem IVA)" k="gastosReais" step={500} />
            <Num label="IVA dedutível das compras" k="ivaDedutivelCompras" step={100} />
            <Num label="Tribut. autónomas (€/ano)" k="taManual" step={100} />
            <label className="block">
              <span className={lblCls}>Clientes particulares (%)</span>
              <input type="number" min={0} max={100} step={5} value={Math.round(input.clientesParticularesPct * 100)}
                onChange={e => set({ clientesParticularesPct: pctInput(e.target.value) / 100 })} className={inputCls} />
            </label>
            <label className="block">
              <span className={lblCls}>Taxa média de IVA (%)</span>
              <input type="number" min={0} max={23} step={1} value={Math.round(input.taxaIvaMedia * 100)}
                onChange={e => set({ taxaIvaMedia: pctInput(e.target.value, 23) / 100 })} className={inputCls} />
            </label>
            <label className="block">
              <span className={lblCls}>Derrama municipal (%)</span>
              <input type="number" min={0} max={1.5} step={0.1} value={input.taxaDerramaMunicipal * 100 || ''}
                onChange={e => set({ taxaDerramaMunicipal: pctInput(e.target.value, 1.5) / 100 })} className={inputCls} placeholder="0" />
            </label>
          </div>
        </div>

        <div className={secCls}>
          <h3 className={secHdr}>Sócio / gerente e sociedade</h3>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Remuneração gerente (€/mês)" k="remGerenteMensal" step={50} />
            <label className="block">
              <span className={lblCls}>Lucro distribuído (%)</span>
              <input type="number" min={0} max={100} step={5} value={Math.round(input.pctLucroDistribuido * 100)}
                onChange={e => set({ pctLucroDistribuido: pctInput(e.target.value) / 100 })} className={inputCls} />
            </label>
            <Num label="Outros rendimentos agregado" k="outrosRendimentos" step={500} />
            <Num label="N.º de dependentes" k="nrDependentes" step={1} />
            <Num label="Total do balanço" k="totalBalanco" step={5000} />
            <Num label="Contabilidade organizada (€/mês)" k="accMensalOrganizada" step={10} />
            <Num label="Contab. simplificado (€/mês)" k="accMensalSimplificado" step={10} />
          </div>
          <div className="mt-3 space-y-1.5">
            <Bool label="Regime das microentidades" k="microentidade" />
            <Bool label="Sujeita a revisão legal de contas" k="revisaoLegalContas" />
            <Bool label="Renunciou ao IRC simplificado nos últimos 3 anos" k="renunciouSimplificado3Anos" />
          </div>
        </div>
      </div>

      {/* ── Camada 1: validação jurídica ── */}
      <div className={secCls}>
        <h3 className={secHdr}><Landmark className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Validação jurídica — o que é possível</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {([
            ['IRS simplificado', r.validacao.irsSimplificado.elegivel],
            ['IRS organizada', true],
            ['IRC normal', true],
            ['IRC simplificado', r.validacao.ircSimplificado.elegivel],
            ['IVA isento 53.º', r.validacao.ivaIsencao53.elegivel],
            ['IVA trimestral', r.validacao.ivaTrimestral.elegivel],
            [r.validacao.ivaMensalObrigatorio ? 'IVA mensal (obrigatório)' : 'IVA mensal (opção)', true],
          ] as [string, boolean][]).map(([label, ok]) => (
            <div key={label} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-[10px] border text-[11.5px] font-[700] ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
              <span className="leading-tight">{label}</span>
            </div>
          ))}
        </div>
        {r.excluidos.length > 0 && (
          <div className="mt-3 space-y-1">
            {r.excluidos.map((e, i) => (
              <p key={i} className="text-[12px] text-red-700 font-[500]"><strong>{e.label}</strong> — {e.motivos.join(' ')}</p>
            ))}
          </div>
        )}
      </div>

      {/* ── Alertas ── */}
      {r.alertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4 space-y-2">
          {r.alertas.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
              <span className="text-[12.5px] text-amber-900 font-[500] leading-relaxed">{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Recomendação ── */}
      {r.recomendacao && (
        <div className="rounded-[16px] p-5 text-white" style={{ background: 'linear-gradient(135deg, #0B1D2D 0%, #0677FF 100%)' }}>
          <div className="flex items-start gap-3 flex-wrap">
            <Trophy className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-[800] uppercase tracking-[1.5px] text-white/60">Melhor cenário elegível</p>
              <p className="text-[18px] font-[800] leading-tight">{r.recomendacao.melhor.label}</p>
              <p className="mt-1 text-[13px] text-white/85 font-[600]">
                Disponibilidade líquida anual: <strong>{eur(r.recomendacao.melhor.disponivel)}</strong>
                {r.cenarios.length > 1 && <> · diferença face à 2.ª opção: <strong>+{eur(r.recomendacao.diferencaVsSegundo)}</strong></>}
              </p>
              <p className="mt-1 text-[12px] text-white/70 font-[500]">{r.recomendacao.motivo}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Dashboard: indicadores × top 3 cenários ── */}
      {top.length > 0 && (
        <div className={`${secCls} overflow-x-auto`}>
          <h3 className={secHdr}>Comparação económica — melhores cenários elegíveis</h3>
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead>
              <tr className="text-left">
                <th className="py-2 pr-3 font-[700] text-slate-400 text-[10.5px] uppercase tracking-[0.5px]">Indicador</th>
                {top.map((c, i) => (
                  <th key={c.id} className="py-2 px-3 font-[800] text-[#0B1D2D] leading-tight">
                    {i === 0 && <span className="block text-[9px] font-[800] uppercase tracking-[1px] text-[#0677FF]">Recomendado</span>}
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.label} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-[600] text-slate-500">{l.label}</td>
                  {top.map(c => <td key={c.id} className="py-2 px-3 font-[700] text-slate-800 tabular-nums">{l.get(c)}</td>)}
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                <td className="py-2.5 pr-3 font-[800] text-[#0B1D2D]">Disponibilidade líquida anual</td>
                {top.map((c, i) => (
                  <td key={c.id} className={`py-2.5 px-3 font-[800] tabular-nums text-[14px] ${i === 0 ? 'text-[#0677FF]' : 'text-[#0B1D2D]'}`}>{eur(c.disponivel)}</td>
                ))}
              </tr>
            </tbody>
          </table>
          {r.cenarios.length > 3 && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
              <p className="text-[10.5px] font-[800] uppercase tracking-[0.5px] text-slate-400">Restantes cenários elegíveis</p>
              {r.cenarios.slice(3).map(c => (
                <p key={c.id} className="text-[12px] text-slate-600 font-[500] flex justify-between gap-3">
                  <span>{c.label}</span><span className="font-[700] tabular-nums">{eur(c.disponivel)}</span>
                </p>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-slate-400 font-[500] leading-relaxed">
            O IVA mensal vs trimestral não altera o imposto anual — muda a tesouraria (pico) e a carga administrativa.
            Estimativas com parâmetros 2026 ({PARAMS_2026.vigencia.inicio}); valores sinalizados para validação da contabilista em AUDITORIA-FISCAL-PENDENTE.md.
          </p>
        </div>
      )}
    </div>
  );
}
