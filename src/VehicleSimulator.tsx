import React, { useMemo, useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Car, Euro, AlertTriangle, ShieldCheck, ListOrdered } from 'lucide-react';
import { cn } from './lib/utils';
import { useTheme } from './ThemeContext';
import { Tip } from './Tip';
import { FlowWizard } from './FlowWizard';
import { useFlowMode } from './AnimatedPage';

interface VehicleSimulatorState {
  category: 'comercial' | 'passageiros';
  engineType: string;
  price: number;
  ivaRegime: string;
  activity: string;
  maintenanceCost: number;
  insuranceCost: number;
  fuelCost: number;
  exemptTA: boolean;
  phevCompliant: boolean;
}

interface Props {
  initialState: VehicleSimulatorState;
  onStateChange: (state: VehicleSimulatorState) => void;
}

function AutoScale({ children, className }: { children: React.ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current || !contentRef.current) return;
      const containerH = containerRef.current.clientHeight;
      const contentH = contentRef.current.scrollHeight;
      const containerW = containerRef.current.clientWidth;
      const contentW = contentRef.current.scrollWidth;
      const sy = contentH > containerH ? containerH / contentH : 1;
      const sx = contentW > containerW ? containerW / contentW : 1;
      setScale(Math.min(sx, sy, 1));
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={containerRef} className={cn("w-full h-full overflow-hidden flex items-start justify-center", className)}>
      <div ref={contentRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: '100%' }}>
        {children}
      </div>
    </div>
  );
}

function VehicleResults({ state, results, flow = false }: { state: VehicleSimulatorState; results: ReturnType<typeof useVehicleResults>; flow?: boolean }) {
  const { category } = state;
  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  if (flow) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* IVA Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-6 flex flex-col shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-[#ECFDF5] text-[#10B981] p-2.5 rounded-[12px]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-[16px] font-[800] text-[#0F172A]">IVA Recupérável Anual <Tip>O total de IVA que a empresa pode deduzir.</Tip></h3>
          </div>
          <div className="text-[40px] font-[800] text-[#10B981] tracking-[-2px] mb-4">
            {ptEur(results.ivaTotalDedutivel)}
          </div>
          <div className="flex-1 space-y-0">
            {[
              { label: 'IVA Aquisição', value: results.ivaAquisicaoDedutivel },
              { label: 'IVA Manutenção', value: results.ivaRecupManutencao },
              { label: 'IVA Combustível', value: results.ivaRecupCombustivel },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-3 border-b border-[#F1F5F9] text-[14px] items-center">
                <span className="text-[#64748B] font-[700]">{row.label}</span>
                <span className="font-[800] font-mono text-[#0F172A]">{ptEur(row.value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-[#F8FAFC] rounded-[10px] text-[12px] text-[#64748B] font-[600] leading-relaxed">
            Seguro está isento de IVA — margem de recuperação 0€.
          </div>
        </div>

        {/* TA Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-6 flex flex-col shadow-sm relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-[#FEF2F2] text-[#EF4444] p-2.5 rounded-[12px]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-[16px] font-[800] text-[#0F172A]">Tributação Autónoma <Tip>Imposto extra sobre encargos com viaturas de passageiros.</Tip></h3>
          </div>
          <div className="text-[40px] font-[800] text-[#EF4444] tracking-[-2px] mb-3">
            {ptEur(results.taValue)}
          </div>
          <div className="mb-4">
            <span className="inline-flex items-center px-4 py-2 bg-[#FEF2F2] text-[#B91C1C] text-[12px] font-[800] uppercase tracking-[1px] rounded-full">
              Taxa: {(results.taRate * 100).toFixed(1)}% IRC
            </span>
          </div>

          {results.isElecTaxed && (
            <div className="mb-3 p-3 bg-sky-50 border border-sky-200 text-sky-800 rounded-[8px] text-[12px] font-[600] leading-snug">
              <strong>Lei 82/2023:</strong> Elétricos &gt;62.500€ sujeitos a TA 10%.
            </div>
          )}

          {category === 'passageiros' ? (
            <div className="flex-1 space-y-0">
              <div className="flex justify-between py-3 border-b border-[#F1F5F9] text-[14px] items-center">
                <span className="text-[#64748B] font-[700]">Lmt. Depreciação</span>
                <span className="font-[800] font-mono text-[#0F172A]">{results.limit === Infinity ? 'Ilimitado' : ptEur(results.limit)}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-[#F1F5F9] text-[14px] items-center">
                <span className="text-[#64748B] font-[700]">Dep. Não Aceite</span>
                <span className="font-[800] font-mono text-[#0F172A]">{ptEur(results.depNaoAceite)}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-[#F1F5F9] text-[14px] items-center">
                <span className="text-[#64748B] font-[700]">Encargos Sujeitos a TA</span>
                <span className="font-[800] font-mono text-[#0F172A]">{ptEur(results.totalEncsTA)}</span>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-5 bg-[#F1F5F9] rounded-[12px] text-center text-[#475569] text-[13px] font-[700]">
              Viaturas comerciais não sujeitas a TA.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-[24px]">
      <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm">
        <div className="flex items-center gap-[16px] mb-[24px]">
          <div className="bg-[#ECFDF5] text-[#10B981] p-[12px] rounded-[16px]">
            <ShieldCheck className="w-[24px] h-[24px]" />
          </div>
          <h3 className="text-[18px] font-[700] text-[#0F172A]">IVA Recupérável Anual <Tip>O total de IVA que a empresa pode deduzir (recuperar) na aquisição e encargos com a viatura durante o ano. Depende do tipo de motor, atividade e preço do carro.</Tip></h3>
        </div>

        <div className="text-[48px] md:text-[56px] font-[800] text-[#10B981] tracking-[-2px] mb-[32px]">
          {ptEur(results.ivaTotalDedutivel)}
        </div>

        <div className="flex-1 space-y-0">
          <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
            <span className="text-[#64748B] font-[600]">IVA Aquisição (Dedutível) <Tip>O IVA pago na compra da viatura que a empresa pode recuperar. Para carros de passageiros normais, geralmente é 0%; para elétricos, híbridos plug-in e comerciais há regras específicas.</Tip></span>
            <span className="font-[700] font-mono text-[#0F172A]">{ptEur(results.ivaAquisicaoDedutivel)}</span>
          </div>
          <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
            <span className="text-[#64748B] font-[600]">IVA Operação (Manutenção) <Tip>O IVA das faturas de oficina, revisões e manutenção que a empresa pode deduzir. Para viaturas comerciais é 100%; para passageiros, depende do tipo de atividade.</Tip></span>
            <span className="font-[700] font-mono text-[#0F172A]">{ptEur(results.ivaRecupManutencao)}</span>
          </div>
          <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
            <span className="text-[#64748B] font-[600]">IVA Op. (Combustível/Energia) <Tip>O IVA do combustível ou carga elétrica que a empresa pode recuperar. Para gasóleo e GPL é 50% (veículos de passageiros); para elétricos é 100%; para gasolina é 0%.</Tip></span>
            <span className="font-[700] font-mono text-[#0F172A]">{ptEur(results.ivaRecupCombustivel)}</span>
          </div>
        </div>

        <div className="mt-[32px] p-[16px] bg-[#F8FAFC] rounded-[12px] text-[12px] text-[#64748B] font-[500] leading-relaxed">
          Nota: O Seguro Automóvel em Portugal está isento de IVA (sujeito apenas a Imposto de Selo), logo a margem de recuperação dessa despesa é 0€ por natureza de imposto.
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm relative">
        <div className="flex items-center gap-[16px] mb-[24px]">
          <div className="bg-[#FEF2F2] text-[#EF4444] p-[12px] rounded-[16px]">
            <AlertTriangle className="w-[24px] h-[24px]" />
          </div>
          <h3 className="text-[18px] font-[700] text-[#0F172A]">Tributação Autónoma a Pagar <Tip>A Tributação Autónoma (TA) é um imposto sobre os encargos com viaturas de passageiros. Incide sobre depreciação + manutenção + seguro + combustível, a uma taxa que aumenta com o preço do carro.</Tip></h3>
        </div>

        <div className="text-[48px] md:text-[56px] font-[800] text-[#EF4444] tracking-[-2px] mb-[12px]">
          {ptEur(results.taValue)}
        </div>
        <div className="mb-[24px]">
          <span className="inline-flex items-center px-[12px] py-[6px] bg-[#FEF2F2] text-[#B91C1C] text-[12px] font-[800] uppercase tracking-[1px] rounded-full">
            Taxa Aplicada: {(results.taRate * 100).toFixed(1)}% IRC <Tip>A percentagem de Tributação Autónoma que se aplica ao total de encargos com esta viatura. Carros mais caros têm taxas mais elevadas.</Tip>
          </span>
        </div>

        {results.isElecTaxed && (
          <div className="mb-[20px] p-[12px] bg-sky-50 border border-sky-200 text-sky-800 rounded-[8px] text-[12px] font-[500] leading-snug">
            <strong>Atenção à Lei nº 82/2023:</strong> Contrário à ideia de isenção total, viaturas 100% elétricas com custo superior a 62.500€ encontram-se sujeitas a Tributação Autónoma de 10% (Artº 88º do CIRC).
          </div>
        )}

        {category === 'passageiros' ? (
          <div className="flex-1 space-y-0">
            <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
              <span className="text-[#64748B] font-[600]">Lmt. Depreciação (Fiscal) <Tip>O limite máximo sobre o qual a empresa calcula depreciações aceites fiscalmente. Gasolina/Diesel: €25.000; GPL/GNV: €37.500; PHEV: €50.000; Elétrico: €62.500.</Tip></span>
              <span className="font-[700] font-mono text-[#0F172A]">{results.limit === Infinity ? 'Ilimitado' : ptEur(results.limit)}</span>
            </div>
            <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
              <span className="text-[#64748B] font-[600]">Depreciação Não Aceite <Tip>A parte da depreciação anual que o fisco não aceita como gasto, por o preço do carro exceder o limite legal. Aumenta o lucro tributável da empresa.</Tip></span>
              <span className="font-[700] font-mono text-[#0F172A]">{ptEur(results.depNaoAceite)}</span>
            </div>
            <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
              <span className="text-[#64748B] font-[600]">Encargos Sujeitos a TA <Tip>O total de encargos (depreciação + manutenção + seguro + combustível) que serve de base para calcular a Tributação Autónoma. Quanto maior este valor, maior o imposto.</Tip></span>
              <span className="font-[700] font-mono text-[#0F172A]">{ptEur(results.totalEncsTA)}</span>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-[20px] bg-[#F1F5F9] rounded-[16px] text-center text-[#475569] text-[13px] font-[600] leading-relaxed">
            As viaturas comerciais ligeiras (lotação 2/3) não estão sujeitas ao agravamento por Tributação Autónoma.
          </div>
        )}
      </div>
    </div>
  );
}

function useVehicleResults(state: VehicleSimulatorState) {
  const { category, engineType, price, ivaRegime, activity, maintenanceCost, insuranceCost, fuelCost, exemptTA, phevCompliant } = state;

  return useMemo(() => {
    const maintBase = maintenanceCost / 1.23;
    const maintIva = maintenanceCost - maintBase;

    const insIva = 0;

    const fuelBase = fuelCost / 1.23;
    const fuelIva = fuelCost - fuelBase;

    const isExemptActivity = ['public_transport', 'rent_a_car', 'driving_school'].includes(activity);

    let ivaAquisicaoDedRate = 0;
    const totalIvaAquisicao = price * 0.23;

    if (ivaRegime === 'normal') {
      if (isExemptActivity) {
        ivaAquisicaoDedRate = 1;
      } else if (category === 'passageiros') {
        if (engineType === 'electric') ivaAquisicaoDedRate = price <= 62500 ? 1 : 0;
        else if (engineType === 'phev' && phevCompliant) ivaAquisicaoDedRate = price <= 50000 ? 1 : 0;
        else if (['lpg', 'cng'].includes(engineType)) ivaAquisicaoDedRate = price <= 37500 ? 0.5 : 0;
      } else if (category === 'comercial') {
        if (['electric', 'phev', 'lpg', 'cng'].includes(engineType)) ivaAquisicaoDedRate = 1;
        else if (engineType === 'diesel') ivaAquisicaoDedRate = 0.5;
      }
    }
    const ivaAquisicaoDedutivel = totalIvaAquisicao * ivaAquisicaoDedRate;

    let maintIvaDedRate = 0;
    if (isExemptActivity || category === 'comercial') {
      maintIvaDedRate = 1;
    }
    const ivaRecupManutencao = maintIva * maintIvaDedRate;

    let fuelIvaDedRate = 0;
    if (isExemptActivity || (activity === 'goods' && category === 'comercial')) {
      fuelIvaDedRate = 1;
    } else {
      if (engineType === 'electric') fuelIvaDedRate = 1;
      else if (['diesel', 'lpg', 'cng'].includes(engineType)) fuelIvaDedRate = 0.5;
      else if (engineType === 'phev') fuelIvaDedRate = 0;
    }
    const ivaRecupCombustivel = fuelIva * fuelIvaDedRate;

    const ivaTotalDedutivel = ivaAquisicaoDedutivel + ivaRecupManutencao + ivaRecupCombustivel;

    let limit = 25000;
    let phevValid = engineType === 'phev' && phevCompliant;

    if (engineType === 'electric') limit = 62500;
    else if (phevValid) limit = 50000;
    else if (['lpg', 'cng'].includes(engineType)) limit = 37500;

    if (isExemptActivity) limit = Infinity;

    const depAnualTotal = price * 0.25;
    const depAceite = limit === Infinity ? depAnualTotal : Math.min(price, limit) * 0.25;
    const depNaoAceite = Math.max(0, depAnualTotal - depAceite);

    let taRate = 0;
    let taValue = 0;

    const maintCustoFinal = maintenanceCost - ivaRecupManutencao;
    const insCustoFinal = insuranceCost;
    const fuelCustoFinal = fuelCost - ivaRecupCombustivel;
    const totalEncsTA = depAnualTotal + maintCustoFinal + insCustoFinal + fuelCustoFinal;

    if (category === 'passageiros') {
      if (exemptTA) {
        taRate = 0;
      } else {
        if (engineType === 'electric') {
          taRate = price >= 62500 ? 0.10 : 0;
        } else if (phevValid) {
          taRate = price < 27500 ? 0.025 : (price < 35000 ? 0.075 : 0.15);
        } else {
          taRate = price < 27500 ? 0.085 : (price < 35000 ? 0.255 : 0.325);
        }
      }
      taValue = totalEncsTA * taRate;
    }

    return {
      ivaAquisicaoDedutivel,
      ivaRecupManutencao,
      ivaRecupCombustivel,
      ivaTotalDedutivel,
      taRate,
      taValue,
      depNaoAceite,
      limit,
      totalEncsTA,
      isElecTaxed: engineType === 'electric' && price >= 62500 && !exemptTA
    };
  }, [category, engineType, price, ivaRegime, activity, maintenanceCost, insuranceCost, fuelCost, exemptTA, phevCompliant]);
}

export default function VehicleSimulator({ initialState, onStateChange }: Props) {
  const { category, engineType, price, ivaRegime, activity, maintenanceCost, insuranceCost, fuelCost, exemptTA, phevCompliant } = initialState;

  const { flowMode, enterFlow, exitFlow } = useFlowMode();

  const setState = (updates: Partial<VehicleSimulatorState>) => {
    onStateChange({ ...initialState, ...updates });
  };

  const { simMode } = useTheme();
  const outerCls = { split: "overflow-y-auto lg:overflow-hidden lg:h-full lg:grid lg:grid-cols-[400px_1fr] bg-[#F8FAFC] text-[#1E293B]", stacked: "h-full flex flex-col bg-[#F0F4F8] text-[#1E293B] overflow-y-auto", mosaic: "h-full bg-[#F0FDF4] text-[#1E293B] md:grid md:grid-cols-2 gap-4 p-4", compact: "h-full overflow-y-auto bg-white text-[#1E293B]", hero: "h-full flex md:flex-row-reverse overflow-hidden bg-[#F5F5F4] text-[#1E293B]" }[simMode];
  const leftCls = { split: "bg-white border-b border-[#E2E8F0] lg:border-b-0 lg:border-r lg:overflow-y-auto p-4 sm:p-6 lg:p-[40px] flex flex-col gap-5 lg:gap-[32px] lg:h-full", stacked: "bg-white border-b-2 border-[#E2E8F0] p-6 flex flex-col gap-6", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pb-0 w-full", hero: "md:w-[420px] shrink-0 bg-white border-l border-[#E2E8F0] overflow-y-auto p-6 flex flex-col gap-5 h-full" }[simMode];
  const rightCls = { split: "p-4 sm:p-6 lg:p-[40px] lg:overflow-y-auto lg:h-full max-w-7xl mx-auto w-full flex flex-col gap-5 lg:gap-[32px]", stacked: "p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pt-2 w-full border-t border-slate-100", hero: "flex-1 p-6 md:p-[40px] overflow-y-auto flex flex-col gap-5" }[simMode];

  const results = useVehicleResults(initialState);

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  const inputClass = "w-full pl-[16px] pr-[16px] py-[12px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[15px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelClass = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[8px]";

  type StepDef = {
    id: string;
    label: string;
    description: string;
    isVisible: (s: VehicleSimulatorState) => boolean;
    render: (s: VehicleSimulatorState, setS: (u: Partial<VehicleSimulatorState>) => void) => React.ReactNode;
    skipValue?: any;
    skipLabel?: string;
  };

  const steps: StepDef[] = [
    {
      id: 'category',
      label: 'Categoria do Veículo',
      description: 'Escolhe o tipo de viatura que vais simular.',
      isVisible: () => true,
      render: (s, setS) => (
        <select value={s.category} onChange={e => setS({ category: e.target.value as any })} className={inputClass}>
          <option value="passageiros">Ligeiro de Passageiros</option>
          <option value="comercial">Comercial (2/3 lugares)</option>
        </select>
      ),
    },
    {
      id: 'engineType',
      label: 'Motor / Combustível',
      description: 'Seleciona o tipo de motor ou combustível da viatura.',
      isVisible: () => true,
      render: (s, setS) => (
        <select value={s.engineType} onChange={e => setS({ engineType: e.target.value })} className={inputClass}>
          <option value="diesel">Gasóleo</option>
          <option value="gasoline">Gasolina</option>
          <option value="hybrid">Híbrido (Não Plug-in)</option>
          <option value="phev">Híbrido Plug-in (PHEV)</option>
          <option value="electric">100% Elétrico</option>
          <option value="lpg">GPL</option>
          <option value="cng">GNV</option>
        </select>
      ),
    },
    {
      id: 'phevCompliant',
      label: 'PHEV — Cumpre requisitos?',
      description: 'O veículo tem autonomia elétrica ≥50 km e emissões <50 gCO₂/km?',
      isVisible: s => s.engineType === 'phev',
      render: (s, setS) => (
        <label className="flex items-start gap-3 p-4 bg-amber-50/50 border border-amber-200 text-amber-900 rounded-[8px] cursor-pointer">
          <input type="checkbox" checked={s.phevCompliant} onChange={e => setS({ phevCompliant: e.target.checked })} className="mt-[2px] accent-amber-600 w-5 h-5" />
          <span className="text-[14px] font-[600]">Sim, cumpre os requisitos legais para PHEV.</span>
        </label>
      ),
      skipValue: false,
      skipLabel: 'Não cumpre',
    },
    {
      id: 'price',
      label: 'Custo de Aquisição',
      description: 'Preço base da viatura sem IVA. Determina os limites de dedução e amortização.',
      isVisible: () => true,
      render: (s, setS) => (
        <div className="relative">
          <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <input type="number" value={s.price === 0 ? '' : s.price} onChange={e => setS({ price: Number(e.target.value) || 0 })} className={cn(inputClass, "pl-[40px]")} />
        </div>
      ),
      skipValue: 0,
    },
    {
      id: 'ivaRegime',
      label: 'Regime Fiscal da Aquisição',
      description: 'Como foi adquirida a viatura?',
      isVisible: () => true,
      render: (s, setS) => (
        <select value={s.ivaRegime} onChange={e => setS({ ivaRegime: e.target.value })} className={inputClass}>
          <option value="normal">Compra Nova (Fatura c/ IVA)</option>
          <option value="second_hand">Regime Bens em 2ª Mão</option>
          <option value="leasing">Locação / Leasing / Renting</option>
        </select>
      ),
    },
    {
      id: 'activity',
      label: 'Serviço ou Atividade Associada',
      description: 'Qual a atividade principal para a qual a viatura será utilizada?',
      isVisible: () => true,
      render: (s, setS) => (
        <select value={s.activity} onChange={e => setS({ activity: e.target.value as any })} className={inputClass}>
          <option value="other">Geral / Serviços / Comércio</option>
          {s.category === 'comercial' && <option value="goods">Transporte Mercadorias (Alvará)</option>}
          <option value="public_transport">Transporte Público / Táxi / TVDE</option>
          <option value="rent_a_car">Rent-a-car / Comércio Automóvel</option>
          <option value="driving_school">Escola de Condução</option>
        </select>
      ),
    },
    {
      id: 'maintenanceCost',
      label: 'Manutenção & Oficinas (anual c/ IVA)',
      description: 'Total estimado gasto por ano em revisões, reparações e pneus.',
      isVisible: () => true,
      render: (s, setS) => (
        <input type="number" value={s.maintenanceCost === 0 ? '' : s.maintenanceCost} onChange={e => setS({ maintenanceCost: Number(e.target.value) || 0 })} className={cn(inputClass, "py-[8px] px-[12px]")} />
      ),
      skipValue: 0,
    },
    {
      id: 'insuranceCost',
      label: 'Seguro & Portagens (anual c/ IVA)',
      description: 'Prémio anual do seguro automóvel e portagens.',
      isVisible: () => true,
      render: (s, setS) => (
        <input type="number" value={s.insuranceCost === 0 ? '' : s.insuranceCost} onChange={e => setS({ insuranceCost: Number(e.target.value) || 0 })} className={cn(inputClass, "py-[8px] px-[12px]")} />
      ),
      skipValue: 0,
    },
    {
      id: 'fuelCost',
      label: 'Combustível / Carga (anual c/ IVA)',
      description: 'Total estimado gasto em combustível ou energia elétrica por ano.',
      isVisible: () => true,
      render: (s, setS) => (
        <input type="number" value={s.fuelCost === 0 ? '' : s.fuelCost} onChange={e => setS({ fuelCost: Number(e.target.value) || 0 })} className={cn(inputClass, "py-[8px] px-[12px]")} />
      ),
      skipValue: 0,
    },
    {
      id: 'exemptTA',
      label: 'Dispensa de Tributação Autónoma?',
      description: 'Existe acordo escrito para imputação dos custos aos rendimentos do colaborador em sede de IRS?',
      isVisible: s => s.category === 'passageiros',
      render: (s, setS) => (
        <label className="flex items-start gap-3 p-4 border-2 border-[#E2E8F0] rounded-[16px] cursor-pointer transition-colors hover:border-[#CBD5E1]">
          <input type="checkbox" checked={s.exemptTA} onChange={e => setS({ exemptTA: e.target.checked })} className="mt-[2px] w-5 h-5 rounded border-[#E2E8F0] text-[#0F172A] focus:ring-[#0F172A]" />
          <span className="text-[14px] font-[700] text-[#0F172A]">Sim, existe acordo de imputação de custos.</span>
        </label>
      ),
      skipValue: false,
      skipLabel: 'Não existe',
    },
    {
      id: 'results',
      label: 'Resultados da Simulação',
      description: 'Aqui estão os cálculos de IVA recuperável e Tributação Autónoma.',
      isVisible: () => true,
      render: () => <VehicleResults state={initialState} results={results} flow />,
    },
  ];

  const flowSteps = steps.filter(s => s.id !== 'results');
  const resultsStepDef = steps.find(s => s.id === 'results')!;

  if (flowMode) {
    return (
      <FlowWizard
        open={flowMode}
        onClose={exitFlow}
        title="Simulador Viaturas"
        icon={Car}
        steps={flowSteps}
        resultsStep={{ label: resultsStepDef.label, description: resultsStepDef.description, render: resultsStepDef.render(initialState, setState) }}
        state={initialState}
        setState={setState}
      />
    );
  }

  return (
    <motion.div
      className={outerCls}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* Left Pane - Form */}
      <motion.div
        className={leftCls}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[24px] font-[800] tracking-[-0.5px] text-[#0F172A]">Simulador Viaturas <Tip>Calcula o IVA que a empresa pode recuperar na compra e manutenção do carro, e a Tributação Autónoma sobre encargos com viaturas de passageiros.</Tip></h2>
            <p className="text-[14px] text-[#64748B] font-[500] mt-[4px]">Cálculo IVA e Tributação Autónoma. <Tip>IVA é o Imposto sobre o Valor Acrescentado — as empresas podem recuperar parte do IVA pago se usarem o carro para atividade tributável. Tributação Autónoma é um imposto extra sobre encargos com carros da empresa.</Tip></p>
          </div>
          <motion.button
            onClick={enterFlow}
            className="shrink-0 flex items-center gap-2 px-3 py-2 text-[13px] font-[700] text-[#781D1D] bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] hover:bg-[#FEE2E2] transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <ListOrdered className="w-4 h-4" />
            Vista simplificada
          </motion.button>
        </div>

        <div className="space-y-[24px]">
          <div>
            <label className={labelClass}>Categoria do Veículo <Tip>Veículos comerciais (carrinhas, camionetas) têm tratamento fiscal mais favorável. Veículos de passageiros têm mais restrições fiscais.</Tip></label>
            <select value={category} onChange={e=>setState({category: e.target.value as any})} className={inputClass}>
              <option value="passageiros">Ligeiro de Passageiros</option>
              <option value="comercial">Comercial (2/3 lugares)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Motor / Combustível <Tip>O tipo de combustível do carro: diesel, gasolina, elétrico ou híbrido. Afeta os limites de dedução de IVA e a isenção de Imposto Automóvel.</Tip></label>
            <select value={engineType} onChange={e=>setState({engineType: e.target.value})} className={inputClass}>
              <option value="diesel">Gasóleo</option>
              <option value="gasoline">Gasolina</option>
              <option value="hybrid">Híbrido (Não Plug-in)</option>
              <option value="phev">Híbrido Plug-in (PHEV)</option>
              <option value="electric">100% Elétrico</option>
              <option value="lpg">GPL</option>
              <option value="cng">GNV</option>
            </select>
            {engineType === 'phev' && (
              <label className="flex items-start gap-2 mt-4 p-3 bg-amber-50/50 border border-amber-200 text-amber-900 rounded-[8px] cursor-pointer">
                <input type="checkbox" checked={phevCompliant} onChange={e=>setState({phevCompliant: e.target.checked})} className="mt-[2px] accent-amber-600" />
                <span className="text-[12px] font-[500] leading-tight">Autonomia elétrica é ≥50 km e emissões são &lt;50 gCO₂/km. <Tip>PHEV é um veículo híbrido plug-in. Se cumpre os requisitos de emissões, pode ter limites de dedução mais favoráveis.</Tip></span>
              </label>
            )}
          </div>

          <div>
            <label className={labelClass}>Custo Aquisição (Base s/ IVA) <Tip>O preço de compra da viatura (sem IVA). Determina os limites de dedução e amortização permitidos.</Tip></label>
            <div className="relative">
              <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input type="number" value={price === 0 ? '' : price} onChange={e=>setState({price: Number(e.target.value) || 0})} className={cn(inputClass, "pl-[40px]")} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Regime Fiscal da Aquisição <Tip>Se a empresa está no regime normal de IVA, pode recuperar parte do IVA pago na compra e manutenção do carro.</Tip></label>
            <select value={ivaRegime} onChange={e=>setState({ivaRegime: e.target.value})} className={inputClass}>
              <option value="normal">Compra Nova (Fatura c/ IVA)</option>
              <option value="second_hand">Regime Bens em 2ª Mão</option>
              <option value="leasing">Locação / Leasing / Renting</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Serviço ou Atividade Associada <Tip>A atividade para que serve a viatura: escolas de condução, rent-a-car e transportes públicos têm deduções de IVA a 100%.</Tip></label>
            <select value={activity} onChange={e=>setState({activity: e.target.value as any})} className={inputClass}>
              <option value="other">Geral / Serviços / Comércio</option>
              {category === 'comercial' && <option value="goods">Transporte Mercadorias (Alvará)</option>}
              <option value="public_transport">Transporte Público / Táxi / TVDE</option>
              <option value="rent_a_car">Rent-a-car / Comércio Automóvel</option>
              <option value="driving_school">Escola de Condução</option>
            </select>
          </div>

          <div className="p-5 border-2 border-[#E2E8F0] rounded-[16px] bg-[#F8FAFC]">
            <h3 className="text-[12px] font-[800] text-[#0F172A] mb-4">ENCARGOS ANUAIS (COM IVA) <Tip>Os custos anuais de operação da viatura (manutenção, seguro e combustível) com IVA incluído. São usados para calcular a base da Tributação Autónoma.</Tip></h3>
            <div className="space-y-[16px]">
              <div>
                <label className="text-[11px] font-[700] text-[#64748B] uppercase">Manutenção & Oficinas <Tip>O total gasto por ano em revisões, reparações, pneus e outros serviços de manutenção.</Tip></label>
                <input type="number" value={maintenanceCost === 0 ? '' : maintenanceCost} onChange={e=>setState({maintenanceCost: Number(e.target.value) || 0})} className={cn(inputClass, "py-[8px] px-[12px] mt-1")} />
              </div>
              <div>
                <label className="text-[11px] font-[700] text-[#64748B] uppercase">Seguro & Portagens <Tip>O prémio anual do seguro automóvel. Geralmente dedutível como gasto da empresa.</Tip></label>
                <input type="number" value={insuranceCost === 0 ? '' : insuranceCost} onChange={e=>setState({insuranceCost: Number(e.target.value) || 0})} className={cn(inputClass, "py-[8px] px-[12px] mt-1")} />
              </div>
              <div>
                <label className="text-[11px] font-[700] text-[#64748B] uppercase">Combustível / Carga <Tip>O total gasto em combustível por ano. Parcialmente dedutível consoante o tipo de viatura.</Tip></label>
                <input type="number" value={fuelCost === 0 ? '' : fuelCost} onChange={e=>setState({fuelCost: Number(e.target.value) || 0})} className={cn(inputClass, "py-[8px] px-[12px] mt-1")} />
              </div>
            </div>
          </div>

          {category === 'passageiros' && (
            <label className="flex items-start gap-4 p-5 border-2 border-[#E2E8F0] rounded-[16px] cursor-pointer transition-colors hover:border-[#CBD5E1]">
              <input type="checkbox" checked={exemptTA} onChange={e=>setState({exemptTA: e.target.checked})} className="mt-1 w-5 h-5 rounded border-[#E2E8F0] text-[#0F172A] focus:ring-[#0F172A]" />
              <div>
                <span className="text-[14px] font-[700] text-[#0F172A] block">Dispensa de TA? <Tip>ISV é o Imposto sobre Veículos (antigo Imposto Automóvel). Certos veículos elétricos ou híbridos podem estar isentos.</Tip></span>
                <span className="text-[12px] text-[#64748B] font-[500] leading-snug mt-1 block">Existe acordo escrito p/ imputação dos custos aos rendimentos do colaborador em sede de IRS.</span>
              </div>
            </label>
          )}
        </div>
      </motion.div>

      {/* Right Pane - Results */}
      <motion.div
        className={rightCls}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.15, ease: [0.32, 0.72, 0, 1] }}
      >
        <div>
          <h1 className="text-[32px] md:text-[40px] font-[800] leading-[1] md:tracking-[-1.5px] mb-[8px] text-[#0F172A]">Resultados Apurados</h1>
          <p className="text-[16px] text-[#64748B] mb-[8px]">Enquadramento da viatura para os exercícios contabilisticos.</p>
        </div>

        <VehicleResults state={initialState} results={results} />
      </motion.div>
    </motion.div>
  )
}
