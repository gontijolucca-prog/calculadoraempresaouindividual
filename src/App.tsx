import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calculator, TrendingUp, Building2, User, AlertCircle, CheckCircle2, ChevronRight, Euro } from 'lucide-react';
import { cn } from './lib/utils';

const IRS_BRACKETS_2026 = [
  { limit: 8235, rate: 0.13, ded: 0 },
  { limit: 12301, rate: 0.165, ded: 288.23 },
  { limit: 17540, rate: 0.22, ded: 964.78 },
  { limit: 22779, rate: 0.25, ded: 1490.98 },
  { limit: 28987, rate: 0.32, ded: 3085.51 },
  { limit: 42250, rate: 0.355, ded: 4100.06 },
  { limit: 55428, rate: 0.435, ded: 7480.06 },
  { limit: 86510, rate: 0.45, ded: 8311.48 },
  { limit: Infinity, rate: 0.48, ded: 10906.78 }
];

function calculateIRS(taxableIncome: number) {
  if (taxableIncome <= 0) return 0;
  for (const bracket of IRS_BRACKETS_2026) {
    if (taxableIncome <= bracket.limit) {
      const tax = (taxableIncome * bracket.rate) - bracket.ded;
      return Math.max(0, tax);
    }
  }
  return 0;
}

function runSimulation(revenue: number, expenses: number, desiredSalary: number) {
  const taxableTI = Math.max(0, revenue * 0.75);
  const irsTI = calculateIRS(taxableTI);
  const ssTI = revenue * 0.70 * 0.214;
  const netTI = revenue - irsTI - ssTI - expenses;

  const annualSalary = desiredSalary * 14;
  const tsuCompany = annualSalary * 0.2375;
  const tsuEmployee = annualSalary * 0.11;
  const taxableSalary = Math.max(0, annualSalary - 4396); // Dedução atualizada 2025/2026
  const irsEmployee = calculateIRS(taxableSalary);
  
  const accounting = Math.min(revenue, 250 * 12); // Assume 3000 EUR
  const totalCompanyCosts = annualSalary + tsuCompany + accounting + expenses;
  const profit = Math.max(0, revenue - totalCompanyCosts);
  
  const irc = profit * 0.16; // IRC PME taxa reduzida em 2025/2026 (16%)
  const dividends = Math.max(0, profit - irc);
  const dividendTax = dividends * 0.28;
  const netDividends = dividends - dividendTax;
  
  const netEmployee = annualSalary - tsuEmployee - irsEmployee;
  const netCompany = netEmployee + netDividends;
  
  const totalTaxesTI = irsTI + ssTI;
  const totalTaxesCompany = tsuCompany + tsuEmployee + irsEmployee + irc + dividendTax;

  return {
    ti: { irs: irsTI, ss: ssTI, net: netTI, taxes: totalTaxesTI, costs: expenses },
    company: { irs: irsEmployee, tsu: tsuCompany + tsuEmployee, irc, dividendTax, accounting, net: netCompany, taxes: totalTaxesCompany, profit }
  }
}

function formatEur(val: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.max(0, val));
}

export default function App() {
  const [revenue, setRevenue] = useState(50000);
  const [expenses, setExpenses] = useState(5000);
  const [salary, setSalary] = useState(1000);

  const results = useMemo(() => runSimulation(revenue, expenses, salary), [revenue, expenses, salary]);

  const diff = Math.abs(results.company.net - results.ti.net);
  const winner = results.company.net > results.ti.net ? 'company' : 'ti';

  const chartData = [
    {
      name: 'Independente (Recibos)',
      'Líquido': Math.round(results.ti.net),
      'Impostos': Math.round(results.ti.taxes),
      'Despesas': Math.round(results.ti.costs),
    },
    {
      name: 'Empresa (Lda)',
      'Líquido': Math.round(results.company.net),
      'Impostos': Math.round(results.company.taxes),
      'Despesas': Math.round(expenses + results.company.accounting),
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] flex flex-col md:grid md:grid-cols-[320px_1fr] font-sans">
      {/* Left Pane: Configurator */}
      <aside className="bg-white border-r border-[#E2E8F0] p-8 flex flex-col h-auto md:h-screen sticky top-0 overflow-y-auto w-full md:w-auto">
        <header className="mb-[40px] flex justify-between items-center">
          <div>
            <div className="font-[800] text-[20px] tracking-[-0.5px] text-[#0F172A]">TAXCORE.AI</div>
            <div className="text-[13px] font-[500] text-[#0F172A]">SIMULADOR FISCAL 2026</div>
          </div>
        </header>

        <div className="flex flex-col gap-5 flex-1">
          <div className="mb-2">
            <label className="block text-[12px] font-[600] uppercase tracking-[1px] text-[#64748B] mb-2">Faturação Anual Prevista</label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input 
                type="number" 
                value={revenue}
                onChange={e => setRevenue(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[16px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none"
              />
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-[12px] font-[600] uppercase tracking-[1px] text-[#64748B] mb-2">Despesas de Atividade</label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input 
                type="number" 
                value={expenses}
                onChange={e => setExpenses(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[16px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none"
              />
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-[12px] font-[600] uppercase tracking-[1px] text-[#64748B] mb-2">Salário Mensal Lda</label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input 
                type="number" 
                value={salary}
                onChange={e => setSalary(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[16px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-[40px] p-[20px] rounded-[12px] bg-[#F1F5F9] text-[13px]">
          <p className="text-[#475569] leading-[1.5]">
            <b>Nota (Atualizado a Abril de 2026):</b> Os cálculos baseiam-se no regime simplificado de IRS e incorporam a descida da taxa de IRC (16% PME) e as novas tabelas de escalões de IRS em vigor desde o Orçamento do Estado mais recente.
          </p>
        </div>
      </aside>

      {/* Right Pane: Results Dashboard */}
      <main className="p-6 md:p-[40px] flex flex-col gap-[32px] overflow-y-auto max-w-7xl">
        <div>
          <h1 className="text-[40px] md:text-[48px] font-[800] leading-[1] md:tracking-[-2px] tracking-[-1px] mb-[8px] text-[#0F172A]">Onde ganha mais?</h1>
          <p className="text-[16px] text-[#64748B] mb-[24px]">Comparação direta de rendimento líquido anual após todos os impostos.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[24px]">
          {/* Opção Individual */}
          <div className={cn(
            "bg-white border rounded-[24px] p-[24px] md:p-[32px] relative",
            winner === 'ti' ? "border-[3px] border-[#10B981] bg-[#ECFDF5]" : "border-[#E2E8F0]"
          )}>
            {winner === 'ti' && <div className="absolute top-[24px] right-[24px] bg-[#10B981] text-white px-[12px] py-[4px] rounded-[99px] text-[10px] font-[700] uppercase hidden sm:block">Melhor Opção</div>}
            
            <div className="text-[14px] font-[700] text-[#64748B] uppercase tracking-[1px] mb-[16px]">Independente (Recibos)</div>
            <div className={cn("text-[48px] md:text-[56px] font-[800] tracking-[-3px] mb-[4px]", winner === 'ti' ? "text-[#10B981]" : "text-[#0F172A]")}>
              {formatEur(results.ti.net)}
            </div>
            <div className="text-[14px] text-[#64748B] mb-[32px]">Anuais Líquidos</div>

            <div className="flex justify-between py-[12px] border-b border-[rgba(0,0,0,0.05)] text-[14px] flex-wrap items-center">
              <span className="text-[#64748B]">IRS (Retenção/Escalão)</span>
              <span className="font-[600] font-mono text-[#0F172A]">-{formatEur(results.ti.irs)}</span>
            </div>
            <div className="flex justify-between py-[12px] border-b border-[rgba(0,0,0,0.05)] text-[14px] flex-wrap items-center">
              <span className="text-[#64748B]">Segurança Social</span>
              <span className="font-[600] font-mono text-[#0F172A]">-{formatEur(results.ti.ss)}</span>
            </div>
            <div className="flex justify-between py-[12px] border-b border-[rgba(0,0,0,0.05)] text-[14px] flex-wrap items-center">
              <span className="text-[#64748B]">Despesas de Atividade</span>
              <span className="font-[600] font-mono text-[#0F172A]">-{formatEur(results.ti.costs)}</span>
            </div>
          </div>

          {/* Opção Empresa */}
          <div className={cn(
            "bg-white border rounded-[24px] p-[24px] md:p-[32px] relative",
            winner === 'company' ? "border-[3px] border-[#10B981] bg-[#ECFDF5]" : "border-[#E2E8F0]"
          )}>
            {winner === 'company' && <div className="absolute top-[24px] right-[24px] bg-[#10B981] text-white px-[12px] py-[4px] rounded-[99px] text-[10px] font-[700] uppercase hidden sm:block">Melhor Opção</div>}
            
            <div className="text-[14px] font-[700] text-[#64748B] uppercase tracking-[1px] mb-[16px]">Empresa Unipessoal Lda.</div>
            <div className={cn("text-[48px] md:text-[56px] font-[800] tracking-[-3px] mb-[4px]", winner === 'company' ? "text-[#10B981]" : "text-[#0F172A]")}>
              {formatEur(results.company.net)}
            </div>
            <div className="text-[14px] text-[#64748B] mb-[32px]">Anuais Líquidos</div>

            <div className="flex justify-between py-[12px] border-b border-[rgba(0,0,0,0.05)] text-[14px] flex-wrap items-center">
              <span className="text-[#64748B]">IRC (Taxa 16% PME) + Divs</span>
              <span className="font-[600] font-mono text-[#0F172A]">-{formatEur(results.company.irc + results.company.dividendTax)}</span>
            </div>
            <div className="flex justify-between py-[12px] border-b border-[rgba(0,0,0,0.05)] text-[14px] flex-wrap items-center">
              <span className="text-[#64748B]">TSU + IRS Acumulado</span>
              <span className="font-[600] font-mono text-[#0F172A]">-{formatEur(results.company.tsu + results.company.irs)}</span>
            </div>
            <div className="flex justify-between py-[12px] border-b border-[rgba(0,0,0,0.05)] text-[14px] flex-wrap items-center">
              <span className="text-[#64748B]">Custos Gestão/Contab.</span>
              <span className="font-[600] font-mono text-[#0F172A]">-{formatEur(results.company.accounting + expenses)}</span>
            </div>
          </div>
        </div>
        
        {/* Chart Component Maintained */}
        <div className="bg-white p-[24px] md:p-[32px] rounded-[24px] border border-[#E2E8F0]">
          <div className="text-[14px] font-[700] text-[#64748B] uppercase tracking-[1px] mb-[16px]">Fluxo de Capital Comparado</div>
          <div className="h-[250px] md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(value) => `${value / 1000}k€`} />
                <RechartsTooltip 
                  cursor={{fill: '#F8FAFC'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px'}}
                  formatter={(value: number) => formatEur(value)}
                />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '32px', fontSize: '13px'}} />
                <Bar dataKey="Líquido" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Impostos" stackId="a" fill="#0F172A" />
                <Bar dataKey="Despesas" stackId="a" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0F172A] text-white p-[24px] rounded-[16px] mt-auto">
          <div className="text-[12px] uppercase opacity-60 mb-[8px] font-[600] tracking-[1px]">Conclusão do Especialista</div>
          <div className="text-[16px] md:text-[18px] font-[500] leading-relaxed">
            Com base no seu volume de negócios, atuar como <b className="text-[#10B981]">{winner === 'company' ? 'Empresa Lda' : 'Independente (Recibos)'}</b> permite-lhe maximizar os seus rendimentos com uma vantagem líquida de <b className="text-[#10B981]">{formatEur(diff)} por ano</b> em carga fiscal direta.
          </div>
        </div>
      </main>
    </div>
  );
}
