import React, { useMemo } from 'react';
import { RefreshCw, TrendingUp, CheckCircle2, Calculator, Briefcase, PieChart, ShieldAlert, User, Info } from 'lucide-react';
import { cn } from './lib/utils';
import type { ClientProfile } from './ClientProfile';
import { calculateIRS, calcIRSJovem, calcDependentsDeduction } from './lib/pt2026';

interface TaxSimulatorState {
  profSit: string;
  currentInc: number;
  age: number;
  isMainAct: boolean;
  monthlyNeed: number;
  isServices: boolean;
  b2b: boolean;
  rev: number;
  isSeasonal: boolean;
  invEquip: number;
  invLic: number;
  invWorks: number;
  invFundo: number;
  fixedMo: number;
  varYr: number;
  accMoLda: number;
  accMoEni: number;
  anosAtividade: number;
}

interface Props {
  initialState: TaxSimulatorState;
  onStateChange: (state: TaxSimulatorState) => void;
  profile: ClientProfile;
}

export default function TaxSimulator({ initialState, onStateChange, profile }: Props) {
  const {
    profSit, currentInc, age, isMainAct, monthlyNeed,
    isServices, b2b, rev, isSeasonal,
    invEquip, invLic, invWorks, invFundo,
    fixedMo, varYr, accMoLda, accMoEni, anosAtividade
  } = initialState;

  const setState = (updates: Partial<TaxSimulatorState>) => {
    onStateChange({ ...initialState, ...updates });
  };

  const inputCls = "w-full px-3 py-[10px] bg-[#F1F5F9] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] focus:border-[#4F46E5] outline-none mt-1 transition-all focus:bg-white";
  const lblCls = "text-[11px] font-[700] uppercase tracking-[0.5px] text-[#475569] leading-tight";
  const headerIcon = "w-5 h-5 opacity-80 mr-2 inline-block -mt-0.5";

  const results = useMemo(() => {
    const totalInv = invEquip + invLic + invWorks + invFundo;
    const invCapex = invEquip + invLic + invWorks;

    const fixedYr = fixedMo * 12;
    const accYrLda = accMoLda * 12;
    const accYrEni = accMoEni * 12;
    const dpNaoAceite = invCapex * 0.25;

    const costsLdaOutPocket = fixedYr + varYr + accYrLda;
    const costsEniOutPocket = fixedYr + varYr + accYrEni;

    // SS ENI — isenção se TCO secundário e rev ≤ €20k
    let eniSS = 0;
    if (profSit === 'tco' && !isMainAct && rev <= 20000) {
      eniSS = 0;
    } else {
      eniSS = rev * (isServices ? 0.70 : 0.20) * 0.214;
    }

    // Rendimento coletável ENI (regime simplificado — Art. 31º CIRS)
    let eniRendColetavel = rev * (isServices ? 0.75 : 0.15);

    // Regra €27.360 serviços
    if (isServices && rev > 27360) {
      const requiredJustDocs = rev * 0.15;
      const justDocsPresented = costsEniOutPocket + 4104;
      if (justDocsPresented < requiredJustDocs) {
        eniRendColetavel += (requiredJustDocs - justDocsPresented);
      }
    }

    // IRS Jovem — Art. 12º-B CIRS
    let irsJovemDeduction = 0;
    if (profile.beneficioJovem && profile.idade <= 35) {
      irsJovemDeduction = calcIRSJovem(anosAtividade, eniRendColetavel, profile.idade);
      eniRendColetavel = Math.max(0, eniRendColetavel - irsJovemDeduction);
    }

    // IRS marginal sobre o rendimento da atividade (acumulado ao rendimento atual)
    const eniIRS_Total = calculateIRS(currentInc + eniRendColetavel);
    const eniIRS_Current = calculateIRS(currentInc);
    let eniIRS = Math.max(0, eniIRS_Total - eniIRS_Current);

    // Dedução por dependentes — Art. 78º-A CIRS (dedução à coleta)
    const depsDeduction = calcDependentsDeduction(profile.nrDependentes);
    eniIRS = Math.max(0, eniIRS - depsDeduction);

    // Pagamentos por Conta estimados (ENI)
    const ppc = eniIRS * 0.25;

    // Retenção na fonte para serviços ENI (11,5% — apenas informativo)
    const retencaoFonte = isServices ? rev * 0.115 : 0;

    const eniNet = rev - costsEniOutPocket - eniSS - eniIRS;
    const eniCashFlow = eniNet - totalInv;

    // LDA
    const rawGross = monthlyNeed / 0.70;
    const grossSalaryYr = rawGross * 14;
    const ldaSSCompany = grossSalaryYr * 0.2375;
    const ldaSSManager = grossSalaryYr * 0.11;
    const ldaIRSManager = calculateIRS(grossSalaryYr);

    const profit = rev - costsLdaOutPocket - dpNaoAceite - grossSalaryYr - ldaSSCompany;
    let irc = 0;
    if (profit > 0) {
      irc = profit <= 50000 ? profit * 0.15 : (50000 * 0.15) + ((profit - 50000) * 0.19);
    }

    const companyNetEarnings = profit - irc;
    const ldaBusinessNet = companyNetEarnings + (monthlyNeed * 12);
    const ldaCashFlow = (companyNetEarnings + dpNaoAceite) - totalInv;

    const varMargin = rev > 0 ? (rev - varYr) / rev : 0.01;
    const beEni = varMargin > 0 ? (fixedYr + accYrEni) / varMargin : 0;
    const beLda = varMargin > 0 ? (fixedYr + accYrLda + grossSalaryYr + ldaSSCompany) / varMargin : 0;

    return {
      totalInv,
      beEni, beLda,
      irsJovemDeduction,
      depsDeduction,
      ppc,
      retencaoFonte,
      eni: { ss: eniSS, irs: eniIRS, net: eniNet, cashFlow: eniCashFlow, costs: costsEniOutPocket, rendColetavel: eniRendColetavel },
      lda: {
        ssComp: ldaSSCompany, ssEmp: ldaSSManager,
        irc, irs: ldaIRSManager,
        net: ldaBusinessNet, cashFlow: ldaCashFlow,
        profit: companyNetEarnings,
        costs: costsLdaOutPocket
      }
    };
  }, [profSit, currentInc, age, isMainAct, monthlyNeed, isServices, b2b, rev, isSeasonal,
      invEquip, invLic, invWorks, invFundo, fixedMo, varYr, accMoLda, accMoEni,
      anosAtividade, profile.beneficioJovem, profile.idade, profile.nrDependentes]);

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.max(0, v));

  const winner = results.lda.net > results.eni.net ? 'LDA' : 'ENI';
  const diff = Math.abs(results.lda.net - results.eni.net);

  const resetAll = () => {
    onStateChange({
      profSit: profile.tipoEntidade === 'eni' ? 'outro' : 'tco',
      currentInc: 25000,
      age: profile.idade,
      isMainAct: profile.tipoEntidade !== 'eni',
      monthlyNeed: 1500,
      isServices: profile.atividadePrincipal === 'servicos',
      b2b: true,
      rev: profile.faturaçaoAnualPrevista,
      isSeasonal: profile.isSazonal,
      invEquip: 3000,
      invLic: 500,
      invWorks: 1000,
      invFundo: 2000,
      fixedMo: 400,
      varYr: 5000,
      accMoLda: 200,
      accMoEni: 50,
      anosAtividade: Math.max(0, new Date().getFullYear() - profile.inicioAtividade)
    });
  };

  return (
    <div className="h-full flex flex-col xl:flex-row bg-[#F8FAFC]">

      {/* LEFT PANEL */}
      <div className="xl:w-[480px] shrink-0 bg-white border-r border-[#E2E8F0] overflow-y-auto h-full flex flex-col">
        <div className="p-6 md:p-8 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#F1F5F9]">
          <div>
            <h2 className="text-[20px] font-[800] tracking-[-0.5px] text-[#0F172A]">Recofatima Simuladores</h2>
            <div className="text-[11px] font-[700] uppercase tracking-[1px] text-[#4F46E5] mt-1">Estudo de Negócio • OE 2026</div>
          </div>
          <button onClick={resetAll} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-[8px] transition-colors" title="Repor todos os valores"><RefreshCw size={18} /></button>
        </div>

        <div className="p-6 md:p-8 space-y-10">

          {/* Folha 1 */}
          <section>
            <h3 className="text-[14px] font-[800] text-[#781D1D] mb-4 flex items-center border-b pb-2"><User className={headerIcon}/> Folha 1 — Dados do Promotor</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="col-span-2">
                <label className={lblCls}>Situação Atual</label>
                <select value={profSit} onChange={e=>setState({profSit: e.target.value})} className={inputCls}>
                  <option value="tco">Trab. Conta de Outrem (TCO)</option>
                  <option value="desempregado">Desempregado</option>
                  <option value="outro">Recibo Verde / Empresário</option>
                </select>
              </div>
              <div>
                <label className={lblCls}>Idade</label>
                <input type="number" value={age} onChange={e=>setState({age: Number(e.target.value)})} className={inputCls} />
              </div>
              <label className="flex flex-col justify-end gap-2 p-3 bg-slate-50 border border-slate-200 rounded-[8px] cursor-pointer hover:bg-slate-100 transition-colors">
                <span className={lblCls}>Atividade</span>
                <div className="flex items-center gap-2"><input type="checkbox" checked={isMainAct} onChange={e=>setState({isMainAct: e.target.checked})} className="w-4 h-4 accent-[#781D1D]" /><span className="text-[13px] font-[600] text-slate-700">Principal</span></div>
              </label>
              <div>
                <label className={lblCls}>Rend. Atual / Ano</label>
                <input type="number" value={currentInc} onChange={e=>setState({currentInc: Number(e.target.value)})} className={inputCls} />
              </div>
              <div>
                <label className={lblCls}>Subsistência / Mês (Meta)</label>
                <input type="number" value={monthlyNeed} onChange={e=>setState({monthlyNeed: Number(e.target.value)})} className={inputCls} />
              </div>
              {profile.beneficioJovem && profile.idade <= 35 && (
                <div className="col-span-2">
                  <label className={lblCls}>Anos de Atividade Profissional</label>
                  <input
                    type="number"
                    min={0} max={5}
                    value={anosAtividade}
                    onChange={e=>setState({anosAtividade: Number(e.target.value)})}
                    className={inputCls}
                  />
                  <p className="text-[11px] text-blue-600 mt-1 font-[600]">Para cálculo do IRS Jovem (Art. 12º-B CIRS). 0 = 1º ano.</p>
                </div>
              )}
            </div>
          </section>

          {/* Folha 2 */}
          <section>
            <h3 className="text-[14px] font-[800] text-[#781D1D] mb-4 flex items-center border-b pb-2"><Briefcase className={headerIcon}/> Folha 2 — O Negócio</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label className={lblCls}>Tipo Venda</label>
                <select value={isServices ? 'svc' : 'prod'} onChange={e=>setState({isServices: e.target.value==='svc'})} className={inputCls}>
                  <option value="svc">Serviços</option>
                  <option value="prod">Bens Físicos</option>
                </select>
              </div>
              <div>
                <label className={lblCls}>Público</label>
                <select value={b2b ? 'b2b' : 'b2c'} onChange={e=>setState({b2b: e.target.value==='b2b'})} className={inputCls}>
                  <option value="b2b">Empresas (B2B)</option>
                  <option value="b2c">Particulares (B2C)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={lblCls}>Previsão Faturação (Ano 1)</label>
                <input type="number" value={rev} onChange={e=>setState({rev: Number(e.target.value)})} className={inputCls} />
              </div>
              <label className="col-span-2 flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-[8px] cursor-pointer hover:bg-amber-100 transition-colors">
                <input type="checkbox" checked={isSeasonal} onChange={e=>setState({isSeasonal: e.target.checked})} className="mt-1 w-4 h-4 accent-amber-600" />
                <span className="text-[13px] font-[600] text-amber-900 leading-snug">Negócio Sazonal (Afeta cash-flow drásticamente nos 1ºs trimestres)</span>
              </label>
            </div>
          </section>

          {/* Folha 3 */}
          <section>
            <h3 className="text-[14px] font-[800] text-[#781D1D] mb-4 flex items-center border-b pb-2"><TrendingUp className={headerIcon}/> Folha 3 — Investimento Inicial</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div><label className={lblCls}>Equipamento/Tech</label><input type="number" value={invEquip} onChange={e=>setState({invEquip: Number(e.target.value)})} className={inputCls} /></div>
              <div><label className={lblCls}>Licenças / Registo</label><input type="number" value={invLic} onChange={e=>setState({invLic: Number(e.target.value)})} className={inputCls} /></div>
              <div><label className={lblCls}>Obras / Espaço</label><input type="number" value={invWorks} onChange={e=>setState({invWorks: Number(e.target.value)})} className={inputCls} /></div>
              <div><label className={lblCls}>Fundo de Maneio (Caixa)</label><input type="number" value={invFundo} onChange={e=>setState({invFundo: Number(e.target.value)})} className={inputCls} /></div>
              <div className="col-span-2 mt-2 pt-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 p-3 rounded-[8px]">
                <span className="text-[12px] font-[700] text-slate-500 uppercase">Total CapEx + Tesouraria</span>
                <span className="text-[16px] font-[800] text-slate-800">{ptEur(results.totalInv)}</span>
              </div>
            </div>
          </section>

          {/* Folha 4 */}
          <section>
            <h3 className="text-[14px] font-[800] text-[#781D1D] mb-4 flex items-center border-b pb-2"><Calculator className={headerIcon}/> Folha 4 — Controlo de Custos</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div><label className={lblCls}>Custos Fixos / Mês</label><input type="number" value={fixedMo} onChange={e=>setState({fixedMo: Number(e.target.value)})} className={inputCls} /></div>
              <div><label className={lblCls}>Custos Prod. / Ano</label><input type="number" value={varYr} onChange={e=>setState({varYr: Number(e.target.value)})} className={inputCls} /></div>
              <div><label className={lblCls}>Contabilidade Lda / Mês</label><input type="number" value={accMoLda} onChange={e=>setState({accMoLda: Number(e.target.value)})} className={inputCls} /></div>
              <div><label className={lblCls}>Contabilidade ENI / Mês</label><input type="number" value={accMoEni} onChange={e=>setState({accMoEni: Number(e.target.value)})} className={inputCls} /></div>
            </div>
          </section>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto w-full flex flex-col gap-8 relative max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-[32px] md:text-[40px] font-[800] tracking-[-1.5px] text-[#0F172A] leading-[1.1]">Dashboard Decision Financeiro</h1>
            <p className="text-[15px] font-[500] text-[#64748B] mt-1">Cálculo preditivo de Viabilidade em Portugal (Simulador Oficial 2026).</p>
          </div>
        </div>

        {/* Winner banner */}
        <section className={cn("p-6 md:p-8 rounded-[24px] border-2 flex flex-col md:flex-row items-start gap-5 shadow-sm", winner === 'LDA' ? "bg-[#FDF2F2] border-[#F8B4B4]" : "bg-emerald-50 border-emerald-200")}>
          <div className={cn("p-3 rounded-[16px]", winner === 'LDA' ? "bg-[#FDE8E8] text-[#781D1D]" : "bg-emerald-100 text-emerald-600")}>
            <CheckCircle2 className="w-8 h-8"/>
          </div>
          <div className="flex-1">
            <div className="text-[12px] font-[800] uppercase tracking-[1px] mb-1 opacity-70">Parecer & Conclusão</div>
            <h3 className={cn("text-[20px] md:text-[24px] font-[800] tracking-tight mb-2", winner === 'LDA' ? "text-[#781D1D]" : "text-emerald-900")}>
              Regime Ideal: {winner === 'LDA' ? 'Sociedade Unipessoal / Lda' : 'Trabalhador Independente (ENI)'}
            </h3>
            <p className={cn("text-[15px] leading-relaxed font-[500]", winner === 'LDA' ? "text-[#5A1313]" : "text-emerald-800")}>
              Ao encabeçar a faturação de <strong>{ptEur(rev)}</strong>, montar uma <strong>{winner === 'LDA' ? 'Empresa' : 'Atividade Pessoal'}</strong> maximiza os lucros em <strong>{ptEur(diff)} adicionais/ano</strong>.
              {profile.beneficioJovem && profile.idade <= 35 && results.irsJovemDeduction > 0 &&
                ` O Benefício Jovem (Art. 12º-B CIRS) reduz o rendimento coletável em ${ptEur(results.irsJovemDeduction)}.`
              }
            </p>
          </div>
        </section>

        {/* IRS Jovem + Dependentes info chips */}
        {(results.irsJovemDeduction > 0 || results.depsDeduction > 0) && (
          <div className="flex flex-wrap gap-3">
            {results.irsJovemDeduction > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-[10px] px-4 py-2">
                <Info size={14} className="text-blue-600 shrink-0" />
                <span className="text-[12px] font-[700] text-blue-800">IRS Jovem: isenção de {ptEur(results.irsJovemDeduction)} no rendimento coletável</span>
              </div>
            )}
            {results.depsDeduction > 0 && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-[10px] px-4 py-2">
                <Info size={14} className="text-emerald-600 shrink-0" />
                <span className="text-[12px] font-[700] text-emerald-800">Dedução dependentes (Art. 78º-A): {ptEur(results.depsDeduction)} à coleta</span>
              </div>
            )}
          </div>
        )}

        {/* Comparison cards */}
        <section>
          <div className="text-[12px] font-[800] text-[#64748B] uppercase tracking-[1px] mb-4">Folha 5 & 6 — Enquadramento Tático (Resultados)</div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* ENI CARD */}
            <div className={cn("bg-white border-2 rounded-[20px] p-6 shadow-sm flex flex-col transition-all", winner === 'ENI' ? "border-emerald-500 ring-4 ring-emerald-50" : "border-[#E2E8F0]")}>
              <h4 className="text-[18px] font-[800] text-[#0F172A] mb-6 flex items-center justify-between">Recibos Verdes (ENI)
                {winner === 'ENI' && <span className="bg-emerald-500 text-white text-[10px] font-[800] uppercase px-3 py-1 rounded-full tracking-widest">Melhor Opção</span>}
              </h4>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-[13px] font-[600] text-slate-600">IRS Agravado {results.irsJovemDeduction > 0 ? '(c/ IRS Jovem)' : ''}</span>
                  <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.eni.irs)}</span>
                </div>
                {results.depsDeduction > 0 && (
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-[13px] font-[600] text-emerald-600">Ded. Dependentes ({profile.nrDependentes}×)</span>
                    <span className="text-[15px] font-[700] text-emerald-600 font-mono">- {ptEur(results.depsDeduction)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-[13px] font-[600] text-slate-600">Seg. Social (21,4%)</span>
                  <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.eni.ss)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-[13px] font-[600] text-slate-600">Custos & Contabilidade</span>
                  <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.eni.costs)}</span>
                </div>
              </div>
              <div className="mt-auto space-y-3 bg-slate-50 p-4 rounded-[12px]">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-[700] text-slate-500 uppercase tracking-widest">Net Income (Ano 1)</span>
                  <span className="text-[20px] font-[800] text-[#0F172A]">{ptEur(results.eni.net)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-[700] text-slate-500 uppercase tracking-widest">Cash-Flow Livre Y1</span>
                  <span className="text-[18px] font-[800] text-emerald-600">{ptEur(results.eni.cashFlow)}</span>
                </div>
              </div>
            </div>

            {/* LDA CARD */}
            <div className={cn("bg-white border-2 rounded-[20px] p-6 shadow-sm flex flex-col transition-all", winner === 'LDA' ? "border-[#781D1D] ring-4 ring-[#781D1D]/10" : "border-[#E2E8F0]")}>
              <h4 className="text-[18px] font-[800] text-[#0F172A] mb-6 flex items-center justify-between">Sociedade (Lda / Unipessoal)
                {winner === 'LDA' && <span className="bg-[#781D1D] text-white text-[10px] font-[800] uppercase px-3 py-1 rounded-full tracking-widest">Melhor Opção</span>}
              </h4>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-[13px] font-[600] text-slate-600">IRC a Pagar (Lucro: {ptEur(results.lda.profit)})</span>
                  <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.lda.irc)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-[13px] font-[600] text-slate-600">TSU (Empresa 23,75% + Gestor 11%)</span>
                  <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.lda.ssComp + results.lda.ssEmp)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-[13px] font-[600] text-slate-600">Custos & Contabilidade</span>
                  <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.lda.costs)}</span>
                </div>
              </div>
              <div className="mt-auto space-y-3 bg-slate-50 p-4 rounded-[12px]">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-[700] text-slate-500 uppercase tracking-widest">Lucro Empresa + Remuneração</span>
                  <span className="text-[20px] font-[800] text-[#0F172A]">{ptEur(results.lda.net)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-[700] text-slate-500 uppercase tracking-widest">Cash-Flow Holding Y1</span>
                  <span className="text-[18px] font-[800] text-[#781D1D]">{ptEur(results.lda.cashFlow)}</span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* PPC + Retenção na fonte warning */}
        {(results.ppc > 0 || results.retencaoFonte > 0) && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.ppc > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-5">
                <div className="text-amber-800 font-[800] flex items-center gap-2 mb-2 text-[14px]">
                  <Calculator size={16}/> Pagamentos por Conta (PPC)
                </div>
                <p className="text-[13px] text-amber-900 font-[500] mb-3">Para ENI com IRS significativo, a AT exige pagamentos antecipados em julho, setembro e dezembro.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2 rounded-[8px] border border-amber-100 text-center">
                    <div className="text-[11px] text-slate-500 font-[600] uppercase">Por Prestação</div>
                    <div className="text-[15px] font-[800] text-amber-800">{ptEur(results.ppc / 3)}</div>
                  </div>
                  <div className="bg-white p-2 rounded-[8px] border border-amber-100 text-center">
                    <div className="text-[11px] text-slate-500 font-[600] uppercase">Total Anual</div>
                    <div className="text-[15px] font-[800] text-amber-800">{ptEur(results.ppc)}</div>
                  </div>
                </div>
              </div>
            )}
            {results.retencaoFonte > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-[16px] p-5">
                <div className="text-blue-800 font-[800] flex items-center gap-2 mb-2 text-[14px]">
                  <Info size={16}/> Retenção na Fonte (ENI Serviços)
                </div>
                <p className="text-[13px] text-blue-900 font-[500] mb-3">Clientes empresa retêm 11,5% nas faturas de prestação de serviços. Valor a regularizar em IRS.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2 rounded-[8px] border border-blue-100 text-center">
                    <div className="text-[11px] text-slate-500 font-[600] uppercase">Taxa</div>
                    <div className="text-[15px] font-[800] text-blue-800">11,5%</div>
                  </div>
                  <div className="bg-white p-2 rounded-[8px] border border-blue-100 text-center">
                    <div className="text-[11px] text-slate-500 font-[600] uppercase">Valor Retido / Ano</div>
                    <div className="text-[15px] font-[800] text-blue-800">{ptEur(results.retencaoFonte)}</div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Break-even + IVA advice */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pb-12 w-full">
          <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-6 shadow-sm h-full">
            <div className="text-amber-800 font-[800] flex items-center gap-2 mb-3"><PieChart size={20}/> Pontos de Equilíbrio (Break Even)</div>
            <p className="text-[13.5px] leading-relaxed text-amber-900 font-[500] mb-4">Faturação mínima para cobrir todos os custos e iniciar lucro:</p>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded-[8px] flex justify-between items-center border border-amber-100">
                <span className="text-[12px] font-[600] text-slate-500 uppercase">Numa Empresa</span>
                <strong className="font-mono">{ptEur(results.beLda)} <span className="font-sans text-[11px] text-slate-400">/ano</span></strong>
              </div>
              <div className="bg-white p-3 rounded-[8px] flex justify-between items-center border border-amber-100">
                <span className="text-[12px] font-[600] text-slate-500 uppercase">Nos Recibos</span>
                <strong className="font-mono">{ptEur(results.beEni)} <span className="font-sans text-[11px] text-slate-400">/ano</span></strong>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-[#CBD5E1] rounded-[20px] p-6 shadow-sm h-full flex flex-col">
            <div className="text-slate-800 font-[800] flex items-center gap-2 mb-3"><ShieldAlert size={20}/> Parecer Tributário — IVA</div>
            <p className="text-[13.5px] leading-relaxed text-slate-700 font-[500] flex-1">
              {rev <= 15000 && !b2b
                ? "Atendendo ao volume previsto (<15k€) e o target ser B2C, a métrica fiscal indica firmemente acionar a exclusão do Artigo 53º do CIVA. Os seus preços ficarão isentos (+baratos que a concorrência) perdendo capacidade de deduzir em gastos."
                : "Não é viável a isenção de IVA para este enquadramento, sendo alvo Obrigatório do IVA Regime Normal mensal/trimestral — e vantajoso, na perspetiva B2B que tem, podendo recuperar grandes valias do Investimento Inicial (CapEx)."}
            </p>
            {isSeasonal && <div className="mt-4 text-[12px] text-red-600 bg-red-50 p-2 rounded-[6px] font-[600]">⚠️ Sazonalidade detetada: Fundo de Maneio ({ptEur(invFundo)}) pode ser insuficiente p/ cobrir custos fixos nos trimestres sem vendas.</div>}
          </div>
        </section>

      </div>
    </div>
  );
}
