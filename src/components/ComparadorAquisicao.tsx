import { useMemo } from 'react';
import { Scale } from 'lucide-react';
import { compararModos, ETIQUETA_MODO, MODOS, type FinanciamentoInput, type ModoAquisicao } from '../lib/viaturasFinanciamento';

type SimState = Record<string, unknown> & {
  price?: number; maintenanceCost?: number; insuranceCost?: number; fuelCost?: number;
  modoAquisicao?: ModoAquisicao;
  financiamento?: Record<string, unknown>;
};

const eur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number.isFinite(v) ? v : 0);
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Comparador de aquisição: compra, crédito, leasing e renting.
 * Os valores ficam no estado do simulador (`modoAquisicao` + `financiamento`)
 * para o relatório PDF os poder reproduzir.
 */
export function ComparadorAquisicao({ state, onChange }: { state: SimState; onChange: (patch: Record<string, unknown>) => void }) {
  const fin = (state.financiamento || {}) as Record<string, unknown>;
  const preco = num(state.price);
  const modo = (state.modoAquisicao as ModoAquisicao) || 'compra';

  const entrada = fin.entrada !== undefined ? num(fin.entrada) : Math.round(preco * 0.2);
  const duracaoMeses = fin.duracaoMeses !== undefined ? num(fin.duracaoMeses) : 48;
  const tanPercent = fin.tanPercent !== undefined ? num(fin.tanPercent) : 6;
  const valorResidual = num(fin.valorResidual);
  const mensalidadeManual = num(fin.mensalidadeManual);
  const rentingDiscriminada = fin.rentingDiscriminada !== false;
  const incluiManutencao = fin.incluiManutencao !== false;
  const incluiSeguro = fin.incluiSeguro !== false;

  const patchFin = (p: Record<string, unknown>) => onChange({ financiamento: { ...fin, ...p } });

  const fiscal = useMemo(() => ({
    category: String(state.category || 'passageiros'),
    engineType: String(state.engineType || 'diesel'),
    ivaRegime: String(state.ivaRegime || 'normal'),
    activity: String(state.activity || 'other'),
    exemptTA: !!state.exemptTA,
    phevCompliant: !!state.phevCompliant,
    agravamentoTA: !!state.agravamentoTA,
    co2Emissions: state.co2Emissions as number | undefined,
    autonomiaEletrica: state.autonomiaEletrica as number | undefined,
    euro6eBis: !!state.euro6eBis,
    regimeTributario: (state.regimeTributario as 'irc' | 'irs') || 'irc',
    usoPercentagem: (state.usoPercentagem as number | undefined) ?? 100,
  }), [state]);

  const base: FinanciamentoInput = {
    preco,
    duracaoMeses,
    entrada,
    valorResidual,
    tanPercent,
    mensalidadeManual: mensalidadeManual || undefined,
    incluiManutencao,
    incluiSeguro,
    rentingDiscriminada,
    maintenanceCost: num(state.maintenanceCost),
    insuranceCost: num(state.insuranceCost),
    fuelCost: num(state.fuelCost),
    fiscal,
  };

  const { resultados, melhor } = useMemo(() => compararModos(base), [
    preco, duracaoMeses, entrada, valorResidual, tanPercent, mensalidadeManual,
    incluiManutencao, incluiSeguro, rentingDiscriminada,
    state.maintenanceCost, state.insuranceCost, state.fuelCost, fiscal,
  ]);

  if (preco <= 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-[#E2E8F0] bg-white p-5 text-[13px] text-[#64748B]">
        Indique o custo de aquisição da viatura para comparar compra, crédito, leasing e renting.
      </div>
    );
  }

  const linhas: { label: string; valor: (m: ModoAquisicao) => string; forte?: boolean }[] = [
    { label: 'Mensalidade', valor: m => (resultados[m].mensalidade > 0 ? eur(resultados[m].mensalidade) : '—') },
    { label: 'Pagamento inicial', valor: m => eur(resultados[m].cashInicial) },
    { label: 'Custo total', valor: m => eur(resultados[m].custoTotal), forte: true },
    { label: 'Custo líquido (após IVA)', valor: m => eur(resultados[m].custoLiquido), forte: true },
    { label: 'Gasto aceite fiscalmente', valor: m => eur(resultados[m].gastoAceite) },
    { label: 'IVA recuperável', valor: m => eur(resultados[m].ivaDedutivel) },
    { label: 'Tributação Autónoma', valor: m => eur(resultados[m].taValue) },
    { label: 'Juros / encargos fin.', valor: m => eur(resultados[m].jurosTotais) },
  ];

  const inputCls = 'w-full rounded-[8px] border-2 border-[#E2E8F0] bg-[#F5F7FA] px-3 py-2 text-[13px] font-[600] text-[#0F172A] outline-none focus:border-[#0F172A]';

  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-[12px] bg-[#EEF2FF] p-2.5 text-[#4F46E5]"><Scale className="h-5 w-5" /></div>
        <div>
          <h3 className="text-[16px] font-[800] text-[#0F172A]">Comparar aquisição</h3>
          <p className="text-[12px] text-[#64748B]">Compra, crédito, leasing e renting com o seu enquadramento fiscal. Valores estimados — confirme com o seu contabilista.</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[10.5px] font-[800] uppercase tracking-[1px] text-[#64748B]">Entrada (€)</label>
          <input type="number" value={entrada} onChange={e => patchFin({ entrada: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[10.5px] font-[800] uppercase tracking-[1px] text-[#64748B]">Prazo (meses)</label>
          <input type="number" value={duracaoMeses} onChange={e => patchFin({ duracaoMeses: Math.max(12, Math.min(120, Number(e.target.value) || 48)) })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[10.5px] font-[800] uppercase tracking-[1px] text-[#64748B]">TAN (%)</label>
          <input type="number" step="0.1" value={tanPercent} onChange={e => patchFin({ tanPercent: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[10.5px] font-[800] uppercase tracking-[1px] text-[#64748B]">Valor residual (€)</label>
          <input type="number" value={valorResidual} onChange={e => patchFin({ valorResidual: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px] font-[600] text-[#334155]">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={rentingDiscriminada} onChange={e => patchFin({ rentingDiscriminada: e.target.checked })} className="h-4 w-4 accent-[#0F172A]" />
          Fatura discriminada (leasing/renting)
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={incluiManutencao} onChange={e => patchFin({ incluiManutencao: e.target.checked })} className="h-4 w-4 accent-[#0F172A]" />
          Renting inclui manutenção
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={incluiSeguro} onChange={e => patchFin({ incluiSeguro: e.target.checked })} className="h-4 w-4 accent-[#0F172A]" />
          Renting inclui seguro
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead>
            <tr>
              <th className="w-[190px] px-2 py-2 text-left font-[700] text-[#64748B]"> </th>
              {MODOS.map(m => (
                <th key={m} className={`px-2 py-2 text-right font-[800] ${m === melhor ? 'text-[#0677FF]' : 'text-[#0F172A]'}`}>
                  <button
                    type="button"
                    onClick={() => onChange({ modoAquisicao: m })}
                    className={`inline-flex flex-col items-end gap-0.5 rounded px-1 py-0.5 ${m === modo ? 'underline decoration-2 underline-offset-4' : ''}`}
                    title={`Usar ${ETIQUETA_MODO[m]} no resultado principal`}
                  >
                    <span>{ETIQUETA_MODO[m]}</span>
                    {m === melhor && <span className="rounded-full bg-[#EFF6FF] px-1.5 py-0.5 text-[9.5px] font-[800] uppercase text-[#1E40AF]">Mais barato</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.label} className="border-t border-[#F1F5F9]">
                <td className={`px-2 py-1.5 text-[#64748B] ${l.forte ? 'font-[700]' : ''}`}>{l.label}</td>
                {MODOS.map(m => (
                  <td key={m} className={`px-2 py-1.5 text-right font-mono ${l.forte ? 'font-[800] text-[#0F172A]' : 'text-[#334155]'}`}>{l.valor(m)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[#64748B]">
        Renting assume mensalidade calculada com entrada, prazo, TAN e residual indicados; ajuste a renda real no contrato.
        A TA ({(resultados[melhor].taRate * 100).toFixed(0)}% no modo escolhido) incide sobre a base anual de encargos.
      </p>
    </div>
  );
}

export default ComparadorAquisicao;
