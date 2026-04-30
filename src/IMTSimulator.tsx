import React, { useMemo } from 'react';
import { Building, Euro, CheckCircle, AlertTriangle, MapPin } from 'lucide-react';
import { cn } from './lib/utils';
import { calcIMT, type TipoImovel, type Localizacao } from './lib/imt';
import { useTheme } from './ThemeContext';
import { Tip } from './Tip';

export interface IMTState {
  valor: number;
  tipo: TipoImovel;
  localizacao: Localizacao;
  primeiraHabitacao: boolean;
  idadeComprador: number;
}

interface Props {
  initialState: IMTState;
  onStateChange: (s: IMTState) => void;
}

const tipoLabels: Record<TipoImovel, string> = {
  hpp: 'Habitação Própria e Permanente (HPP)',
  habitacao: 'Habitação Secundária / Investimento',
  urbano_outros: 'Prédio Urbano — Outros Fins (comércio, serviços)',
  rustico: 'Prédio Rústico',
  outros: 'Outros / Genérico',
};

export default function IMTSimulator({ initialState, onStateChange }: Props) {
  const s = initialState;
  const setState = (u: Partial<IMTState>) => onStateChange({ ...s, ...u });
  const { simMode } = useTheme();
  const outerCls = { split: "h-full flex flex-col md:grid md:grid-cols-[380px_1fr] bg-[#F8FAFC] text-[#1E293B]", stacked: "h-full flex flex-col bg-[#F0F4F8] text-[#1E293B] overflow-y-auto", mosaic: "h-full bg-[#F0FDF4] text-[#1E293B] md:grid md:grid-cols-2 gap-4 p-4", compact: "h-full overflow-y-auto bg-white text-[#1E293B]", hero: "h-full flex md:flex-row-reverse overflow-hidden bg-[#F5F5F4] text-[#1E293B]" }[simMode];
  const leftCls = { split: "bg-white border-r border-[#E2E8F0] overflow-y-auto p-[28px] flex flex-col gap-[24px] h-full", stacked: "bg-white border-b-2 border-[#E2E8F0] p-6 flex flex-col gap-5", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pb-0 w-full", hero: "md:w-[400px] shrink-0 bg-white border-l border-[#E2E8F0] overflow-y-auto p-6 flex flex-col gap-5 h-full" }[simMode];
  const rightCls = { split: "overflow-y-auto p-[28px] flex flex-col gap-[16px]", stacked: "p-6 flex flex-col gap-4 max-w-7xl mx-auto w-full", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-4 h-full", compact: "max-w-xl mx-auto p-4 pt-2 w-full border-t border-slate-100", hero: "flex-1 overflow-y-auto p-6 flex flex-col gap-4" }[simMode];

  const result = useMemo(() => {
    if (s.valor <= 0) return null;
    return calcIMT(s.valor, s.tipo, s.localizacao, s.primeiraHabitacao, s.idadeComprador);
  }, [s]);

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  const inputCls = "w-full px-[14px] py-[11px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelCls = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[6px]";

  const jovemEligivel = s.idadeComprador <= 35 && s.primeiraHabitacao && s.tipo === 'hpp';

  return (
    <div className={outerCls}>
      {/* Left Pane */}
      <div className={leftCls}>
        <div>
          <h2 className="text-[22px] font-[800] tracking-[-0.5px] text-[#0F172A]">Simulador IMT</h2>
          <p className="text-[13px] text-[#64748B] font-[500] mt-[4px]">Imposto Municipal sobre Transmissões + Imposto de Selo (2026).</p>
        </div>

        <div className="space-y-[20px]">
          {/* Valor */}
          <div>
            <label className={labelCls}>Valor de Aquisição (€) <Tip>O preço de compra do imóvel em euros. É a base de cálculo do IMT e do Imposto de Selo.</Tip></label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input
                type="number"
                min="0"
                step="1000"
                value={s.valor === 0 ? '' : s.valor}
                onChange={e => setState({ valor: parseFloat(e.target.value) || 0 })}
                className={cn(inputCls, "pl-9")}
                placeholder="ex: 250000"
              />
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label className={labelCls}>Tipo de Imóvel <Tip>HPP é Habitação Própria Permanente (onde vai viver). Habitação secundária é uma segunda casa. Prédio urbano outros fins é para uso comercial/arrendamento.</Tip></label>
            <select value={s.tipo} onChange={e => setState({ tipo: e.target.value as TipoImovel })} className={inputCls}>
              {(Object.entries(tipoLabels) as [TipoImovel, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Localização */}
          <div>
            <label className={labelCls}>Localização <Tip>O local onde fica o imóvel. Nos Açores e Madeira os escalões do IMT são 25% mais elevados.</Tip></label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <select value={s.localizacao} onChange={e => setState({ localizacao: e.target.value as Localizacao })} className={cn(inputCls, "pl-9")}>
                <option value="continente">Continente</option>
                <option value="madeira">Madeira (+25%)</option>
                <option value="acores">Açores (+25%)</option>
              </select>
            </div>
          </div>

          {/* 1ª Habitação */}
          {(s.tipo === 'hpp' || s.tipo === 'habitacao') && (
            <label className={cn(
              "flex items-center gap-3 p-[14px] rounded-[12px] border-2 cursor-pointer transition-colors",
              s.primeiraHabitacao ? "bg-[#0F172A]/5 border-[#0F172A]" : "bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#94A3B8]"
            )}>
              <input type="checkbox" checked={s.primeiraHabitacao} onChange={e => setState({ primeiraHabitacao: e.target.checked })} className="hidden" />
              <div className={cn("w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-colors",
                s.primeiraHabitacao ? "bg-[#0F172A] border-[#0F172A]" : "border-[#E2E8F0]")}>
                {s.primeiraHabitacao && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              <span className="text-[13px] font-[600] text-[#475569]">Primeira habitação (HPP) <Tip>Se é a primeira vez que compra uma casa para habitação própria permanente. Condição necessária para beneficiar da isenção de IMT Jovem.</Tip></span>
            </label>
          )}

          {/* Idade */}
          <div>
            <label className={labelCls}>Idade do Comprador <Tip>A idade do comprador no momento da escritura. Até 35 anos (inclusive) pode beneficiar do IMT Jovem se for primeira habitação.</Tip></label>
            <input
              type="number"
              min="18"
              max="100"
              value={s.idadeComprador === 0 ? '' : s.idadeComprador}
              onChange={e => setState({ idadeComprador: parseInt(e.target.value) || 0 })}
              className={inputCls}
              placeholder="ex: 32"
            />
            {jovemEligivel && (
              <p className="text-[12px] text-emerald-700 font-[600] mt-[6px] bg-emerald-50 px-3 py-2 rounded-[8px] border border-emerald-200">
                ✓ Elegível para IMT Jovem (≤35 anos, 1ª habitação HPP)
              </p>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[14px] text-[12px] text-[#64748B] space-y-[4px]">
          <div className="font-[700] text-[#475569] mb-[6px]">Imposto de Selo</div>
          <div>Taxa: 0,8% sobre o valor de transação (TGIS verba 1.1)</div>
          <div>Isento no IMT Jovem até ao tecto de isenção total (€330.539 no Continente)</div>
        </div>
      </div>

      {/* Right Pane */}
      <div className={rightCls}>
        {!result && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[#94A3B8]">
              <Building className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-[600] text-[15px]">Introduza o valor de aquisição</p>
            </div>
          </div>
        )}

        {result && (
          <>
            {/* Badge IMT Jovem */}
            {result.isentoJovem && (
              <div className={cn(
                "rounded-[16px] p-[16px] border-2 flex items-center gap-3",
                result.isento ? "bg-emerald-50 border-emerald-300" : "bg-amber-50 border-amber-300"
              )}>
                <CheckCircle className={cn("w-5 h-5 shrink-0", result.isento ? "text-emerald-600" : "text-amber-600")} />
                <div>
                  <div className={cn("text-[13px] font-[800]", result.isento ? "text-emerald-800" : "text-amber-800")}>
                    {result.isento ? 'Isento de IMT e Imposto de Selo' : 'IMT Jovem — Redução parcial'}
                  </div>
                  <div className={cn("text-[12px] mt-[2px]", result.isento ? "text-emerald-700" : "text-amber-700")}>
                    CIMT Art. 11º-A — OE 2026
                  </div>
                </div>
              </div>
            )}

            {/* Cards de impostos */}
            <div className="grid grid-cols-3 gap-[12px]">
              {[
                { label: 'IMT', value: result.imt, color: result.imt === 0 ? 'emerald' : 'red' },
                { label: 'Imposto de Selo', value: result.impostoSelo, color: result.impostoSelo === 0 ? 'emerald' : 'orange' },
                { label: 'Total Impostos', value: result.total, color: result.total === 0 ? 'emerald' : 'red' },
              ].map(({ label, value, color }) => (
                <div key={label} className={cn(
                  "rounded-[16px] p-[16px] border text-center",
                  color === 'emerald' ? 'bg-emerald-50 border-emerald-100' : color === 'orange' ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100'
                )}>
                  <div className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]">{label}</div>
                  <div className={cn(
                    "text-[22px] font-[900] mt-[4px]",
                    color === 'emerald' ? 'text-emerald-700' : color === 'orange' ? 'text-orange-700' : 'text-red-700'
                  )}>{ptEur(value)}</div>
                  {label === 'IMT' && value > 0 && (
                    <div className="text-[11px] text-[#94A3B8] mt-1">taxa {pct(result.taxaAplicada)}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Breakdown */}
            <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[20px]">
              <h3 className="text-[13px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[14px]">Detalhe do Cálculo</h3>
              <div className="space-y-[10px]">
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#64748B]">Valor de aquisição</span>
                  <span className="font-[700] text-[#0F172A]">{ptEur(s.valor)}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#64748B]">IMT</span>
                  <span className={cn("font-[700]", result.imt === 0 ? "text-emerald-600" : "text-red-600")}>{result.imt === 0 ? 'Isento' : `- ${ptEur(result.imt)}`}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#64748B]">Imposto de Selo (0,8%)</span>
                  <span className={cn("font-[700]", result.impostoSelo === 0 ? "text-emerald-600" : "text-orange-600")}>{result.impostoSelo === 0 ? 'Isento' : `- ${ptEur(result.impostoSelo)}`}</span>
                </div>
                <div className="h-px bg-[#E2E8F0] my-2" />
                <div className="flex justify-between text-[15px]">
                  <span className="font-[700] text-[#0F172A]">Valor total de aquisição</span>
                  <span className="font-[900] text-[#0F172A]">{ptEur(s.valor + result.total)}</span>
                </div>
                <div className="text-[11px] text-[#94A3B8] mt-1">(não inclui honorários de notário, registos e IMI)</div>
              </div>
            </div>

            {/* Base legal */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[16px] p-[16px]">
              <div className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[6px]">Base Legal</div>
              <p className="text-[13px] text-[#64748B]">{result.descricao}</p>
              {jovemEligivel && (
                <p className="text-[12px] text-emerald-700 mt-[6px]">
                  IMT Jovem: CIMT Art. 11º-A, aditado pelo OE 2026 — isenção total até €330.539 (Continente)
                </p>
              )}
            </div>

            {/* Estimativa outros custos */}
            <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[20px]">
              <h3 className="text-[13px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[14px]">Estimativa de Outros Custos de Aquisição</h3>
              <div className="space-y-[8px]">
                {[
                  { label: 'Escritura (aprox. 0,5%)', value: s.valor * 0.005 },
                  { label: 'Registo predial (aprox. 0,25%)', value: s.valor * 0.0025 },
                  { label: 'Comissão imobiliária (5% + IVA, se aplicável)', value: s.valor * 0.05 * 1.23 },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-[13px]">
                    <span className="text-[#64748B]">{label}</span>
                    <span className="font-[600] text-[#475569]">~ {ptEur(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
