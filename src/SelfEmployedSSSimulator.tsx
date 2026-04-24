import React, { useMemo } from 'react';
import { calcSelfSSContribution } from './lib/pt2026';
import { cn } from './lib/utils';
import { ShieldCheck, Wallet, AlertTriangle } from 'lucide-react';

interface SSState {
  income: number;
  regime: 'general' | 'simplified';
  tipoRendimento: 'servicos' | 'bens';
}

interface Props {
  initialState: SSState;
  onStateChange: (state: SSState) => void;
}

export default function SelfEmployedSSSimulator({ initialState, onStateChange }: Props) {
  const { income, regime, tipoRendimento } = initialState;

  const setState = (updates: Partial<SSState>) => {
    onStateChange({ ...initialState, ...updates });
  };

  const contribution = useMemo(() => {
    if (income > 0) {
      return calcSelfSSContribution(income, tipoRendimento);
    }
    return null;
  }, [income, tipoRendimento]);

  const inputClass = "w-full pl-[16px] pr-[16px] py-[12px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[15px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelClass = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[8px]";

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  return (
    <div className="h-full flex flex-col md:grid md:grid-cols-[400px_1fr] bg-[#F8FAFC] text-[#1E293B]">
      {/* Left Pane - Form */}
      <div className="bg-white border-r border-[#E2E8F0] overflow-y-auto p-6 md:p-[40px] flex flex-col gap-[32px] h-full">
        <div>
          <h2 className="text-[24px] font-[800] tracking-[-0.5px] text-[#0F172A]">Simulador Segurança Social</h2>
          <p className="text-[14px] text-[#64748B] font-[500] mt-[4px]">Cálculo de contribuições para trabalhador independente.</p>
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
            <select
              value={tipoRendimento}
              onChange={e => setState({ tipoRendimento: e.target.value as 'servicos' | 'bens' })}
              className={inputClass}
            >
              <option value="servicos">Prestação de Serviços (70% base)</option>
              <option value="bens">Venda de Bens (20% base)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Regime IRS</label>
            <select
              value={regime}
              onChange={e => setState({ regime: e.target.value as 'general' | 'simplified' })}
              className={inputClass}
            >
              <option value="general">Regime Geral</option>
              <option value="simplified">Regime Simplificado</option>
            </select>
          </div>

          <div className="p-5 border-2 border-[#E2E8F0] rounded-[16px] bg-[#F8FAFC]">
            <h3 className="text-[12px] font-[800] text-[#0F172A] mb-4">INFORMAÇÃO</h3>
            <p className="text-[13px] text-[#64748B] font-[500] leading-relaxed mb-3">
              A base de cálculo da SS varia conforme o tipo de atividade:
            </p>
            <ul className="text-[13px] text-[#64748B] font-[500] leading-relaxed space-y-1">
              <li>• <strong>Serviços:</strong> 70% do rendimento (taxa 21.4%)</li>
              <li>• <strong>Bens:</strong> 20% do rendimento (taxa 21.4%)</li>
            </ul>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-[12px]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[13px] font-[700] text-amber-900 mb-1">Nota Importante</h4>
                <p className="text-[12px] text-amber-800 font-[500] leading-snug">
                  Estes valores são uma estimativa baseada nas regras fiscais de 2026. Consulte o site da Segurança Social para valores exatos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Results */}
      <div className="p-6 md:p-[40px] overflow-y-auto h-full max-w-7xl mx-auto w-full flex flex-col gap-[32px]">
        <div>
          <h1 className="text-[32px] md:text-[40px] font-[800] leading-[1] md:tracking-[-1.5px] mb-[8px] text-[#0F172A]">Resultados Apurados</h1>
          <p className="text-[16px] text-[#64748B] mb-[8px]">Contribuição mensal à Segurança Social.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-[24px]">
          {/* Contribution Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm">
            <div className="flex items-center gap-[16px] mb-[24px]">
              <div className="bg-[#ECFDF5] text-[#10B981] p-[12px] rounded-[16px]">
                <ShieldCheck className="w-[24px] h-[24px]" />
              </div>
              <h3 className="text-[18px] font-[700] text-[#0F172A]">Contribuição Mensal</h3>
            </div>

            <div className="text-[48px] md:text-[56px] font-[800] text-[#10B981] tracking-[-2px] mb-[32px]">
              {contribution !== null ? ptEur(contribution) : '—'}
            </div>

            <div className="flex-1 space-y-0">
              <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                <span className="text-[#64748B] font-[600]">Rendimento Mensal</span>
                <span className="font-[700] font-mono text-[#0F172A]">{ptEur(income)}</span>
              </div>
              <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                <span className="text-[#64748B] font-[600]">Tipo Rendimento</span>
                <span className="font-[700] font-mono text-[#0F172A]">{tipoRendimento === 'servicos' ? 'Serviços' : 'Bens'}</span>
              </div>
              <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                <span className="text-[#64748B] font-[600]">Base de Cálculo</span>
                <span className="font-[700] font-mono text-[#0F172A]">{tipoRendimento === 'servicos' ? '70%' : '20%'}</span>
              </div>
            </div>

            <div className="mt-[32px] p-[16px] bg-[#F8FAFC] rounded-[12px] text-[12px] text-[#64748B] font-[500] leading-relaxed">
              Nota: A contribuição para a Segurança Social é calculada sobre uma percentagem do rendimento tributável, sendo obrigatória para trabalhadores independentes.
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm">
            <div className="flex items-center gap-[16px] mb-[24px]">
              <div className="bg-[#EFF6FF] text-[#3B82F6] p-[12px] rounded-[16px]">
                <Wallet className="w-[24px] h-[24px]" />
              </div>
              <h3 className="text-[18px] font-[700] text-[#0F172A]">Detalhes do Cálculo</h3>
            </div>

            <div className="flex-1 space-y-0">
              <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                <span className="text-[#64748B] font-[600]">Taxa SS 2026</span>
                <span className="font-[700] font-mono text-[#0F172A]">21.4%</span>
              </div>
              <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                <span className="text-[#64748B] font-[600]">Base Serviços</span>
                <span className="font-[700] font-mono text-[#0F172A]">70% rendimento</span>
              </div>
              <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                <span className="text-[#64748B] font-[600]">Base Bens</span>
                <span className="font-[700] font-mono text-[#0F172A]">20% rendimento</span>
              </div>
              <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                <span className="text-[#64748B] font-[600]">Mínimo Contribuição</span>
                <span className="font-[700] font-mono text-[#0F172A]">20.00 €</span>
              </div>
            </div>

            <div className="mt-[32px] p-[16px] bg-[#F1F5F9] rounded-[12px] text-[12px] text-[#64748B] font-[500] leading-relaxed">
              <strong>Dica:</strong> No Regime Simplificado de IRS, pode deduzir 25% das despesas relacionadas com a atividade (diferente da base de cálculo da SS).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}