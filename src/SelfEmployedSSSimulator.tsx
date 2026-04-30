import React, { useMemo } from 'react';
import { calcSelfSSContribution } from './lib/pt2026';
import { cn } from './lib/utils';
import { ShieldCheck, Wallet, AlertTriangle, Calendar } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface SSState {
  income: number;
  regime: 'general' | 'simplified';
  tipoRendimento: 'servicos' | 'bens';
  primeiroAno: boolean;
}

interface Props {
  initialState: SSState;
  onStateChange: (state: SSState) => void;
}

export default function SelfEmployedSSSimulator({ initialState, onStateChange }: Props) {
  const { income, regime, tipoRendimento, primeiroAno } = initialState;

  const setState = (updates: Partial<SSState>) => {
    onStateChange({ ...initialState, ...updates });
  };

  const result = useMemo(() => {
    if (income > 0) {
      return calcSelfSSContribution(income, tipoRendimento, primeiroAno);
    }
    return null;
  }, [income, tipoRendimento, primeiroAno]);

  const inputClass = "w-full pl-[16px] pr-[16px] py-[12px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[15px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelClass = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[8px]";

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);
  const { simMode } = useTheme();
  const outerCls = { split: "h-full flex flex-col md:grid md:grid-cols-[400px_1fr] bg-[#F8FAFC] text-[#1E293B]", stacked: "h-full flex flex-col bg-[#F0F4F8] text-[#1E293B] overflow-y-auto", mosaic: "h-full bg-[#F0FDF4] text-[#1E293B] md:grid md:grid-cols-2 gap-4 p-4", compact: "h-full overflow-y-auto bg-white text-[#1E293B]", hero: "h-full flex md:flex-row-reverse overflow-hidden bg-[#F5F5F4] text-[#1E293B]" }[simMode];
  const leftCls = { split: "bg-white border-r border-[#E2E8F0] overflow-y-auto p-6 md:p-[40px] flex flex-col gap-[32px] h-full", stacked: "bg-white border-b-2 border-[#E2E8F0] p-6 flex flex-col gap-6", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pb-0 w-full", hero: "md:w-[420px] shrink-0 bg-white border-l border-[#E2E8F0] overflow-y-auto p-6 flex flex-col gap-5 h-full" }[simMode];
  const rightCls = { split: "p-6 md:p-[40px] overflow-y-auto h-full max-w-7xl mx-auto w-full flex flex-col gap-[32px]", stacked: "p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pt-2 w-full border-t border-slate-100", hero: "flex-1 p-6 md:p-[40px] overflow-y-auto flex flex-col gap-5" }[simMode];

  return (
    <div className={outerCls}>
      {/* Left Pane - Form */}
      <div className={leftCls}>
        <div>
          <h2 className="text-[24px] font-[800] tracking-[-0.5px] text-[#0F172A]">Simulador SS Independente</h2>
          <p className="text-[14px] text-[#64748B] font-[500] mt-[4px]">Contribuições de trabalhador independente (ENI).</p>
        </div>

        <div className="space-y-[24px]">
          <div>
            <label className={labelClass}>Rendimento Mensal (€)</label>
            <div className="relative">
              <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={income}
                onChange={e => setState({ income: parseFloat(e.target.value) || 0 })}
                className={cn(inputClass, "pl-[40px]")}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Tipo de Rendimento</label>
            <select value={tipoRendimento} onChange={e => setState({ tipoRendimento: e.target.value as 'servicos' | 'bens' })} className={inputClass}>
              <option value="servicos">Prestação de Serviços (base 70%)</option>
              <option value="bens">Venda de Bens (base 20%)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Regime IRS</label>
            <select value={regime} onChange={e => setState({ regime: e.target.value as 'general' | 'simplified' })} className={inputClass}>
              <option value="general">Regime Geral</option>
              <option value="simplified">Regime Simplificado</option>
            </select>
          </div>

          {/* 1º Ano de Atividade */}
          <label className={cn(
            "flex items-start gap-4 p-5 border-2 rounded-[16px] cursor-pointer transition-colors",
            primeiroAno ? "border-emerald-400 bg-emerald-50" : "border-[#E2E8F0] hover:border-[#CBD5E1]"
          )}>
            <input
              type="checkbox"
              checked={primeiroAno}
              onChange={e => setState({ primeiroAno: e.target.checked })}
              className="mt-1 w-5 h-5 accent-emerald-600"
            />
            <div>
              <span className="text-[14px] font-[700] text-[#0F172A] block">Primeiro Ano de Atividade</span>
              <span className="text-[12px] text-[#64748B] font-[500] leading-snug mt-1 block">
                Isenção total de contribuições no 1.º ano (Art. 164.º CRCSPSS). Aplica-se a novos inscritos na SS como trabalhadores independentes.
              </span>
            </div>
          </label>

          <div className="p-5 border-2 border-[#E2E8F0] rounded-[16px] bg-[#F8FAFC]">
            <h3 className="text-[12px] font-[800] text-[#0F172A] mb-4">REGRAS 2026 (CRCSPSS)</h3>
            <ul className="text-[13px] text-[#64748B] font-[500] leading-relaxed space-y-2">
              <li>• <strong>Serviços:</strong> 70% do rendimento × 21,4%</li>
              <li>• <strong>Bens:</strong> 20% do rendimento × 21,4%</li>
              <li>• <strong>Mínimo:</strong> €20/mês (se rendimento &gt; IAS)</li>
              <li>• <strong>Pagamento:</strong> Trimestral (jan, abr, jul, out)</li>
              <li>• <strong>1.º ano:</strong> Isenção total — Art. 164.º CRCSPSS</li>
            </ul>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-[12px]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[13px] font-[700] text-amber-900 mb-1">Nota Importante</h4>
                <p className="text-[12px] text-amber-800 font-[500] leading-snug">
                  Estes valores são uma estimativa. Na prática, a SS calcula a base trimestralmente com base na média dos 3 meses anteriores. Consulte o Portal da Segurança Social para valores exatos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Results */}
      <div className={rightCls}>
        <div>
          <h1 className="text-[32px] md:text-[40px] font-[800] leading-[1] md:tracking-[-1.5px] mb-[8px] text-[#0F172A]">Resultados Apurados</h1>
          <p className="text-[16px] text-[#64748B] mb-[8px]">Contribuição à Segurança Social — trabalhador independente.</p>
        </div>

        {/* Isenção 1º ano */}
        {primeiroAno && (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-[24px] p-[32px] flex items-start gap-6 shadow-sm">
            <div className="bg-emerald-100 text-emerald-600 p-[12px] rounded-[16px] shrink-0">
              <ShieldCheck className="w-[28px] h-[28px]" />
            </div>
            <div>
              <h3 className="text-[20px] font-[800] text-emerald-900 mb-2">Isento no 1.º Ano de Atividade</h3>
              <p className="text-[14px] text-emerald-800 font-[500] leading-relaxed">
                Ao abrigo do <strong>Art. 164.º do CRCSPSS</strong>, novos trabalhadores independentes estão isentos de contribuições para a Segurança Social durante os primeiros 12 meses de atividade. A contribuição começa a ser devida no mês seguinte ao término do período de isenção.
              </p>
              <div className="mt-4 bg-white border border-emerald-200 rounded-[12px] p-4 text-[13px] text-emerald-900 font-[600]">
                Poupança estimada no 1.º ano: <strong className="text-emerald-700">{ptEur(calcSelfSSContribution(income, tipoRendimento, false).anual)}</strong> (contribuições que seriam devidas sem isenção)
              </div>
            </div>
          </div>
        )}

        {!primeiroAno && result && (
          <>
            {/* 3 metric cards */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
              <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[28px] flex flex-col shadow-sm">
                <div className="flex items-center gap-[12px] mb-[16px]">
                  <div className="bg-[#EFF6FF] text-[#3B82F6] p-[10px] rounded-[14px]">
                    <Wallet className="w-[20px] h-[20px]" />
                  </div>
                  <h3 className="text-[15px] font-[700] text-[#0F172A]">Mensal</h3>
                </div>
                <div className="text-[36px] font-[800] text-[#3B82F6] tracking-[-1px] mb-[8px]">
                  {ptEur(result.mensal)}
                </div>
                <p className="text-[12px] text-[#64748B] font-[500]">Estimativa por mês</p>
              </div>

              <div className="bg-white border-2 border-[#781D1D] rounded-[24px] p-[24px] md:p-[28px] flex flex-col shadow-sm ring-4 ring-[#781D1D]/10">
                <div className="flex items-center gap-[12px] mb-[16px]">
                  <div className="bg-[#FDF2F2] text-[#781D1D] p-[10px] rounded-[14px]">
                    <Calendar className="w-[20px] h-[20px]" />
                  </div>
                  <h3 className="text-[15px] font-[700] text-[#0F172A]">Trimestral</h3>
                </div>
                <div className="text-[36px] font-[800] text-[#781D1D] tracking-[-1px] mb-[8px]">
                  {ptEur(result.trimestral)}
                </div>
                <p className="text-[12px] text-[#64748B] font-[500]">Valor a pagar cada trimestre</p>
                <div className="mt-3 text-[11px] bg-[#FDF2F2] text-[#781D1D] font-[700] rounded-[8px] px-3 py-1.5 text-center">
                  Jan • Abr • Jul • Out (até dia 20)
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[28px] flex flex-col shadow-sm">
                <div className="flex items-center gap-[12px] mb-[16px]">
                  <div className="bg-[#ECFDF5] text-[#10B981] p-[10px] rounded-[14px]">
                    <ShieldCheck className="w-[20px] h-[20px]" />
                  </div>
                  <h3 className="text-[15px] font-[700] text-[#0F172A]">Anual</h3>
                </div>
                <div className="text-[36px] font-[800] text-[#10B981] tracking-[-1px] mb-[8px]">
                  {ptEur(result.anual)}
                </div>
                <p className="text-[12px] text-[#64748B] font-[500]">Total para o ano</p>
              </div>
            </div>

            {/* Calculation breakdown */}
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm">
              <div className="flex items-center gap-[16px] mb-[24px]">
                <div className="bg-[#EFF6FF] text-[#3B82F6] p-[12px] rounded-[16px]">
                  <Wallet className="w-[24px] h-[24px]" />
                </div>
                <h3 className="text-[18px] font-[700] text-[#0F172A]">Detalhes do Cálculo</h3>
              </div>
              <div className="flex-1 space-y-0">
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Rendimento Mensal</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{ptEur(income)}</span>
                </div>
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Tipo de Rendimento</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{tipoRendimento === 'servicos' ? 'Serviços (70%)' : 'Bens (20%)'}</span>
                </div>
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Base de Cálculo (€)</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{ptEur(result.baseCalculo)}</span>
                </div>
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Taxa SS 2026</span>
                  <span className="font-[700] font-mono text-[#0F172A]">21,4%</span>
                </div>
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Mínimo de Contribuição</span>
                  <span className="font-[700] font-mono text-[#0F172A]">€20,00</span>
                </div>
                <div className="flex justify-between py-[14px] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Contribuição Dedutível em IRS</span>
                  <span className="font-[700] font-mono text-emerald-600">Sim (100%)</span>
                </div>
              </div>
              <div className="mt-[24px] p-[16px] bg-[#F1F5F9] rounded-[12px] text-[12px] text-[#64748B] font-[500] leading-relaxed">
                <strong>Nota fiscal:</strong> As contribuições para a SS são 100% dedutíveis no IRS em sede de Categoria B. No Regime Simplificado pode deduzir adicionalmente 25% das despesas relacionadas com a atividade.
              </div>
            </div>
          </>
        )}

        {!result && !primeiroAno && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="bg-[#F1F5F9] p-6 rounded-full inline-block mb-4">
                <Wallet className="w-12 h-12 text-[#64748B]" />
              </div>
              <p className="text-[#64748B] text-[16px]">Preencha o rendimento para calcular a contribuição.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
