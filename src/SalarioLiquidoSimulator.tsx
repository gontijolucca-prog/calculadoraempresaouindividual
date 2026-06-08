import { motion } from 'motion/react';
import React, { useMemo } from 'react';
import { Banknote, User, ChevronDown, ShieldCheck, Euro } from 'lucide-react';
import { cn } from './lib/utils';
import { calcSalarioLiquido, type EstadoCivil, type SalarioParams } from './lib/salario';
import { useTheme } from './ThemeContext';
import { Tip } from './Tip';
import { FlowWizard, type FlowStep } from './FlowWizard';
import { useFlowMode } from './AnimatedPage';

export interface SalarioState {
  salarioBruto: number;
  estadoCivil: EstadoCivil;
  nrDependentes: number;
  localizacao: 'continente' | 'madeira' | 'acores';
  duodecimos: boolean;
  subsidioAlimentacaoDiario: number;
  tipoSubsidio: 'dinheiro' | 'cartao';
  diasSubsidio: number;
  irsJovem: boolean;
  anosAtividade: number;
  idade: number;
  taxaSeguroTrabalho: number;
}

interface Props {
  initialState: SalarioState;
  onStateChange: (s: SalarioState) => void;
}

export default function SalarioLiquidoSimulator({ initialState, onStateChange }: Props) {
  const s = initialState;
  const setState = (u: Partial<SalarioState>) => onStateChange({ ...s, ...u });
  const { simMode } = useTheme();
  const { flowMode, exitFlow } = useFlowMode();
  const outerCls = { split: "overflow-y-auto lg:overflow-hidden lg:h-full lg:grid lg:grid-cols-[400px_1fr] bg-[#F5F7FA] text-[#1E293B]", stacked: "h-full flex flex-col bg-[#F0F4F8] text-[#1E293B] overflow-y-auto", mosaic: "h-full bg-[#F0FDF4] text-[#1E293B] md:grid md:grid-cols-2 gap-4 p-4", compact: "h-full overflow-y-auto bg-white text-[#1E293B]", hero: "h-full flex md:flex-row-reverse overflow-hidden bg-[#F5F5F4] text-[#1E293B]" }[simMode];
  const leftCls = { split: "bg-white border-b border-[#E2E8F0] lg:border-b-0 lg:border-r lg:overflow-y-auto p-4 sm:p-5 lg:p-[28px] flex flex-col gap-4 lg:gap-[22px] lg:h-full", stacked: "bg-white border-b-2 border-[#E2E8F0] p-6 flex flex-col gap-5", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pb-0 w-full", hero: "md:w-[420px] shrink-0 bg-white border-l border-[#E2E8F0] overflow-y-auto p-6 flex flex-col gap-5 h-full" }[simMode];
  const rightCls = { split: "p-4 sm:p-5 lg:p-[28px] lg:overflow-y-auto lg:h-full flex flex-col gap-4 lg:gap-[16px]", stacked: "p-6 flex flex-col gap-4 max-w-7xl mx-auto w-full", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-4 h-full", compact: "max-w-xl mx-auto p-4 pt-2 w-full border-t border-slate-100", hero: "flex-1 overflow-y-auto p-6 flex flex-col gap-4" }[simMode];

  const result = useMemo(() => {
    if (s.salarioBruto <= 0) return null;
    const params: SalarioParams = {
      salarioBruto: s.salarioBruto,
      estadoCivil: s.estadoCivil,
      nrDependentes: s.nrDependentes,
      localizacao: s.localizacao,
      duodecimos: s.duodecimos,
      subsidioAlimentacaoDiario: s.subsidioAlimentacaoDiario,
      tipoSubsidio: s.tipoSubsidio,
      diasSubsidio: s.diasSubsidio,
      irsJovem: s.irsJovem,
      anosAtividade: s.anosAtividade,
      idade: s.idade,
      taxaSeguroTrabalho: (s.taxaSeguroTrabalho || 0) / 100,
    };
    return calcSalarioLiquido(params);
  }, [s]);

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
  const pctOf = (part: number, total: number) => total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '—';

  const inputCls = "w-full px-[14px] py-[11px] bg-[#F5F7FA] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelCls = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[6px]";

  const steps: FlowStep<SalarioState>[] = [
    {
      id: 'salarioBruto',
      label: 'Salário Bruto e Estado Civil',
      description: 'Indique o salário bruto mensal e o estado civil. O líquido apresentado é uma estimativa anualizada da retenção de IRS — o valor mensal exato segue a tabela oficial e acerta-se no IRS anual.',
      render: (state, setSt) => (
        <div className="space-y-[18px]">
          <div>
            <label className={labelCls}>Salário Bruto Mensal (€) <Tip>O salário antes de descontos (SS e IRS). É o valor que consta no contrato de trabalho.</Tip></label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input
                type="number"
                min="920"
                step="50"
                value={state.salarioBruto === 0 ? '' : state.salarioBruto}
                onChange={e => setSt({ salarioBruto: parseFloat(e.target.value) || 0 })}
                className={cn(inputCls, "pl-9")}
                placeholder="ex: 2000"
              />
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1">SMN 2026: €920/mês</p>
          </div>

          <div>
            <label className={labelCls}>Estado Civil <Tip>Casado com um titular de rendimentos beneficia do quociente conjugal (retenção mais baixa); casado com dois titulares ou solteiro retêm sobre o próprio rendimento. Estimativa anualizada — o valor exato segue a tabela mensal oficial e acerta-se no IRS anual.</Tip></label>
            <select value={state.estadoCivil} onChange={e => setSt({ estadoCivil: e.target.value as EstadoCivil })} className={inputCls}>
              <option value="solteiro">Solteiro / Não casado</option>
              <option value="casado_1titular">Casado — 1 titular</option>
              <option value="casado_2titulares">Casado — 2 titulares</option>
            </select>
          </div>
        </div>
      ),
    },
    {
      id: 'nrDependentes',
      label: 'Dependentes e Localização',
      description: 'Indique quantos dependentes tem e a sua localização geográfica para efeitos de IRS.',
      render: (state, setSt) => (
        <div className="space-y-[18px]">
          <div>
            <label className={labelCls}>Nº de Dependentes <Tip>Número de filhos ou pessoas dependentes a cargo. Cada dependente reduz a retenção de IRS.</Tip></label>
            <input
              type="number"
              min="0"
              max="20"
              value={state.nrDependentes === 0 ? '' : state.nrDependentes}
              onChange={e => setSt({ nrDependentes: parseInt(e.target.value) || 0 })}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Localização <Tip>Continente, Açores ou Madeira. Nas regiões autónomas a retenção de IRS é mais baixa — já refletida no líquido mensal apresentado.</Tip></label>
            <select value={state.localizacao} onChange={e => setSt({ localizacao: e.target.value as SalarioState['localizacao'] })} className={inputCls}>
              <option value="continente">Continente</option>
              <option value="madeira">Madeira</option>
              <option value="acores">Açores</option>
            </select>
          </div>
        </div>
      ),
    },
    {
      id: 'duodecimos',
      label: 'Subsídios',
      description: 'Configure os subsídios de alimentação e se recebe duodécimos.',
      render: (state, setSt) => (
        <div className="space-y-[18px]">
          <label className={cn(
            "flex items-center gap-3 p-[14px] rounded-[12px] border-2 cursor-pointer transition-colors",
            state.duodecimos ? "bg-[#0F172A]/5 border-[#0F172A]" : "bg-[#F5F7FA] border-[#E2E8F0] hover:border-[#94A3B8]"
          )}>
            <input type="checkbox" checked={state.duodecimos} onChange={e => setSt({ duodecimos: e.target.checked })} className="hidden" />
            <div className={cn("w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0",
              state.duodecimos ? "bg-[#0F172A] border-[#0F172A]" : "border-[#E2E8F0]")}>
              {state.duodecimos && <span className="text-white text-[10px] font-[900]">✓</span>}
            </div>
            <div>
              <span className="text-[13px] font-[600] text-[#475569]">Duodécimos <Tip>Se os subsídios de Natal e Férias são pagos distribuídos pelos 12 meses (duodécimos) ou em 2 pagamentos anuais. Afeta a retenção mensal.</Tip></span>
              <p className="text-[11px] text-[#94A3B8]">Subsídios distribuídos mensalmente (14 pagamentos → 12)</p>
            </div>
          </label>

          <div className="space-y-[10px]">
            <div className="text-[12px] font-[700] uppercase tracking-[1px] text-[#64748B]">Subsídio de Alimentação</div>
            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label className={labelCls}>Valor Diário (€) <Tip>O valor diário pago por cada dia de trabalho como subsídio de refeição. Até €6,15/dia em dinheiro está isento de IRS e SS.</Tip></label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.01"
                  value={state.subsidioAlimentacaoDiario === 0 ? '' : state.subsidioAlimentacaoDiario}
                  onChange={e => setSt({ subsidioAlimentacaoDiario: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                  placeholder="ex: 6.15"
                />
                {state.subsidioAlimentacaoDiario > 15 && (
                  <p className="text-[11px] text-amber-700 font-[600] mt-1">
                    Valor invulgarmente elevado — confirmar (limite isento mais alto: €10,46/dia em cartão).
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Dias/mês <Tip>Número de dias úteis por mês em que o subsídio de alimentação é pago. Normalmente 22 dias.</Tip></label>
                <input
                  type="number"
                  min="0"
                  max="31"
                  value={state.diasSubsidio === 0 ? '' : state.diasSubsidio}
                  onChange={e => setSt({ diasSubsidio: parseInt(e.target.value) || 0 })}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Tipo de Pagamento <Tip>Subsídio em dinheiro: limite isento €6,15/dia. Em cartão de refeição: limite isento €10,46/dia.</Tip></label>
              <select value={state.tipoSubsidio} onChange={e => setSt({ tipoSubsidio: e.target.value as SalarioState['tipoSubsidio'] })} className={inputCls}>
                <option value="cartao">Cartão eletrónico — limite €10,46/dia</option>
                <option value="dinheiro">Dinheiro / transferência — limite €6,15/dia</option>
              </select>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'irsJovem',
      label: 'Outros',
      description: 'Configure o seguro de acidentes de trabalho e a elegibilidade para IRS Jovem.',
      render: (state, setSt) => (
        <div className="space-y-[18px]">
          <div>
            <label className={labelCls}>Seguro Acidentes de Trabalho (%) <Tip>Taxa do seguro obrigatório (Lei 98/2009). Varia por atividade e risco — ~1% é um valor médio de referência.</Tip></label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={state.taxaSeguroTrabalho === 0 ? '' : state.taxaSeguroTrabalho}
              onChange={e => setSt({ taxaSeguroTrabalho: parseFloat(e.target.value) || 0 })}
              className={inputCls}
              placeholder="ex: 1.0"
            />
            <p className="text-[11px] text-[#94A3B8] mt-1">Obrigatório por lei. Média: 1% do salário bruto.</p>
          </div>

          <label className={cn(
            "flex items-center gap-3 p-[14px] rounded-[12px] border-2 cursor-pointer transition-colors",
            state.irsJovem && state.idade <= 35 ? "bg-emerald-50 border-emerald-300" : "bg-[#F5F7FA] border-[#E2E8F0] hover:border-[#94A3B8]"
          )}>
            <input type="checkbox" checked={state.irsJovem} onChange={e => setSt({ irsJovem: e.target.checked })} className="hidden" />
            <div className={cn("w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0",
              state.irsJovem ? "bg-emerald-600 border-emerald-600" : "border-[#E2E8F0]")}>
              {state.irsJovem && <span className="text-white text-[10px] font-[900]">✓</span>}
            </div>
            <span className="text-[13px] font-[600] text-[#475569]">IRS Jovem (≤35 anos) <Tip>Isenção parcial de IRS para jovens até 35 anos nos primeiros anos de trabalho. Reduz significativamente o imposto retido.</Tip></span>
          </label>

          {state.irsJovem && (
            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label className={labelCls}>Idade <Tip>A sua idade. Determina a elegibilidade para IRS Jovem (até 35 anos).</Tip></label>
                <input type="number" min="18" max="35" value={state.idade === 0 ? '' : state.idade} onChange={e => setSt({ idade: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Anos de atividade <Tip>Há quantos anos está a trabalhar. O benefício de IRS Jovem varia conforme o número de anos de atividade.</Tip></label>
                <input type="number" min="0" max="5" value={state.anosAtividade === 0 ? '' : state.anosAtividade} onChange={e => setSt({ anosAtividade: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
            </div>
          )}
        </div>
      ),
    },
  ];

  const resultsContent = (
    <>
      {!result && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[#94A3B8]">
            <Banknote className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-[600] text-[15px]">Introduza o salário bruto mensal</p>
          </div>
        </div>
      )}

      {result && (
        <>
          {/* Hero card — salário líquido */}
          <div className="bg-[#0F172A] text-white rounded-[20px] p-[24px]">
            <div className="text-[12px] font-[700] uppercase tracking-[1px] text-slate-400">Salário Líquido Mensal</div>
            <div className="text-[48px] font-[900] leading-none mt-2 text-white">{ptEur(result.salarioLiquido)}</div>
            {result.subsidioAlimentacaoIsento > 0 && (
              <div className="text-[13px] text-emerald-400 font-[600] mt-2">
                + {ptEur(result.subsidioAlimentacaoIsento)} subsídio de alimentação (isento)
              </div>
            )}
            <div className="text-[12px] text-slate-400 mt-1">
              {ptEur(result.salarioLiquidoAnual)}/ano · {result.nrPagamentos} meses
            </div>
          </div>

          {/* Breakdown mensal */}
          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[20px]">
            <h3 className="text-[13px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[14px]">Composição Mensal</h3>
            <div className="space-y-[10px]">
              <div className="flex justify-between text-[14px]">
                <span className="text-[#64748B]">Salário Bruto</span>
                <span className="font-[700] text-[#0F172A]">{ptEur(result.salarioBruto)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-[#64748B]">SS Trabalhador (11%)</span>
                <span className="font-[700] text-red-600">- {ptEur(result.ssTrabalhador)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-[#64748B]">Retenção IRS</span>
                <span className="font-[700] text-red-600">- {ptEur(result.retencaoIRS)}</span>
              </div>
              {result.irsJovemIsencao > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-emerald-700 font-[500]">↑ Benefício IRS Jovem (mensal)</span>
                  <span className="font-[700] text-emerald-700">+ {ptEur(result.irsJovemIsencao)}</span>
                </div>
              )}
              {result.subsidioAlimentacaoIsento > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-emerald-700 font-[500]">Subsídio alimentação (isento)</span>
                  <span className="font-[700] text-emerald-700">+ {ptEur(result.subsidioAlimentacaoIsento)}</span>
                </div>
              )}
              <div className="h-px bg-[#E2E8F0] my-1" />
              <div className="flex justify-between text-[15px]">
                <span className="font-[800] text-[#0F172A]">Salário Líquido</span>
                <span className="font-[900] text-[#0F172A]">{ptEur(result.salarioLiquido)}</span>
              </div>
              <div className="text-[11px] text-[#94A3B8]">
                Taxa efetiva de desconto: {pctOf(result.ssTrabalhador + result.retencaoIRS, result.salarioBruto)}
              </div>
              <div className="text-[11px] text-[#94A3B8] leading-snug">
                Retenção estimada pelo método anualizado dos escalões 2026 — não substitui o recibo de vencimento; o IRS final acerta-se na declaração anual.
              </div>
            </div>
          </div>

          {/* Custo empregador */}
          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[20px]">
            <h3 className="text-[13px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[14px]">Custo para o Empregador</h3>
            <div className="space-y-[10px]">
              {/* Custos salariais */}
              <div className="flex justify-between text-[14px]">
                <span className="text-[#64748B]">Salário Bruto</span>
                <span className="font-[700] text-[#0F172A]">{ptEur(result.salarioBruto)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-[#64748B]">SS Patronal (23,75%)</span>
                <span className="font-[700] text-[#0F172A]">+ {ptEur(result.ssPatronal)}</span>
              </div>
              {result.seguroTrabalho > 0 && (
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#64748B]">Seguro Acidentes de Trabalho ({s.taxaSeguroTrabalho}%)</span>
                  <span className="font-[700] text-[#0F172A]">+ {ptEur(result.seguroTrabalho)}</span>
                </div>
              )}
              <div className="h-px bg-[#E2E8F0] my-1" />
              <div className="flex justify-between text-[14px]">
                <span className="font-[700] text-[#0F172A]">Subtotal Custo Salarial</span>
                <span className="font-[800] text-[#0F172A]">{ptEur(result.custoSalarial)}</span>
              </div>

              {/* Subsídio de alimentação (custo real da empresa) */}
              {result.subsidioAlimentacao > 0 && (
                <>
                  <div className="h-px bg-dashed border-t border-dashed border-[#E2E8F0] my-1" />
                  <div className="flex justify-between text-[14px]">
                    <span className="text-[#64748B]">Subsídio de Alimentação (total)</span>
                    <span className="font-[700] text-[#0F172A]">+ {ptEur(result.subsidioAlimentacao)}</span>
                  </div>
                  {result.subsidioAlimentacaoTributavel > 0 && (
                    <div className="flex justify-between text-[13px]">
                      <span className="text-orange-700">Inclui parte tributável (excede limite)</span>
                      <span className="font-[700] text-orange-700">{ptEur(result.subsidioAlimentacaoTributavel)}</span>
                    </div>
                  )}
                </>
              )}

              <div className="h-px bg-[#0F172A] my-1" />
              <div className="flex justify-between text-[15px]">
                <span className="font-[800] text-[#0F172A]">Custo Total Mensal</span>
                <span className="font-[900] text-[#0F172A]">{ptEur(result.custoEmpregadorReal)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-[#64748B]">
                <span>Custo Total Anual ({result.nrPagamentos} meses)</span>
                <span className="font-[700]">{ptEur(result.totalAnual)}</span>
              </div>
              <div className="text-[11px] text-[#94A3B8]">
                Taxa de encargo sobre salário bruto: {pctOf(result.custoEmpregadorReal - result.salarioBruto, result.salarioBruto)}
              </div>
            </div>
          </div>

          {/* Quadro subsídio alimentação */}
          {result.subsidioAlimentacao > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[20px]">
              <h3 className="text-[13px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[14px]">Subsídio de Alimentação</h3>
              <div className="space-y-[8px] text-[14px]">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Total pago</span>
                  <span className="font-[700]">{ptEur(result.subsidioAlimentacao)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Parte isenta</span>
                  <span className="font-[700] text-emerald-700">{ptEur(result.subsidioAlimentacaoIsento)}</span>
                </div>
                {result.subsidioAlimentacaoTributavel > 0 && (
                  <div className="flex justify-between">
                    <span className="text-orange-700">Parte tributável (excede limite)</span>
                    <span className="font-[700] text-orange-700">{ptEur(result.subsidioAlimentacaoTributavel)}</span>
                  </div>
                )}
                <div className="text-[11px] text-[#94A3B8] mt-2">
                  Limites isentos 2026: €10,46/dia (cartão eletrónico) · €6,15/dia (dinheiro) — Despacho 233-A/2026
                </div>
              </div>
            </div>
          )}

          {/* Tabela anual */}
          <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[20px]">
            <h3 className="text-[13px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[14px]">Perspectiva Anual ({result.nrPagamentos} meses)</h3>
            <div className="grid grid-cols-2 gap-[10px]">
              {[
                { label: 'Bruto anual', value: result.salarioBruto * result.nrPagamentos, red: false },
                { label: 'SS anual', value: result.ssTrabalhador * result.nrPagamentos, red: true },
                { label: 'IRS retido anual', value: result.retencaoIRS * result.nrPagamentos, red: true },
                { label: 'Líquido anual', value: result.salarioLiquidoAnual, red: false },
              ].map(({ label, value, red }) => (
                <div key={label} className={cn("p-[12px] rounded-[12px] border", red ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100")}>
                  <div className="text-[10px] font-[700] uppercase tracking-[0.5px] text-[#64748B]">{label}</div>
                  <div className={cn("text-[18px] font-[800] mt-1", red ? "text-red-700" : "text-[#0F172A]")}>{ptEur(value)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );

  if (flowMode) {
    return (
      <FlowWizard
        open={true}
        onClose={exitFlow}
        title="Salário Líquido"
        icon={Banknote}
        steps={steps}
        resultsStep={{
          label: 'Resultado da simulação',
          description: 'Aqui está o resumo do seu salário líquido e custos para o empregador.',
          render: (
            <div className="flex flex-col gap-4 lg:gap-[16px] h-full">
              {resultsContent}
            </div>
          ),
        }}
        state={s}
        setState={setState}
      />
    );
  }

  return (
    <motion.div className={outerCls} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}>
      {/* Left Pane */}
      <div className={leftCls}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-[800] tracking-[-0.5px] text-[#0F172A]">Salário Líquido (TCO)</h2>
            <p className="text-[13px] text-[#64748B] font-[500] mt-[4px]">Simulador para trabalhadores por conta de outrem — 2026.</p>
          </div>
        </div>

        <div className="space-y-[18px]">
          {/* Salário bruto */}
          <div>
            <label className={labelCls}>Salário Bruto Mensal (€) <Tip>O salário antes de descontos (SS e IRS). É o valor que consta no contrato de trabalho.</Tip></label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input
                type="number"
                min="920"
                step="50"
                value={s.salarioBruto === 0 ? '' : s.salarioBruto}
                onChange={e => setState({ salarioBruto: parseFloat(e.target.value) || 0 })}
                className={cn(inputCls, "pl-9")}
                placeholder="ex: 2000"
              />
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1">SMN 2026: €920/mês</p>
          </div>

          {/* Estado civil */}
          <div>
            <label className={labelCls}>Estado Civil <Tip>Casado com um titular de rendimentos beneficia do quociente conjugal (retenção mais baixa); casado com dois titulares ou solteiro retêm sobre o próprio rendimento. Estimativa anualizada — o valor exato segue a tabela mensal oficial e acerta-se no IRS anual.</Tip></label>
            <select value={s.estadoCivil} onChange={e => setState({ estadoCivil: e.target.value as EstadoCivil })} className={inputCls}>
              <option value="solteiro">Solteiro / Não casado</option>
              <option value="casado_1titular">Casado — 1 titular</option>
              <option value="casado_2titulares">Casado — 2 titulares</option>
            </select>
          </div>

          {/* Dependentes */}
          <div>
            <label className={labelCls}>Nº de Dependentes <Tip>Número de filhos ou pessoas dependentes a cargo. Cada dependente reduz a retenção de IRS.</Tip></label>
            <input
              type="number"
              min="0"
              max="20"
              value={s.nrDependentes === 0 ? '' : s.nrDependentes}
              onChange={e => setState({ nrDependentes: parseInt(e.target.value) || 0 })}
              className={inputCls}
            />
          </div>

          {/* Localização */}
          <div>
            <label className={labelCls}>Localização <Tip>Continente, Açores ou Madeira. Nas regiões autónomas a retenção de IRS é mais baixa — já refletida no líquido mensal apresentado.</Tip></label>
            <select value={s.localizacao} onChange={e => setState({ localizacao: e.target.value as SalarioState['localizacao'] })} className={inputCls}>
              <option value="continente">Continente</option>
              <option value="madeira">Madeira</option>
              <option value="acores">Açores</option>
            </select>
          </div>

          {/* Duodécimos */}
          <label className={cn(
            "flex items-center gap-3 p-[14px] rounded-[12px] border-2 cursor-pointer transition-colors",
            s.duodecimos ? "bg-[#0F172A]/5 border-[#0F172A]" : "bg-[#F5F7FA] border-[#E2E8F0] hover:border-[#94A3B8]"
          )}>
            <input type="checkbox" checked={s.duodecimos} onChange={e => setState({ duodecimos: e.target.checked })} className="hidden" />
            <div className={cn("w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0",
              s.duodecimos ? "bg-[#0F172A] border-[#0F172A]" : "border-[#E2E8F0]")}>
              {s.duodecimos && <span className="text-white text-[10px] font-[900]">✓</span>}
            </div>
            <div>
              <span className="text-[13px] font-[600] text-[#475569]">Duodécimos <Tip>Se os subsídios de Natal e Férias são pagos distribuídos pelos 12 meses (duodécimos) ou em 2 pagamentos anuais. Afeta a retenção mensal.</Tip></span>
              <p className="text-[11px] text-[#94A3B8]">Subsídios distribuídos mensalmente (14 pagamentos → 12)</p>
            </div>
          </label>

          {/* Subsídio alimentação */}
          <div className="space-y-[10px]">
            <div className="text-[12px] font-[700] uppercase tracking-[1px] text-[#64748B]">Subsídio de Alimentação</div>
            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label className={labelCls}>Valor Diário (€) <Tip>O valor diário pago por cada dia de trabalho como subsídio de refeição. Até €6,15/dia em dinheiro está isento de IRS e SS.</Tip></label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.01"
                  value={s.subsidioAlimentacaoDiario === 0 ? '' : s.subsidioAlimentacaoDiario}
                  onChange={e => setState({ subsidioAlimentacaoDiario: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                  placeholder="ex: 6.15"
                />
                {s.subsidioAlimentacaoDiario > 15 && (
                  <p className="text-[11px] text-amber-700 font-[600] mt-1">
                    Valor invulgarmente elevado — confirmar (limite isento mais alto: €10,46/dia em cartão).
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Dias/mês <Tip>Número de dias úteis por mês em que o subsídio de alimentação é pago. Normalmente 22 dias.</Tip></label>
                <input
                  type="number"
                  min="0"
                  max="31"
                  value={s.diasSubsidio === 0 ? '' : s.diasSubsidio}
                  onChange={e => setState({ diasSubsidio: parseInt(e.target.value) || 0 })}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Tipo de Pagamento <Tip>Subsídio em dinheiro: limite isento €6,15/dia. Em cartão de refeição: limite isento €10,46/dia.</Tip></label>
              <select value={s.tipoSubsidio} onChange={e => setState({ tipoSubsidio: e.target.value as SalarioState['tipoSubsidio'] })} className={inputCls}>
                <option value="cartao">Cartão eletrónico — limite €10,46/dia</option>
                <option value="dinheiro">Dinheiro / transferência — limite €6,15/dia</option>
              </select>
            </div>
          </div>

          {/* Seguro Acidentes de Trabalho */}
          <div>
            <label className={labelCls}>Seguro Acidentes de Trabalho (%) <Tip>Taxa do seguro obrigatório (Lei 98/2009). Varia por atividade e risco — ~1% é um valor médio de referência.</Tip></label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={s.taxaSeguroTrabalho === 0 ? '' : s.taxaSeguroTrabalho}
              onChange={e => setState({ taxaSeguroTrabalho: parseFloat(e.target.value) || 0 })}
              className={inputCls}
              placeholder="ex: 1.0"
            />
            <p className="text-[11px] text-[#94A3B8] mt-1">Obrigatório por lei. Média: 1% do salário bruto.</p>
          </div>

          {/* IRS Jovem */}
          <label className={cn(
            "flex items-center gap-3 p-[14px] rounded-[12px] border-2 cursor-pointer transition-colors",
            s.irsJovem && s.idade <= 35 ? "bg-emerald-50 border-emerald-300" : "bg-[#F5F7FA] border-[#E2E8F0] hover:border-[#94A3B8]"
          )}>
            <input type="checkbox" checked={s.irsJovem} onChange={e => setState({ irsJovem: e.target.checked })} className="hidden" />
            <div className={cn("w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0",
              s.irsJovem ? "bg-emerald-600 border-emerald-600" : "border-[#E2E8F0]")}>
              {s.irsJovem && <span className="text-white text-[10px] font-[900]">✓</span>}
            </div>
            <span className="text-[13px] font-[600] text-[#475569]">IRS Jovem (≤35 anos) <Tip>Isenção parcial de IRS para jovens até 35 anos nos primeiros anos de trabalho. Reduz significativamente o imposto retido.</Tip></span>
          </label>

          {s.irsJovem && (
            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label className={labelCls}>Idade <Tip>A sua idade. Determina a elegibilidade para IRS Jovem (até 35 anos).</Tip></label>
                <input type="number" min="18" max="35" value={s.idade === 0 ? '' : s.idade} onChange={e => setState({ idade: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Anos de atividade <Tip>Há quantos anos está a trabalhar. O benefício de IRS Jovem varia conforme o número de anos de atividade.</Tip></label>
                <input type="number" min="0" max="5" value={s.anosAtividade === 0 ? '' : s.anosAtividade} onChange={e => setState({ anosAtividade: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Pane */}
      <div className={rightCls}>
        {resultsContent}
      </div>
    </motion.div>
  );
}
