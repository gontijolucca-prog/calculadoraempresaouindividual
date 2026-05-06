import React, { useMemo } from 'react';
import { Home, CheckCircle, XCircle, AlertTriangle, ArrowRight, Building } from 'lucide-react';
import { cn } from './lib/utils';
import type { ClientProfile } from './ClientProfile';
import { calcIMT } from './lib/imt';
import { useTheme } from './ThemeContext';
import { Tip } from './Tip';

export interface ImoveisState {
  valorImovel: number;
  tipoUso: 'habitacao' | 'comercial' | 'misto';
  temApoiosPT2030: boolean;
  horizonteInvestimento: 'curto' | 'longo';
  precisaLiquidezMensal: boolean;
  precisaReforcoCE: boolean;
  tipoAtividade: 'turismo' | 'agricola' | 'alojamento_local' | 'geral';
}

interface Props {
  initialState: ImoveisState;
  onStateChange: (s: ImoveisState) => void;
  profile: ClientProfile;
}

export default function ImoveisEmpresa({ initialState, onStateChange, profile }: Props) {
  const s = initialState;
  const setState = (u: Partial<ImoveisState>) => onStateChange({ ...s, ...u });

  const isEni = profile.tipoEntidade === 'eni';

  const analise = useMemo(() => {
    if (s.valorImovel <= 0) return null;

    // Imposto de Selo na entrada em espécie
    const impostoSelo = s.valorImovel * 0.008;
    // IMT na entrada em espécie (prédio urbano outros fins)
    const imtResult = calcIMT(s.valorImovel, 'urbano_outros', 'continente', false, 99);
    const escritura = s.valorImovel * 0.007;
    const custoInicialEspecies = impostoSelo + imtResult.imt + escritura;

    // Depreciação anual (taxa 2%/ano para imóveis CIRC Art. 31º)
    const depreciacaoAnual = s.valorImovel * 0.02;

    // Estimativa IRS sobre rendas (escalão médio 28-35%)
    const rendaAnualEstimada = s.valorImovel * 0.04; // yield 4%/ano
    const irsRendas = rendaAnualEstimada * 0.28;

    // Score de recomendação
    let scoreArrendamento = 3;
    let scoreEspecies = 3;

    if (s.horizonteInvestimento === 'curto') { scoreArrendamento += 2; scoreEspecies -= 2; }
    if (s.precisaLiquidezMensal) { scoreArrendamento += 2; scoreEspecies -= 1; }
    if (s.precisaReforcoCE) { scoreArrendamento -= 1; scoreEspecies += 2; }
    if (isEni) { scoreArrendamento -= 1; scoreEspecies -= 1; }
    if (s.tipoAtividade === 'turismo' || s.tipoAtividade === 'alojamento_local') { scoreArrendamento += 1; }
    if (s.valorImovel > 500000) { scoreEspecies += 1; }

    const recomendado: 'arrendamento' | 'especies' | 'nenhum' =
      scoreArrendamento > scoreEspecies ? 'arrendamento' : scoreEspecies > scoreArrendamento ? 'especies' : 'nenhum';

    return {
      impostoSelo,
      imt: imtResult.imt,
      escritura,
      custoInicialEspecies,
      depreciacaoAnual,
      rendaAnualEstimada,
      irsRendas,
      recomendado,
      scoreArrendamento: Math.min(10, Math.max(0, scoreArrendamento)),
      scoreEspecies: Math.min(10, Math.max(0, scoreEspecies)),
    };
  }, [s, isEni]);

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
  const { simMode } = useTheme();
  const outerCls = { split: "overflow-y-auto lg:overflow-hidden lg:h-full lg:grid lg:grid-cols-[380px_1fr] bg-[#F8FAFC] text-[#1E293B]", stacked: "h-full flex flex-col bg-[#F0F4F8] text-[#1E293B] overflow-y-auto", mosaic: "h-full bg-[#F0FDF4] text-[#1E293B] md:grid md:grid-cols-2 gap-4 p-4", compact: "h-full overflow-y-auto bg-white text-[#1E293B]", hero: "h-full flex md:flex-row-reverse overflow-hidden bg-[#F5F5F4] text-[#1E293B]" }[simMode];
  const leftCls = { split: "bg-white border-b border-[#E2E8F0] lg:border-b-0 lg:border-r lg:overflow-y-auto p-4 sm:p-5 lg:p-[28px] flex flex-col gap-4 lg:gap-[22px] lg:h-full", stacked: "bg-white border-b-2 border-[#E2E8F0] p-6 flex flex-col gap-5", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pb-0 w-full", hero: "md:w-[400px] shrink-0 bg-white border-l border-[#E2E8F0] overflow-y-auto p-6 flex flex-col gap-5 h-full" }[simMode];
  const rightCls = { split: "p-4 sm:p-5 lg:p-[28px] lg:overflow-y-auto lg:h-full flex flex-col gap-4 lg:gap-[16px]", stacked: "p-6 flex flex-col gap-4 max-w-7xl mx-auto w-full", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-4 h-full", compact: "max-w-xl mx-auto p-4 pt-2 w-full border-t border-slate-100", hero: "flex-1 overflow-y-auto p-6 flex flex-col gap-4" }[simMode];

  const inputCls = "w-full px-[14px] py-[11px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelCls = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[6px]";

  const pros_arrendamento = [
    'Sem custos iniciais de transmissão',
    'Liquidez mensal imediata (rendas)',
    'Flexibilidade — pode vender quando quiser',
    'Rendas como gastos dedutíveis da empresa (se comodato)',
    'Menor complexidade fiscal',
  ];
  const contras_arrendamento = [
    'IRS sobre rendas (Cat. F) — até 28-35%',
    'Sem reforço dos capitais próprios da empresa',
    'Incerteza de renovação do contrato',
  ];
  const pros_especies = [
    'Reforço imediato dos capitais próprios da empresa',
    `Depreciação fiscal (${ptEur(analise?.depreciacaoAnual ?? 0)}/ano) — CIRC Art. 31º`,
    'Imóvel protegido de credores pessoais do sócio',
    'Possibilidade de venda posterior com isenção de SIFIDE',
    'Pode ser usado como garantia bancária',
  ];
  const contras_especies = [
    `Custos iniciais: ${ptEur(analise?.custoInicialEspecies ?? 0)} (IMT + IS + escritura)`,
    'Menor flexibilidade — saída mais complexa',
    isEni ? 'ENI: tratamento fiscal mais complexo' : 'Tributação de mais-valias à saída',
    'Obrigatoriedade de avaliação fiscal',
  ];

  return (
    <div className={outerCls}>
      {/* Left Pane */}
      <div className={leftCls}>
        <div>
          <h2 className="text-[22px] font-[800] tracking-[-0.5px] text-[#0F172A]">Imóveis na Empresa</h2>
          <p className="text-[13px] text-[#64748B] font-[500] mt-[4px]">Arrendamento/Comodato vs. Entrada em Espécie — guia de decisão.</p>
        </div>

        <div className="space-y-[18px]">
          <div>
            <label className={labelCls}>Valor do Imóvel (€) <Tip>O valor atual do imóvel em euros. Serve para estimar o IMT, Imposto de Selo e o impacto no balanço da empresa.</Tip></label>
            <input
              type="number"
              min="0"
              step="5000"
              value={s.valorImovel === 0 ? '' : s.valorImovel}
              onChange={e => setState({ valorImovel: parseFloat(e.target.value) || 0 })}
              className={inputCls}
              placeholder="ex: 250000"
            />
          </div>

          <div>
            <label className={labelCls}>Tipo de Uso <Tip>Para que vai ser usado o imóvel: habitação (para arrendar como casa), comercial (escritórios, lojas) ou misto (parte habitação, parte comercial).</Tip></label>
            <select value={s.tipoUso} onChange={e => setState({ tipoUso: e.target.value as ImoveisState['tipoUso'] })} className={inputCls}>
              <option value="comercial">Comercial / Escritório</option>
              <option value="habitacao">Habitação</option>
              <option value="misto">Uso Misto</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Horizonte de Investimento <Tip>Quanto tempo prevê manter este imóvel: curto prazo (menos de 5 anos) ou longo prazo (mais de 5 anos). Afeta a decisão fiscal.</Tip></label>
            <select value={s.horizonteInvestimento} onChange={e => setState({ horizonteInvestimento: e.target.value as ImoveisState['horizonteInvestimento'] })} className={inputCls}>
              <option value="curto">Curto prazo (&lt;5 anos)</option>
              <option value="longo">Longo prazo (&gt;5 anos)</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Setor de Atividade <Tip>O setor principal da empresa. Afeta o tratamento fiscal do imóvel (ex: turismo tem regras específicas para imóveis).</Tip></label>
            <select value={s.tipoAtividade} onChange={e => setState({ tipoAtividade: e.target.value as ImoveisState['tipoAtividade'] })} className={inputCls}>
              <option value="geral">Geral / Serviços</option>
              <option value="turismo">Turismo</option>
              <option value="alojamento_local">Alojamento Local</option>
              <option value="agricola">Agrícola / Rural</option>
            </select>
          </div>

          {[
            { key: 'precisaLiquidezMensal', label: 'Precisa de liquidez mensal das rendas', tip: 'Se precisa de receber rendas mensalmente para cobrir despesas pessoais ou da empresa. Influencia a opção de arrendamento vs. entrada em espécie.' },
            { key: 'precisaReforcoCE', label: 'Quer reforçar os capitais próprios da empresa', tip: 'Se o objetivo é melhorar o balanço da empresa (aumentar o capital próprio). A entrada em espécie do imóvel reforça o capital próprio.' },
            { key: 'temApoiosPT2030', label: 'A empresa tem ou planeia apoios PT2030 (pode condicionar transmissões)', tip: 'Se a empresa beneficia de fundos europeus PT2030. Ter imóvel na empresa pode afetar a elegibilidade a estes apoios.' },
          ].map(({ key, label, tip }) => (
            <label key={key} className={cn(
              "flex items-center gap-3 p-[14px] rounded-[12px] border-2 cursor-pointer transition-colors",
              s[key as keyof ImoveisState] ? "bg-[#0F172A]/5 border-[#0F172A]" : "bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#94A3B8]"
            )}>
              <input type="checkbox" checked={!!s[key as keyof ImoveisState]} onChange={e => setState({ [key]: e.target.checked } as Partial<ImoveisState>)} className="hidden" />
              <div className={cn("w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-colors",
                s[key as keyof ImoveisState] ? "bg-[#0F172A] border-[#0F172A]" : "border-[#E2E8F0]")}>
                {s[key as keyof ImoveisState] && <span className="text-white text-[10px] font-[900]">✓</span>}
              </div>
              <span className="text-[13px] font-[500] text-[#475569]">{label} <Tip>{tip}</Tip></span>
            </label>
          ))}

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-[12px]">
            <div className="text-[11px] font-[600] text-[#64748B]">
              Entidade: <span className="font-[700] text-[#0F172A]">{profile.tipoEntidade.toUpperCase()}</span>
              {isEni && <span className="text-orange-600 ml-2">— ENI: regras específicas</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane */}
      <div className={rightCls}>
        {!analise && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[#94A3B8]">
              <Home className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-[600] text-[15px]">Introduza o valor do imóvel</p>
            </div>
          </div>
        )}

        {analise && (
          <>
            {/* Recomendação */}
            <div className={cn(
              "rounded-[16px] p-[16px] border-2 flex items-center gap-3",
              analise.recomendado === 'arrendamento' ? "bg-blue-50 border-blue-300" :
              analise.recomendado === 'especies' ? "bg-emerald-50 border-emerald-300" : "bg-amber-50 border-amber-300"
            )}>
              <ArrowRight className={cn("w-5 h-5 shrink-0",
                analise.recomendado === 'arrendamento' ? "text-blue-600" :
                analise.recomendado === 'especies' ? "text-emerald-600" : "text-amber-600")} />
              <div>
                <div className={cn("text-[13px] font-[800]",
                  analise.recomendado === 'arrendamento' ? "text-blue-800" :
                  analise.recomendado === 'especies' ? "text-emerald-800" : "text-amber-800")}>
                  {analise.recomendado === 'arrendamento' ? 'Recomendado: Arrendamento / Comodato' :
                   analise.recomendado === 'especies' ? 'Recomendado: Entrada em Espécie' : 'Análise neutra — consulte o contabilista'}
                </div>
                <div className="text-[12px] text-[#64748B] mt-1">Com base nas respostas acima</div>
              </div>
            </div>

            {/* Comparação lado a lado */}
            <div className="grid grid-cols-2 gap-[12px]">
              {/* Arrendamento */}
              <div className={cn("bg-white border-2 rounded-[20px] p-[18px]",
                analise.recomendado === 'arrendamento' ? "border-blue-300" : "border-[#E2E8F0]")}>
                <div className="flex items-center gap-2 mb-[14px]">
                  <div className="w-7 h-7 bg-blue-100 rounded-[8px] flex items-center justify-center">
                    <Home className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-[13px] font-[800] text-[#0F172A]">Arrendamento / Comodato</span>
                  {analise.recomendado === 'arrendamento' && (
                    <span className="ml-auto text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-[700]">✓ Recomendado</span>
                  )}
                </div>
                <div className="space-y-[6px] text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Custo inicial</span>
                    <span className="font-[700] text-emerald-700">0 €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Renda anual est.</span>
                    <span className="font-[700]">{ptEur(analise.rendaAnualEstimada)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">IRS/IRC sobre rendas</span>
                    <span className="font-[700] text-red-600">~ {ptEur(analise.irsRendas)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Reforço balanço</span>
                    <span className="font-[700] text-[#94A3B8]">Não</span>
                  </div>
                </div>
                <div className="mt-[12px] space-y-[5px]">
                  {pros_arrendamento.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-[2px]" />
                      <span className="text-[11px] text-[#475569]">{p}</span>
                    </div>
                  ))}
                  {contras_arrendamento.map((c, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-[2px]" />
                      <span className="text-[11px] text-[#94A3B8]">{c}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Entrada em Espécie */}
              <div className={cn("bg-white border-2 rounded-[20px] p-[18px]",
                analise.recomendado === 'especies' ? "border-emerald-300" : "border-[#E2E8F0]")}>
                <div className="flex items-center gap-2 mb-[14px]">
                  <div className="w-7 h-7 bg-emerald-100 rounded-[8px] flex items-center justify-center">
                    <Building className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-[13px] font-[800] text-[#0F172A]">Entrada em Espécie</span>
                  {analise.recomendado === 'especies' && (
                    <span className="ml-auto text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-[700]">✓ Recomendado</span>
                  )}
                </div>
                <div className="space-y-[6px] text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">IMT estimado</span>
                    <span className="font-[700] text-red-600">{ptEur(analise.imt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Imposto de Selo (0,8%)</span>
                    <span className="font-[700] text-red-600">{ptEur(analise.impostoSelo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Custo inicial total</span>
                    <span className="font-[700] text-red-600">{ptEur(analise.custoInicialEspecies)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Reforço balanço</span>
                    <span className="font-[700] text-emerald-700">{ptEur(s.valorImovel)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Depreciação fiscal/ano</span>
                    <span className="font-[700] text-emerald-700">{ptEur(analise.depreciacaoAnual)}</span>
                  </div>
                </div>
                <div className="mt-[12px] space-y-[5px]">
                  {pros_especies.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-[2px]" />
                      <span className="text-[11px] text-[#475569]">{p}</span>
                    </div>
                  ))}
                  {contras_especies.map((c, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-[2px]" />
                      <span className="text-[11px] text-[#94A3B8]">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alertas PT2030 */}
            {s.temApoiosPT2030 && (
              <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-[14px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-[2px] shrink-0" />
                <p className="text-[13px] text-amber-800 font-[500]">
                  Com apoios PT2030 ativos, a entrada em espécie pode estar sujeita a restrições de transmissão patrimonial. Confirme com o gestor do apoio antes de avançar.
                </p>
              </div>
            )}

            {/* Pontos a validar */}
            <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[20px]">
              <h3 className="text-[13px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[12px]">Pontos a Validar Antes de Decidir</h3>
              <div className="space-y-[6px]">
                {[
                  'Avaliação fiscal do imóvel (VPT) — se diferir do valor de mercado, o IMT incide sobre o maior',
                  'Impacto na IMI se o imóvel mudar de titular (reavaliação possível)',
                  'Existência de hipoteca ou ónus — validar viabilidade de transmissão',
                  'Implicações no pacto social da empresa (necessita de deliberação dos sócios)',
                  'Regime IVA da operação (imóveis usados geralmente isentos de IVA)',
                  isEni ? 'ENI: afetação parcial do imóvel à atividade — regras de separação patrimonial' : 'Responsabilidade limitada da empresa protege o imóvel de dívidas pessoais',
                ].map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#781D1D] mt-[6px] shrink-0" />
                    <span className="text-[12px] text-[#475569]">{p}</span>
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
