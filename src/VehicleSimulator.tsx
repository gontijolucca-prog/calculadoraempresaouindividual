import React, { useState, useMemo } from 'react';
import { Car, Euro, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from './lib/utils';

export default function VehicleSimulator() {
  const [category, setCategory] = useState<'comercial'|'passageiros'>('passageiros');
  const [engineType, setEngineType] = useState('diesel');
  const [price, setPrice] = useState(35000);
  const [ivaRegime, setIvaRegime] = useState('normal');
  const [activity, setActivity] = useState('other');
  const [maintenanceCost, setMaintenanceCost] = useState(1000);
  const [insuranceCost, setInsuranceCost] = useState(800);
  const [fuelCost, setFuelCost] = useState(2500);
  const [exemptTA, setExemptTA] = useState(false);
  const [phevCompliant, setPhevCompliant] = useState(true);

  const results = useMemo(() => {
    // Gastos base S/ IVA (aproximação - assumindo inputs limpos)
    const maintBase = maintenanceCost / 1.23;
    const maintIva = maintenanceCost - maintBase;
    
    // ATENÇÃO: Seguro em Portugal não tem IVA, está sujeito a Imposto do Selo. Logo IVA recuperável do seguro é sempre 0.
    const insIva = 0; 

    const fuelBase = fuelCost / 1.23;
    const fuelIva = fuelCost - fuelBase;

    const isExemptActivity = ['public_transport', 'rent_a_car', 'driving_school'].includes(activity);

    // -- IVA na aquisição --
    let ivaAquisicaoDedRate = 0;
    const totalIvaAquisicao = price * 0.23;

    if (ivaRegime === 'normal') {
      if (isExemptActivity) {
        ivaAquisicaoDedRate = 1;
      } else if (category === 'passageiros') {
        if (engineType === 'electric') ivaAquisicaoDedRate = price <= 62500 ? 1 : 0;
        else if (engineType === 'phev' && phevCompliant) ivaAquisicaoDedRate = price <= 50000 ? 1 : 0;
        else if (['lpg', 'cng'].includes(engineType)) ivaAquisicaoDedRate = price <= 37500 ? 0.5 : 0;
        // gasóleo, gasolina, híbrido convencional = 0% de dedução (nunca há lugar a dedução num passageiros ICE)
      } else if (category === 'comercial') {
        if (['electric', 'phev', 'lpg', 'cng'].includes(engineType)) ivaAquisicaoDedRate = 1;
        else if (engineType === 'diesel') ivaAquisicaoDedRate = 0.5;
        // comercial a gasolina = 0% dedução, por regra geral sem justificação extra
      }
    }
    const ivaAquisicaoDedutivel = totalIvaAquisicao * ivaAquisicaoDedRate;

    // -- IVA Manutenção --
    let maintIvaDedRate = 0;
    if (isExemptActivity || category === 'comercial') {
      maintIvaDedRate = 1; // Comerciais podem deduzir reparações
    }
    const ivaRecupManutencao = maintIva * maintIvaDedRate;

    // -- IVA Combustível --
    let fuelIvaDedRate = 0;
    if (isExemptActivity || (activity === 'goods' && category === 'comercial')) {
      fuelIvaDedRate = 1;
    } else {
      if (engineType === 'electric') fuelIvaDedRate = 1;
      else if (['diesel', 'lpg', 'cng'].includes(engineType)) fuelIvaDedRate = 0.5;
      else if (engineType === 'phev') fuelIvaDedRate = 0; // A fatura comum é de gasolina, logo 0%. Eletricidade seria 100%, assumimos gasolina na bomba para piores cenários.
      // gasolina, híbrido = 0%
    }
    const ivaRecupCombustivel = fuelIva * fuelIvaDedRate;

    const ivaTotalDedutivel = ivaAquisicaoDedutivel + ivaRecupManutencao + ivaRecupCombustivel;

    // -- Limites de Depreciação e Amortizações (IRC) --
    let limit = 25000; // Base para Gasolina/Gasóleo/MHEV
    let phevValid = engineType === 'phev' && phevCompliant;

    if (engineType === 'electric') limit = 62500;
    else if (phevValid) limit = 50000;
    else if (['lpg', 'cng'].includes(engineType)) limit = 37500;

    if (isExemptActivity) limit = Infinity; // Não há limites para táxis / rent-a-car

    const depAnualTotal = price * 0.25; // 25% de depreciação ao ano c/ taxa normal legal
    const depAceite = limit === Infinity ? depAnualTotal : Math.min(price, limit) * 0.25;
    const depNaoAceite = Math.max(0, depAnualTotal - depAceite);

    // -- Tributação Autónoma (IRC) Baseada no OE mais recente (A partir de 2024 até 2026) --
    let taRate = 0;
    let taValue = 0;
    
    // A base da TA incide sobre todos os encargos dedutíveis e NÃO dedutíveis (isto é, custo total assumido pela empresa + depreciação contabilística inteira).
    const maintCustoFinal = maintenanceCost - ivaRecupManutencao;
    const insCustoFinal = insuranceCost; // Sem IVA descontado
    const fuelCustoFinal = fuelCost - ivaRecupCombustivel;
    const totalEncsTA = depAnualTotal + maintCustoFinal + insCustoFinal + fuelCustoFinal;

    if (category === 'passageiros') {
      if (exemptTA) {
         taRate = 0;
      } else {
         if (engineType === 'electric') {
           taRate = price >= 62500 ? 0.10 : 0; // REGRAS REAIS PORTUGAL: 10% para Eletricos > 62.5k
         } else if (phevValid) {
           taRate = price < 27500 ? 0.025 : (price < 35000 ? 0.075 : 0.15); // Escalões OE Alterados
         } else {
           taRate = price < 27500 ? 0.085 : (price < 35000 ? 0.255 : 0.325); // Escalões OE Alterados
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

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  const inputClass = "w-full pl-[16px] pr-[16px] py-[12px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[15px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelClass = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[8px]";

  return (
    <div className="h-full flex flex-col md:grid md:grid-cols-[400px_1fr] bg-[#F8FAFC] text-[#1E293B]">
       {/* Left Pane - Form */}
       <div className="bg-white border-r border-[#E2E8F0] overflow-y-auto p-6 md:p-[40px] flex flex-col gap-[32px] h-full">
          <div>
            <h2 className="text-[24px] font-[800] tracking-[-0.5px] text-[#0F172A]">Simulador Viaturas</h2>
            <p className="text-[14px] text-[#64748B] font-[500] mt-[4px]">Cálculo IVA e Tributação Autónoma.</p>
          </div>

          <div className="space-y-[24px]">
            <div>
              <label className={labelClass}>Categoria do Veículo</label>
              <select value={category} onChange={e=>setCategory(e.target.value as any)} className={inputClass}>
                <option value="passageiros">Ligeiro de Passageiros</option>
                <option value="comercial">Comercial (2/3 lugares)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Motor / Combustível</label>
              <select value={engineType} onChange={e=>setEngineType(e.target.value)} className={inputClass}>
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
                  <input type="checkbox" checked={phevCompliant} onChange={e=>setPhevCompliant(e.target.checked)} className="mt-[2px] accent-amber-600" />
                  <span className="text-[12px] font-[500] leading-tight">Autonomia elétrica é ≥50 km e emissões são &lt;50 gCO₂/km.</span>
                </label>
              )}
            </div>

            <div>
              <label className={labelClass}>Custo Aquisição (Base s/ IVA)</label>
              <div className="relative">
                <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <input type="number" value={price} onChange={e=>setPrice(Number(e.target.value))} className={cn(inputClass, "pl-[40px]")} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Regime Fiscal da Aquisição</label>
              <select value={ivaRegime} onChange={e=>setIvaRegime(e.target.value)} className={inputClass}>
                <option value="normal">Compra Nova (Fatura c/ IVA)</option>
                <option value="second_hand">Regime Bens em 2ª Mão</option>
                <option value="leasing">Locação / Leasing / Renting</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Serviço ou Atividade Associada</label>
              <select value={activity} onChange={e=>setActivity(e.target.value as any)} className={inputClass}>
                <option value="other">Geral / Serviços / Comércio</option>
                {category === 'comercial' && <option value="goods">Transporte Mercadorias (Alvará)</option>}
                <option value="public_transport">Transporte Público / Táxi / TVDE</option>
                <option value="rent_a_car">Rent-a-car / Comércio Automóvel</option>
                <option value="driving_school">Escola de Condução</option>
              </select>
            </div>

            <div className="p-5 border-2 border-[#E2E8F0] rounded-[16px] bg-[#F8FAFC]">
              <h3 className="text-[12px] font-[800] text-[#0F172A] mb-4">ENCARGOS ANUAIS (COM IVA)</h3>
              <div className="space-y-[16px]">
                <div>
                  <label className="text-[11px] font-[700] text-[#64748B] uppercase">Manutenção & Oficinas</label>
                  <input type="number" value={maintenanceCost} onChange={e=>setMaintenanceCost(Number(e.target.value))} className={cn(inputClass, "py-[8px] px-[12px] mt-1")} />
                </div>
                <div>
                  <label className="text-[11px] font-[700] text-[#64748B] uppercase">Seguro & Portagens</label>
                  <input type="number" value={insuranceCost} onChange={e=>setInsuranceCost(Number(e.target.value))} className={cn(inputClass, "py-[8px] px-[12px] mt-1")} />
                </div>
                <div>
                  <label className="text-[11px] font-[700] text-[#64748B] uppercase">Combustível / Carga</label>
                  <input type="number" value={fuelCost} onChange={e=>setFuelCost(Number(e.target.value))} className={cn(inputClass, "py-[8px] px-[12px] mt-1")} />
                </div>
              </div>
            </div>

            {category === 'passageiros' && (
              <label className="flex items-start gap-4 p-5 border-2 border-[#E2E8F0] rounded-[16px] cursor-pointer transition-colors hover:border-[#CBD5E1]">
                <input type="checkbox" checked={exemptTA} onChange={e=>setExemptTA(e.target.checked)} className="mt-1 w-5 h-5 rounded border-[#E2E8F0] text-[#0F172A] focus:ring-[#0F172A]" />
                <div>
                  <span className="text-[14px] font-[700] text-[#0F172A] block">Dispensa de TA?</span>
                  <span className="text-[12px] text-[#64748B] font-[500] leading-snug mt-1 block">Existe acordo escrito p/ imputação dos custos aos rendimentos do colaborador em sede de IRS.</span>
                </div>
              </label>
            )}
          </div>
       </div>

       {/* Right Pane - Results */}
       <div className="p-6 md:p-[40px] overflow-y-auto h-full max-w-7xl mx-auto w-full flex flex-col gap-[32px]">
          <div>
            <h1 className="text-[32px] md:text-[40px] font-[800] leading-[1] md:tracking-[-1.5px] mb-[8px] text-[#0F172A]">Resultados Apurados</h1>
            <p className="text-[16px] text-[#64748B] mb-[8px]">Enquadramento da viatura para os exercícios contabilisticos.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-[24px]">

            {/* IVA Deductions */}
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm">
               <div className="flex items-center gap-[16px] mb-[24px]">
                  <div className="bg-[#ECFDF5] text-[#10B981] p-[12px] rounded-[16px]">
                    <ShieldCheck className="w-[24px] h-[24px]" />
                  </div>
                  <h3 className="text-[18px] font-[700] text-[#0F172A]">IVA Recupérável Anual</h3>
               </div>
               
               <div className="text-[48px] md:text-[56px] font-[800] text-[#10B981] tracking-[-2px] mb-[32px]">
                 {ptEur(results.ivaTotalDedutivel)}
               </div>

               <div className="flex-1 space-y-0">
                 <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                   <span className="text-[#64748B] font-[600]">IVA Aquisição (Dedutível)</span>
                   <span className="font-[700] font-mono text-[#0F172A]">{ptEur(results.ivaAquisicaoDedutivel)}</span>
                 </div>
                 <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                   <span className="text-[#64748B] font-[600]">IVA Operação (Manutenção)</span>
                   <span className="font-[700] font-mono text-[#0F172A]">{ptEur(results.ivaRecupManutencao)}</span>
                 </div>
                 <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                   <span className="text-[#64748B] font-[600]">IVA Op. (Combustível/Energia)</span>
                   <span className="font-[700] font-mono text-[#0F172A]">{ptEur(results.ivaRecupCombustivel)}</span>
                 </div>
               </div>

               <div className="mt-[32px] p-[16px] bg-[#F8FAFC] rounded-[12px] text-[12px] text-[#64748B] font-[500] leading-relaxed">
                 Nota: O Seguro Automóvel em Portugal está enables isento de IVA (sujeito apenas a Imposto de Selo), logo a margem de recuperação dessa despesa é 0€ por natureza de imposto.
               </div>
            </div>

            {/* Tributacao Autonoma */}
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm relative">
               <div className="flex items-center gap-[16px] mb-[24px]">
                  <div className="bg-[#FEF2F2] text-[#EF4444] p-[12px] rounded-[16px]">
                    <AlertTriangle className="w-[24px] h-[24px]" />
                  </div>
                  <h3 className="text-[18px] font-[700] text-[#0F172A]">Tributação Autónoma a Pagar</h3>
               </div>
               
               <div className="text-[48px] md:text-[56px] font-[800] text-[#EF4444] tracking-[-2px] mb-[12px]">
                 {ptEur(results.taValue)}
               </div>
               <div className="mb-[24px]">
                 <span className="inline-flex items-center px-[12px] py-[6px] bg-[#FEF2F2] text-[#B91C1C] text-[12px] font-[800] uppercase tracking-[1px] rounded-full">
                    Taxa Aplicada: {(results.taRate * 100).toFixed(1)}% IRC
                 </span>
               </div>

               {results.isElecTaxed && (
                  <div className="mb-[20px] p-[12px] bg-sky-50 border border-sky-200 text-sky-800 rounded-[8px] text-[12px] font-[500] leading-snug">
                     <strong>Atenção à Lei nº 82/2023:</strong> Contrário à ideia de isenção total, viaturas 100% elétricas com custo superior a 62.500€ encontram-se sujeitas a Tributação Autónoma de 10% (Artº 88º do CIRC). Modifique o preço base do carro para confirmar a isenção!
                  </div>
               )}

               {category === 'passageiros' ? (
                 <div className="flex-1 space-y-0">
                   <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                     <span className="text-[#64748B] font-[600]">Lmt. Depreciação (Fiscal)</span>
                     <span className="font-[700] font-mono text-[#0F172A]">{results.limit === Infinity ? 'Ilimitado' : ptEur(results.limit)}</span>
                   </div>
                   <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                     <span className="text-[#64748B] font-[600]">Depreciação Não Aceite</span>
                     <span className="font-[700] font-mono text-[#0F172A]">{ptEur(results.depNaoAceite)}</span>
                   </div>
                   <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                     <span className="text-[#64748B] font-[600]">Encargos Sujeitos a TA</span>
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
       </div>
    </div>
  )
}
