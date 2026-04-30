import React, { useMemo } from 'react';
import {
  RefreshCw, TrendingUp, CheckCircle2, Calculator, Briefcase, PieChart, ShieldAlert,
  User, Info, Layers, Activity, Hash, Package, DollarSign, Crown, Globe, Target,
  Coins, UserCheck, Settings, BarChart2, CircleUser, UserRound
} from 'lucide-react';
import { cn } from './lib/utils';
import { useTheme } from './ThemeContext';
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
  transparenciaFiscal: boolean;
}

interface Props {
  initialState: TaxSimulatorState;
  onStateChange: (state: TaxSimulatorState) => void;
  profile: ClientProfile;
}

export default function TaxSimulator({ initialState, onStateChange, profile }: Props) {
  const { simMode } = useTheme();
  const {
    profSit, currentInc, age, isMainAct, monthlyNeed,
    isServices, b2b, rev, isSeasonal,
    invEquip, invLic, invWorks, invFundo,
    fixedMo, varYr, accMoLda, accMoEni, anosAtividade,
    transparenciaFiscal = false,
  } = initialState;

  const setState = (updates: Partial<TaxSimulatorState>) => {
    onStateChange({ ...initialState, ...updates });
  };

  /* ── Icons per mode ── */
  const [I1, I2, I3, I4] = (
    simMode === 'split'   ? [User,       Briefcase,  TrendingUp, Calculator] :
    simMode === 'stacked' ? [CircleUser, Layers,     Activity,   Hash] :
    simMode === 'mosaic'  ? [UserCheck,  Package,    BarChart2,  PieChart] :
    simMode === 'compact' ? [UserRound,  Target,     Coins,      Settings] :
                            [Crown,      Globe,      TrendingUp, DollarSign]
  ) as [React.ComponentType<{className?:string}>, React.ComponentType<{className?:string}>, React.ComponentType<{className?:string}>, React.ComponentType<{className?:string}>];

  /* ── Shared CSS ── */
  const inputCls = "w-full px-3 py-[10px] bg-[#F1F5F9] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] focus:border-[#4F46E5] outline-none mt-1 transition-all focus:bg-white";
  const lblCls   = "text-[11px] font-[700] uppercase tracking-[0.5px] text-[#475569] leading-tight";
  const hdrIcon  = "w-5 h-5 opacity-80 mr-2 inline-block -mt-0.5";

  /* ── Results calculation (unchanged) ── */
  const results = useMemo(() => {
    const totalInv = invEquip + invLic + invWorks + invFundo;
    const invCapex = invEquip + invLic + invWorks;
    const fixedYr  = fixedMo * 12;
    const accYrLda = accMoLda * 12;
    const accYrEni = accMoEni * 12;
    const dpNaoAceite = invCapex * 0.25;
    const costsLdaOutPocket = fixedYr + varYr + accYrLda;
    const costsEniOutPocket = fixedYr + varYr + accYrEni;

    let eniSS = 0;
    if (profSit === 'tco' && !isMainAct && rev <= 20000) {
      eniSS = 0;
    } else {
      eniSS = rev * (isServices ? 0.70 : 0.20) * 0.214;
    }

    let eniRendColetavel = rev * (isServices ? 0.75 : 0.15);
    if (isServices && rev > 27360) {
      const requiredJustDocs = rev * 0.15;
      const justDocsPresented = costsEniOutPocket + 4104;
      if (justDocsPresented < requiredJustDocs) {
        eniRendColetavel += (requiredJustDocs - justDocsPresented);
      }
    }

    let irsJovemDeduction = 0;
    if (profile.beneficioJovem && profile.idade <= 35) {
      irsJovemDeduction = calcIRSJovem(anosAtividade, eniRendColetavel, profile.idade);
      eniRendColetavel = Math.max(0, eniRendColetavel - irsJovemDeduction);
    }

    const eniIRS_Total   = calculateIRS(currentInc + eniRendColetavel);
    const eniIRS_Current = calculateIRS(currentInc);
    const depsDeduction  = calcDependentsDeduction(profile.nrDependentes);
    let eniIRS = Math.max(0, eniIRS_Total - eniIRS_Current - depsDeduction);

    const ppc          = eniIRS * 0.25;
    const retencaoFonte = isServices ? rev * 0.115 : 0;
    const eniNet       = rev - costsEniOutPocket - eniSS - eniIRS;
    const eniCashFlow  = eniNet - totalInv;

    const rawGross     = monthlyNeed / 0.70;
    const grossSalaryYr = rawGross * 14;
    const ldaSSCompany = grossSalaryYr * 0.2375;
    const ldaSSManager = grossSalaryYr * 0.11;
    const ldaIRSManager = calculateIRS(grossSalaryYr);
    const profit = rev - costsLdaOutPocket - dpNaoAceite - grossSalaryYr - ldaSSCompany;

    let irc = 0;
    let transparenciaIRSOnProfit = 0;
    if (transparenciaFiscal) {
      if (profit > 0) {
        transparenciaIRSOnProfit = Math.max(0,
          calculateIRS(grossSalaryYr + profit) - calculateIRS(grossSalaryYr)
        );
      }
    } else if (profit > 0) {
      irc = profit <= 50000 ? profit * 0.15 : (50000 * 0.15) + ((profit - 50000) * 0.19);
    }

    const companyNetEarnings = profit - irc - transparenciaIRSOnProfit;
    const ldaBusinessNet = companyNetEarnings + (monthlyNeed * 12);
    const ldaCashFlow = (companyNetEarnings + dpNaoAceite) - totalInv;

    const varMargin = rev > 0 ? (rev - varYr) / rev : 0.01;
    const beEni = varMargin > 0 ? (fixedYr + accYrEni) / varMargin : 0;
    const beLda = varMargin > 0 ? (fixedYr + accYrLda + grossSalaryYr + ldaSSCompany) / varMargin : 0;

    return {
      totalInv, beEni, beLda, irsJovemDeduction, depsDeduction, ppc, retencaoFonte,
      transparenciaFiscal, transparenciaIRSOnProfit,
      eni: { ss: eniSS, irs: eniIRS, net: eniNet, cashFlow: eniCashFlow, costs: costsEniOutPocket, rendColetavel: eniRendColetavel },
      lda: { ssComp: ldaSSCompany, ssEmp: ldaSSManager, irc, irs: ldaIRSManager, net: ldaBusinessNet, cashFlow: ldaCashFlow, profit: companyNetEarnings, costs: costsLdaOutPocket }
    };
  }, [profSit, currentInc, age, isMainAct, monthlyNeed, isServices, b2b, rev, isSeasonal,
      invEquip, invLic, invWorks, invFundo, fixedMo, varYr, accMoLda, accMoEni,
      anosAtividade, transparenciaFiscal, profile.beneficioJovem, profile.idade, profile.nrDependentes]);

  const ptEur  = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.max(0, v));
  const winner = results.lda.net > results.eni.net ? 'LDA' : 'ENI';
  const diff   = Math.abs(results.lda.net - results.eni.net);

  const resetAll = () => {
    onStateChange({
      profSit: profile.tipoEntidade === 'eni' ? 'outro' : 'tco',
      currentInc: 25000, age: profile.idade,
      isMainAct: profile.tipoEntidade !== 'eni', monthlyNeed: 1500,
      isServices: profile.atividadePrincipal === 'servicos', b2b: true,
      rev: profile.faturaçaoAnualPrevista, isSeasonal: profile.isSazonal,
      invEquip: 3000, invLic: 500, invWorks: 1000, invFundo: 2000,
      fixedMo: 400, varYr: 5000, accMoLda: 200, accMoEni: 50,
      anosAtividade: Math.max(0, new Date().getFullYear() - profile.inicioAtividade),
      transparenciaFiscal: profile.regimeContabilidade === 'transparencia_fiscal',
    });
  };

  /* ════════════════════════════════════════════════
     SHARED SECTION JSX (reused across all modes)
  ════════════════════════════════════════════════ */
  const sectionHeader = (icon: React.ReactNode, title: string) => (
    <h3 className="text-[14px] font-[800] text-[#781D1D] mb-4 flex items-center border-b pb-2">
      {icon}{title}
    </h3>
  );

  const folha1 = (
    <div>
      {sectionHeader(<I1 className={hdrIcon}/>, 'Folha 1 — Dados do Promotor')}
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
          <label className={lblCls}>Subsistência / Mês</label>
          <input type="number" value={monthlyNeed} onChange={e=>setState({monthlyNeed: Number(e.target.value)})} className={inputCls} />
        </div>
        {profile.beneficioJovem && profile.idade <= 35 && (
          <div className="col-span-2">
            <label className={lblCls}>Anos de Atividade (IRS Jovem)</label>
            <input type="number" min={0} max={5} value={anosAtividade} onChange={e=>setState({anosAtividade: Number(e.target.value)})} className={inputCls} />
            <p className="text-[11px] text-blue-600 mt-1 font-[600]">Art. 12º-B CIRS. 0 = 1º ano.</p>
          </div>
        )}
      </div>
    </div>
  );

  const folha2 = (
    <div>
      {sectionHeader(<I2 className={hdrIcon}/>, 'Folha 2 — O Negócio')}
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
        <label className="col-span-2 flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-[8px] cursor-pointer hover:bg-amber-100 transition-colors">
          <input type="checkbox" checked={isSeasonal} onChange={e=>setState({isSeasonal: e.target.checked})} className="mt-1 w-4 h-4 accent-amber-600" />
          <span className="text-[12px] font-[600] text-amber-900 leading-snug">Negócio Sazonal</span>
        </label>
        <label className={cn("col-span-2 flex items-start gap-3 p-3 border rounded-[8px] cursor-pointer transition-colors", transparenciaFiscal ? "bg-purple-50 border-purple-300" : "bg-slate-50 border-slate-200")}>
          <input type="checkbox" checked={transparenciaFiscal} onChange={e=>setState({transparenciaFiscal: e.target.checked})} className="mt-1 w-4 h-4 accent-purple-600" />
          <div>
            <span className="text-[12px] font-[700] text-slate-800 block">Transparência Fiscal (Art. 6.º CIRC)</span>
            <span className="text-[11px] text-slate-500 font-[500]">Empresa sem IRC — lucro tributado em IRS do sócio.</span>
          </div>
        </label>
      </div>
    </div>
  );

  const folha3 = (
    <div>
      {sectionHeader(<I3 className={hdrIcon}/>, 'Folha 3 — Investimento Inicial')}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <div><label className={lblCls}>Equipamento/Tech</label><input type="number" value={invEquip} onChange={e=>setState({invEquip: Number(e.target.value)})} className={inputCls} /></div>
        <div><label className={lblCls}>Licenças / Registo</label><input type="number" value={invLic} onChange={e=>setState({invLic: Number(e.target.value)})} className={inputCls} /></div>
        <div><label className={lblCls}>Obras / Espaço</label><input type="number" value={invWorks} onChange={e=>setState({invWorks: Number(e.target.value)})} className={inputCls} /></div>
        <div><label className={lblCls}>Fundo de Maneio</label><input type="number" value={invFundo} onChange={e=>setState({invFundo: Number(e.target.value)})} className={inputCls} /></div>
        <div className="col-span-2 flex justify-between items-center bg-slate-50 p-3 rounded-[8px] border border-slate-100">
          <span className="text-[12px] font-[700] text-slate-500 uppercase">Total CapEx</span>
          <span className="text-[16px] font-[800] text-slate-800">{ptEur(results.totalInv)}</span>
        </div>
      </div>
    </div>
  );

  const folha4 = (
    <div>
      {sectionHeader(<I4 className={hdrIcon}/>, 'Folha 4 — Controlo de Custos')}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <div><label className={lblCls}>Custos Fixos / Mês</label><input type="number" value={fixedMo} onChange={e=>setState({fixedMo: Number(e.target.value)})} className={inputCls} /></div>
        <div><label className={lblCls}>Custos Prod. / Ano</label><input type="number" value={varYr} onChange={e=>setState({varYr: Number(e.target.value)})} className={inputCls} /></div>
        <div><label className={lblCls}>Contabilidade Lda/Mês</label><input type="number" value={accMoLda} onChange={e=>setState({accMoLda: Number(e.target.value)})} className={inputCls} /></div>
        <div><label className={lblCls}>Contabilidade ENI/Mês</label><input type="number" value={accMoEni} onChange={e=>setState({accMoEni: Number(e.target.value)})} className={inputCls} /></div>
      </div>
    </div>
  );

  const winnerBanner = (
    <section className={cn("p-6 rounded-[20px] border-2 flex flex-col md:flex-row items-start gap-4 shadow-sm",
      winner === 'LDA' ? "bg-[#FDF2F2] border-[#F8B4B4]" : "bg-emerald-50 border-emerald-200")}>
      <div className={cn("p-3 rounded-[14px]", winner === 'LDA' ? "bg-[#FDE8E8] text-[#781D1D]" : "bg-emerald-100 text-emerald-600")}>
        <CheckCircle2 className="w-7 h-7"/>
      </div>
      <div className="flex-1">
        <div className="text-[11px] font-[800] uppercase tracking-[1px] mb-1 opacity-70">Parecer & Conclusão</div>
        <h3 className={cn("text-[20px] font-[800] tracking-tight mb-2", winner === 'LDA' ? "text-[#781D1D]" : "text-emerald-900")}>
          Regime Ideal: {winner === 'LDA' ? 'Sociedade Unipessoal / Lda' : 'Trabalhador Independente (ENI)'}
        </h3>
        <p className={cn("text-[14px] leading-relaxed font-[500]", winner === 'LDA' ? "text-[#5A1313]" : "text-emerald-800")}>
          {ptEur(rev)} faturados → <strong>{winner === 'LDA' ? 'Empresa' : 'Atividade Pessoal'}</strong> maximiza {ptEur(diff)} adicionais/ano.
          {profile.beneficioJovem && profile.idade <= 35 && results.irsJovemDeduction > 0 &&
            ` IRS Jovem reduz rendimento coletável em ${ptEur(results.irsJovemDeduction)}.`
          }
        </p>
      </div>
    </section>
  );

  const irsChips = (results.irsJovemDeduction > 0 || results.depsDeduction > 0) && (
    <div className="flex flex-wrap gap-3">
      {results.irsJovemDeduction > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-[10px] px-4 py-2">
          <Info size={13} className="text-blue-600 shrink-0" />
          <span className="text-[12px] font-[700] text-blue-800">IRS Jovem: isenção de {ptEur(results.irsJovemDeduction)} no rendimento coletável</span>
        </div>
      )}
      {results.depsDeduction > 0 && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-[10px] px-4 py-2">
          <Info size={13} className="text-emerald-600 shrink-0" />
          <span className="text-[12px] font-[700] text-emerald-800">Dedução dependentes: {ptEur(results.depsDeduction)} à coleta</span>
        </div>
      )}
    </div>
  );

  const eniCard = (
    <div className={cn("bg-white border-2 rounded-[20px] p-6 shadow-sm flex flex-col", winner === 'ENI' ? "border-emerald-500 ring-4 ring-emerald-50" : "border-[#E2E8F0]")}>
      <h4 className="text-[18px] font-[800] text-[#0F172A] mb-5 flex items-center justify-between">Recibos Verdes (ENI)
        {winner === 'ENI' && <span className="bg-emerald-500 text-white text-[10px] font-[800] uppercase px-3 py-1 rounded-full tracking-widest">Melhor Opção</span>}
      </h4>
      <div className="space-y-3 mb-6 flex-1">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <span className="text-[13px] font-[600] text-slate-600">IRS Agravado {results.irsJovemDeduction > 0 ? '(c/ IRS Jovem)' : ''}</span>
          <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.eni.irs)}</span>
        </div>
        {results.depsDeduction > 0 && (
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="text-[13px] font-[600] text-emerald-600">Ded. Dependentes ({profile.nrDependentes}×)</span>
            <span className="text-[15px] font-[700] text-emerald-600 font-mono">- {ptEur(results.depsDeduction)}</span>
          </div>
        )}
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <span className="text-[13px] font-[600] text-slate-600">Seg. Social (21,4%)</span>
          <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.eni.ss)}</span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <span className="text-[13px] font-[600] text-slate-600">Custos & Contabilidade</span>
          <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.eni.costs)}</span>
        </div>
      </div>
      <div className="bg-slate-50 p-4 rounded-[12px] space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-[700] text-slate-500 uppercase tracking-widest">Net Income Ano 1</span>
          <span className="text-[20px] font-[800] text-[#0F172A]">{ptEur(results.eni.net)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-[700] text-slate-500 uppercase tracking-widest">Cash-Flow Livre Y1</span>
          <span className="text-[18px] font-[800] text-emerald-600">{ptEur(results.eni.cashFlow)}</span>
        </div>
      </div>
    </div>
  );

  const ldaCard = (
    <div className={cn("bg-white border-2 rounded-[20px] p-6 shadow-sm flex flex-col", winner === 'LDA' ? "border-[#781D1D] ring-4 ring-[#781D1D]/10" : "border-[#E2E8F0]")}>
      <h4 className="text-[18px] font-[800] text-[#0F172A] mb-2 flex items-center justify-between">
        Sociedade {results.transparenciaFiscal ? '(Transp. Fiscal)' : '(Lda / Unipessoal)'}
        {winner === 'LDA' && <span className="bg-[#781D1D] text-white text-[10px] font-[800] uppercase px-3 py-1 rounded-full tracking-widest">Melhor Opção</span>}
      </h4>
      {results.transparenciaFiscal && (
        <div className="mb-4 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-[8px] px-3 py-2">
          <span className="text-[10px] font-[800] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">Art. 6.º CIRC</span>
          <span className="text-[11px] text-purple-800 font-[600]">Empresa sem IRC — lucro tributado como IRS do sócio</span>
        </div>
      )}
      <div className="space-y-3 mb-6 flex-1">
        {results.transparenciaFiscal ? (
          <>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-[13px] font-[600] text-purple-700">IRC (isento — Transparência Fiscal)</span>
              <span className="text-[15px] font-[700] text-purple-700 font-mono">0 €</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-[13px] font-[600] text-slate-600">IRS sobre lucro imputado</span>
              <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.transparenciaIRSOnProfit)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="text-[13px] font-[600] text-slate-600">IRC (Lucro: {ptEur(results.lda.profit + results.lda.irc)})</span>
            <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.lda.irc)}</span>
          </div>
        )}
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <span className="text-[13px] font-[600] text-slate-600">TSU (23,75% + 11%)</span>
          <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.lda.ssComp + results.lda.ssEmp)}</span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <span className="text-[13px] font-[600] text-slate-600">Custos & Contabilidade</span>
          <span className="text-[15px] font-[700] text-slate-800 font-mono">{ptEur(results.lda.costs)}</span>
        </div>
      </div>
      <div className="bg-slate-50 p-4 rounded-[12px] space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-[700] text-slate-500 uppercase tracking-widest">Lucro + Remuneração</span>
          <span className="text-[20px] font-[800] text-[#0F172A]">{ptEur(results.lda.net)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-[700] text-slate-500 uppercase tracking-widest">Cash-Flow Holding Y1</span>
          <span className="text-[18px] font-[800] text-[#781D1D]">{ptEur(results.lda.cashFlow)}</span>
        </div>
      </div>
    </div>
  );

  const extras = (
    <>
      {(results.ppc > 0 || results.retencaoFonte > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.ppc > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-5">
              <div className="text-amber-800 font-[800] flex items-center gap-2 mb-2 text-[13px]"><Calculator size={15}/> Pagamentos por Conta (PPC)</div>
              <p className="text-[12px] text-amber-900 font-[500] mb-3">Pagamentos antecipados em julho, setembro e dezembro.</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-2 rounded-[8px] border border-amber-100 text-center">
                  <div className="text-[10px] text-slate-500 font-[600] uppercase">Por Prestação</div>
                  <div className="text-[14px] font-[800] text-amber-800">{ptEur(results.ppc / 3)}</div>
                </div>
                <div className="bg-white p-2 rounded-[8px] border border-amber-100 text-center">
                  <div className="text-[10px] text-slate-500 font-[600] uppercase">Total Anual</div>
                  <div className="text-[14px] font-[800] text-amber-800">{ptEur(results.ppc)}</div>
                </div>
              </div>
            </div>
          )}
          {results.retencaoFonte > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-[16px] p-5">
              <div className="text-blue-800 font-[800] flex items-center gap-2 mb-2 text-[13px]"><Info size={15}/> Retenção na Fonte ENI (11,5%)</div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-white p-2 rounded-[8px] border border-blue-100 text-center">
                  <div className="text-[10px] text-slate-500 font-[600] uppercase">Taxa</div>
                  <div className="text-[14px] font-[800] text-blue-800">11,5%</div>
                </div>
                <div className="bg-white p-2 rounded-[8px] border border-blue-100 text-center">
                  <div className="text-[10px] text-slate-500 font-[600] uppercase">Valor / Ano</div>
                  <div className="text-[14px] font-[800] text-blue-800">{ptEur(results.retencaoFonte)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-6 shadow-sm">
          <div className="text-amber-800 font-[800] flex items-center gap-2 mb-3"><PieChart size={18}/> Break-Even</div>
          <div className="space-y-2">
            <div className="bg-white p-3 rounded-[8px] flex justify-between items-center border border-amber-100">
              <span className="text-[12px] font-[600] text-slate-500 uppercase">Empresa</span>
              <strong className="font-mono text-[14px]">{ptEur(results.beLda)}<span className="text-[11px] text-slate-400 font-sans">/ano</span></strong>
            </div>
            <div className="bg-white p-3 rounded-[8px] flex justify-between items-center border border-amber-100">
              <span className="text-[12px] font-[600] text-slate-500 uppercase">Recibos Verdes</span>
              <strong className="font-mono text-[14px]">{ptEur(results.beEni)}<span className="text-[11px] text-slate-400 font-sans">/ano</span></strong>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 border border-[#CBD5E1] rounded-[20px] p-6 shadow-sm flex flex-col">
          <div className="text-slate-800 font-[800] flex items-center gap-2 mb-3"><ShieldAlert size={18}/> Parecer IVA</div>
          <p className="text-[13px] leading-relaxed text-slate-700 font-[500] flex-1">
            {rev <= 15000 && !b2b
              ? "Volume <15k€ e B2C — recomenda-se isenção Art. 53º CIVA."
              : "Enquadramento B2B e volume elevado — IVA Normal recomendado (permite recuperação do CapEx)."}
          </p>
          {isSeasonal && <div className="mt-3 text-[12px] text-red-600 bg-red-50 p-2 rounded-[6px] font-[600]">⚠ Sazonalidade: Fundo de Maneio pode ser insuficiente nos trimestres sem vendas.</div>}
        </div>
      </div>
    </>
  );

  /* ════════════════════════════════════════════════
     MODE 0 — SPLIT (left inputs / right results)
  ════════════════════════════════════════════════ */
  if (simMode === 'split') {
    return (
      <div className="h-full flex flex-col xl:flex-row bg-[#F8FAFC]">
        <div className="xl:w-[480px] shrink-0 bg-white border-r border-[#E2E8F0] overflow-y-auto h-full flex flex-col">
          <div className="p-6 md:p-8 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#F1F5F9]">
            <div>
              <h2 className="text-[20px] font-[800] tracking-[-0.5px] text-[#0F172A]">Recofatima Simuladores</h2>
              <div className="text-[11px] font-[700] uppercase tracking-[1px] text-[#4F46E5] mt-1">Estudo de Negócio • OE 2026</div>
            </div>
            <button onClick={resetAll} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-[8px] transition-colors" title="Repor"><RefreshCw size={18} /></button>
          </div>
          <div className="p-6 md:p-8 space-y-10">
            {folha1}{folha2}{folha3}{folha4}
          </div>
        </div>

        <div className="flex-1 p-6 md:p-10 overflow-y-auto w-full flex flex-col gap-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[32px] md:text-[40px] font-[800] tracking-[-1.5px] text-[#0F172A] leading-[1.1]">Dashboard Decision Financeiro</h1>
              <p className="text-[15px] font-[500] text-[#64748B] mt-1">Cálculo preditivo OE 2026.</p>
            </div>
          </div>
          {winnerBanner}{irsChips}
          <div className="text-[11px] font-[800] text-[#64748B] uppercase tracking-[1px]">Folha 5 & 6 — Enquadramento Tático (Resultados)</div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">{eniCard}{ldaCard}</div>
          {extras}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════
     MODE 1 — STACKED (inputs 2×2 grid, results below)
  ════════════════════════════════════════════════ */
  if (simMode === 'stacked') {
    return (
      <div className="h-full overflow-y-auto bg-[#F0F4F8]">
        {/* Sticky summary bar */}
        <div className="sticky top-0 z-20 bg-[#111827] text-white px-6 py-3 flex items-center gap-6 shadow-lg">
          <span className={cn("text-[11px] font-[900] uppercase tracking-[2px] px-3 py-1 rounded-full",
            winner === 'LDA' ? "bg-[#781D1D]" : "bg-emerald-600")}>{winner}</span>
          <div className="flex gap-6 text-[12px]">
            <span className="text-slate-400">ENI: <strong className="text-white">{ptEur(results.eni.net)}</strong></span>
            <span className="text-slate-400">LDA: <strong className="text-white">{ptEur(results.lda.net)}</strong></span>
            <span className="text-slate-400">Δ: <strong className="text-amber-400">{ptEur(diff)}</strong></span>
          </div>
          <button onClick={resetAll} className="ml-auto text-slate-400 hover:text-white p-1 rounded transition-colors"><RefreshCw size={16} /></button>
        </div>

        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          <h2 className="text-[18px] font-[800] text-[#0F172A]">Dados de Entrada</h2>

          {/* 2×2 grid of input cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[folha1, folha2, folha3, folha4].map((section, i) => (
              <div key={i} className="bg-white rounded-[20px] border border-slate-200 p-6 shadow-sm">{section}</div>
            ))}
          </div>

          <h2 className="text-[18px] font-[800] text-[#0F172A] pt-4">Resultados</h2>
          {winnerBanner}{irsChips}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{eniCard}{ldaCard}</div>
          {extras}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════
     MODE 2 — MOSAIC (3-col card grid, all mixed)
  ════════════════════════════════════════════════ */
  if (simMode === 'mosaic') {
    return (
      <div className="h-full overflow-y-auto bg-[#F0FDF4] p-5">
        <div className="max-w-7xl mx-auto">
          {/* Header row */}
          <div className="flex items-center gap-4 mb-5">
            <h1 className="text-[22px] font-[800] text-[#064E3B] tracking-tight">Enquadramento Fiscal 2026</h1>
            <div className={cn("ml-auto px-4 py-1.5 rounded-full text-[12px] font-[800] uppercase tracking-wider",
              winner === 'LDA' ? "bg-[#781D1D] text-white" : "bg-emerald-600 text-white")}>
              {winner === 'LDA' ? 'Sociedade vence' : 'ENI vence'} por {ptEur(diff)}
            </div>
            <button onClick={resetAll} className="p-2 rounded-[8px] text-slate-500 hover:text-slate-900 hover:bg-white transition-colors"><RefreshCw size={16}/></button>
          </div>

          {/* Mosaic grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Input cards */}
            <div className="bg-white rounded-[20px] border border-emerald-100 p-5 shadow-sm">{folha1}</div>
            <div className="bg-white rounded-[20px] border border-emerald-100 p-5 shadow-sm">{folha2}</div>

            {/* Winner summary card */}
            <div className={cn("rounded-[20px] p-5 shadow-sm", winner === 'LDA' ? "bg-[#781D1D] text-white" : "bg-emerald-600 text-white")}>
              <div className="text-[11px] font-[800] uppercase tracking-[2px] opacity-80 mb-2">Regime Ideal</div>
              <div className="text-[28px] font-[900] leading-none mb-3">{winner === 'LDA' ? 'Sociedade' : 'ENI'}</div>
              <div className="space-y-2 opacity-90">
                <div className="flex justify-between text-[13px]"><span>ENI Net</span><strong>{ptEur(results.eni.net)}</strong></div>
                <div className="flex justify-between text-[13px]"><span>LDA Net</span><strong>{ptEur(results.lda.net)}</strong></div>
                <div className="h-px bg-white/30 my-1" />
                <div className="flex justify-between text-[13px]"><span>Vantagem</span><strong>{ptEur(diff)}</strong></div>
              </div>
              {irsChips && <div className="mt-4 text-[11px] opacity-80">✓ Benefícios fiscais activos</div>}
            </div>

            <div className="bg-white rounded-[20px] border border-emerald-100 p-5 shadow-sm">{folha3}</div>
            <div className="bg-white rounded-[20px] border border-emerald-100 p-5 shadow-sm">{folha4}</div>

            {/* Break-even card */}
            <div className="bg-amber-50 rounded-[20px] border border-amber-200 p-5 shadow-sm">
              <div className="text-[13px] font-[800] text-amber-800 mb-4 flex items-center gap-2"><PieChart size={16}/> Break-Even</div>
              <div className="space-y-3">
                <div className="bg-white rounded-[12px] p-3 border border-amber-100">
                  <div className="text-[10px] text-slate-500 uppercase font-[700]">Empresa</div>
                  <div className="text-[20px] font-[800] text-amber-800">{ptEur(results.beLda)}</div>
                </div>
                <div className="bg-white rounded-[12px] p-3 border border-amber-100">
                  <div className="text-[10px] text-slate-500 uppercase font-[700]">Recibos Verdes</div>
                  <div className="text-[20px] font-[800] text-amber-800">{ptEur(results.beEni)}</div>
                </div>
              </div>
            </div>

            {/* ENI card */}
            <div className="md:col-span-2 xl:col-span-1">{eniCard}</div>
            {/* LDA card */}
            <div className="md:col-span-2 xl:col-span-1">{ldaCard}</div>

            {/* IVA advisory */}
            <div className="bg-slate-50 rounded-[20px] border border-slate-200 p-5 shadow-sm">
              <div className="text-[13px] font-[800] text-slate-800 mb-3 flex items-center gap-2"><ShieldAlert size={16}/> Parecer IVA</div>
              <p className="text-[13px] text-slate-700 font-[500] leading-relaxed">
                {rev <= 15000 && !b2b
                  ? "Volume <15k€ e B2C — Art. 53º CIVA pode ser vantajoso."
                  : "IVA Normal recomendado para este enquadramento B2B."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════
     MODE 3 — COMPACT (narrow single column, dense)
  ════════════════════════════════════════════════ */
  if (simMode === 'compact') {
    const compactInput = "w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-[6px] text-[13px] font-[600] text-[#0F172A] focus:border-slate-500 outline-none";
    const compactLbl = "text-[10px] font-[700] uppercase tracking-[0.5px] text-slate-500";
    return (
      <div className="h-full overflow-y-auto bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {/* Compact header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-[16px] font-[800] text-[#0F172A]">Enquadramento Fiscal</h2>
            <button onClick={resetAll} className="p-1.5 rounded text-slate-400 hover:text-slate-700 transition-colors"><RefreshCw size={14}/></button>
          </div>

          {/* Compact results summary */}
          <div className="bg-[#0F172A] rounded-[16px] p-4 grid grid-cols-3 gap-3 text-white">
            <div className="text-center">
              <div className="text-[10px] uppercase font-[700] opacity-60 mb-1">Regime</div>
              <div className={cn("text-[14px] font-[900] px-2 py-0.5 rounded-full inline-block", winner === 'LDA' ? "bg-[#781D1D]" : "bg-emerald-500")}>{winner}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase font-[700] opacity-60 mb-1">ENI Net</div>
              <div className="text-[13px] font-[800]">{ptEur(results.eni.net)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase font-[700] opacity-60 mb-1">LDA Net</div>
              <div className="text-[13px] font-[800]">{ptEur(results.lda.net)}</div>
            </div>
          </div>

          {/* Compact input fields */}
          {[
            { title: 'Promotor', icon: <I1 size={14} className="inline mr-1"/>, content: (
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><label className={compactLbl}>Situação</label>
                  <select value={profSit} onChange={e=>setState({profSit: e.target.value})} className={compactInput}>
                    <option value="tco">TCO</option><option value="desempregado">Desempregado</option><option value="outro">ENI</option>
                  </select></div>
                <div><label className={compactLbl}>Idade</label><input type="number" value={age} onChange={e=>setState({age: Number(e.target.value)})} className={compactInput} /></div>
                <div><label className={compactLbl}>Rend. Atual/Ano</label><input type="number" value={currentInc} onChange={e=>setState({currentInc: Number(e.target.value)})} className={compactInput} /></div>
                <div><label className={compactLbl}>Subsist./Mês</label><input type="number" value={monthlyNeed} onChange={e=>setState({monthlyNeed: Number(e.target.value)})} className={compactInput} /></div>
              </div>
            )},
            { title: 'Negócio', icon: <I2 size={14} className="inline mr-1"/>, content: (
              <div className="grid grid-cols-2 gap-2">
                <div><label className={compactLbl}>Tipo</label><select value={isServices ? 'svc' : 'prod'} onChange={e=>setState({isServices: e.target.value==='svc'})} className={compactInput}><option value="svc">Serviços</option><option value="prod">Bens</option></select></div>
                <div><label className={compactLbl}>Público</label><select value={b2b ? 'b2b' : 'b2c'} onChange={e=>setState({b2b: e.target.value==='b2b'})} className={compactInput}><option value="b2b">B2B</option><option value="b2c">B2C</option></select></div>
                <div className="col-span-2"><label className={compactLbl}>Faturação Ano 1</label><input type="number" value={rev} onChange={e=>setState({rev: Number(e.target.value)})} className={compactInput} /></div>
              </div>
            )},
            { title: 'Investimento', icon: <I3 size={14} className="inline mr-1"/>, content: (
              <div className="grid grid-cols-2 gap-2">
                <div><label className={compactLbl}>Equipamento</label><input type="number" value={invEquip} onChange={e=>setState({invEquip: Number(e.target.value)})} className={compactInput} /></div>
                <div><label className={compactLbl}>Licenças</label><input type="number" value={invLic} onChange={e=>setState({invLic: Number(e.target.value)})} className={compactInput} /></div>
                <div><label className={compactLbl}>Obras</label><input type="number" value={invWorks} onChange={e=>setState({invWorks: Number(e.target.value)})} className={compactInput} /></div>
                <div><label className={compactLbl}>Fundo Maneio</label><input type="number" value={invFundo} onChange={e=>setState({invFundo: Number(e.target.value)})} className={compactInput} /></div>
              </div>
            )},
            { title: 'Custos', icon: <I4 size={14} className="inline mr-1"/>, content: (
              <div className="grid grid-cols-2 gap-2">
                <div><label className={compactLbl}>Fixos/Mês</label><input type="number" value={fixedMo} onChange={e=>setState({fixedMo: Number(e.target.value)})} className={compactInput} /></div>
                <div><label className={compactLbl}>Prod./Ano</label><input type="number" value={varYr} onChange={e=>setState({varYr: Number(e.target.value)})} className={compactInput} /></div>
                <div><label className={compactLbl}>Cont. Lda/Mês</label><input type="number" value={accMoLda} onChange={e=>setState({accMoLda: Number(e.target.value)})} className={compactInput} /></div>
                <div><label className={compactLbl}>Cont. ENI/Mês</label><input type="number" value={accMoEni} onChange={e=>setState({accMoEni: Number(e.target.value)})} className={compactInput} /></div>
              </div>
            )},
          ].map(({ title, icon, content }, i) => (
            <div key={i} className="border border-slate-100 rounded-[12px] p-3">
              <div className="text-[12px] font-[800] text-[#781D1D] mb-2">{icon}{title}</div>
              {content}
            </div>
          ))}

          {/* Full results */}
          <div className="pt-2 space-y-3">
            {winnerBanner}
            {irsChips}
            <div className="grid grid-cols-1 gap-4">{eniCard}{ldaCard}</div>
            {extras}
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════
     MODE 4 — HERO (dark results top, form below)
  ════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Hero — dark top panel */}
      <div className="bg-[#1C1917] shrink-0 px-8 py-6 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[11px] font-[800] uppercase tracking-[3px] text-stone-500 mb-1">Regime Ideal • OE 2026</div>
              <h1 className="text-[36px] font-[900] tracking-tight text-white leading-none">
                {winner === 'LDA' ? 'Sociedade Lda/Unipessoal' : 'Trabalhador Independente'}
                <span className="ml-3 text-[#D97706] text-[28px]">↑ {ptEur(diff)}</span>
              </h1>
            </div>
            <button onClick={resetAll} className="mt-1 p-2 rounded-[8px] text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"><RefreshCw size={16}/></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'ENI Net/Ano', value: ptEur(results.eni.net), highlight: winner === 'ENI' },
              { label: 'LDA Net/Ano', value: ptEur(results.lda.net), highlight: winner === 'LDA' },
              { label: 'Break-Even ENI', value: ptEur(results.beEni), highlight: false },
              { label: 'Break-Even LDA', value: ptEur(results.beLda), highlight: false },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={cn("rounded-[12px] p-4", highlight ? "bg-[#D97706]/20 border border-[#D97706]/40" : "bg-stone-800 border border-stone-700")}>
                <div className="text-[10px] font-[700] uppercase tracking-[1px] text-stone-400 mb-1">{label}</div>
                <div className={cn("text-[20px] font-[900]", highlight ? "text-[#D97706]" : "text-white")}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form area — light, scrollable */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5F4]">
        <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-[20px] border border-stone-200 p-6 shadow-sm">{folha1}</div>
          <div className="bg-white rounded-[20px] border border-stone-200 p-6 shadow-sm">{folha2}</div>
          <div className="bg-white rounded-[20px] border border-stone-200 p-6 shadow-sm">{folha3}</div>
          <div className="bg-white rounded-[20px] border border-stone-200 p-6 shadow-sm">{folha4}</div>

          <div className="md:col-span-2 space-y-4">
            {irsChips}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{eniCard}{ldaCard}</div>
            {extras}
          </div>
        </div>
      </div>
    </div>
  );
}
