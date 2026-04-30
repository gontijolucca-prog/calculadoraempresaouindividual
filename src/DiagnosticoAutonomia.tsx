import React, { useMemo } from 'react';
import { BarChart2, AlertTriangle, CheckCircle, Circle, TrendingUp, Wallet, Users, Building, Settings } from 'lucide-react';
import { cn } from './lib/utils';
import { useTheme } from './ThemeContext';
import { Tip } from './Tip';

export interface DiagnosticoState {
  // Pilar 1 — Autonomia Financeira
  capitaisProprios: number;
  ativoTotal: number;
  passivoTotal: number;
  // Pilar 2 — Tesouraria
  ativoCorrente: number;
  passivoCorrente: number;
  disponibilidades: number;
  custoFixoMensal: number;
  // Pilar 3 — Rentabilidade
  resultadoLiquido: number;
  volumeNegocios: number;
  ebitda: 'positivo' | 'marginal' | 'negativo';
  // Pilar 4 — Dependência
  faturacaoMaiorCliente: number;
  financiamentoExterno: number;
  totalFinanciamento: number;
  // Pilar 5 — Operacional
  processosDefinidos: boolean;
  softwareGestao: boolean;
  equipaAutonoma: boolean;
  baixaDependenciaGerente: boolean;
  controlFinanceiro: boolean;
}

interface Props {
  initialState: DiagnosticoState;
  onStateChange: (s: DiagnosticoState) => void;
}

const PILAR_LABELS = ['Financeira', 'Tesouraria', 'Rentabilidade', 'Dependência', 'Operacional'];
const PILAR_ICONS = [Building, Wallet, TrendingUp, Users, Settings];

function scoreColor(s: number): string {
  if (s >= 4) return '#10B981';
  if (s >= 2.5) return '#F59E0B';
  return '#EF4444';
}

function scoreLabel(s: number): string {
  if (s >= 4) return 'Forte';
  if (s >= 2.5) return 'Moderado';
  return 'Fraco';
}

function calcScores(d: DiagnosticoState) {
  // Pilar 1 — Autonomia Financeira
  const autonomia = d.ativoTotal > 0 ? d.capitaisProprios / d.ativoTotal : 0;
  const endividamento = d.ativoTotal > 0 ? d.passivoTotal / d.ativoTotal : 0;
  const s1a = autonomia >= 0.40 ? 5 : autonomia >= 0.25 ? 3 : 1;
  const s1b = endividamento <= 0.50 ? 5 : endividamento <= 0.75 ? 3 : 1;
  const p1 = (s1a + s1b) / 2;

  // Pilar 2 — Tesouraria
  const liquidez = d.passivoCorrente > 0 ? d.ativoCorrente / d.passivoCorrente : 5;
  const mesesDisp = d.custoFixoMensal > 0 ? d.disponibilidades / d.custoFixoMensal : 0;
  const s2a = liquidez >= 1.5 ? 5 : liquidez >= 1 ? 3 : 1;
  const s2b = mesesDisp >= 6 ? 5 : mesesDisp >= 3 ? 3 : 1;
  const p2 = (s2a + s2b) / 2;

  // Pilar 3 — Rentabilidade
  const margem = d.volumeNegocios > 0 ? d.resultadoLiquido / d.volumeNegocios : 0;
  const s3a = margem >= 0.15 ? 5 : margem >= 0.05 ? 3 : 1;
  const s3b = d.ebitda === 'positivo' ? 5 : d.ebitda === 'marginal' ? 3 : 1;
  const p3 = (s3a + s3b) / 2;

  // Pilar 4 — Dependência
  const concentracao = d.volumeNegocios > 0 ? d.faturacaoMaiorCliente / d.volumeNegocios : 0;
  const depFinanc = d.totalFinanciamento > 0 ? d.financiamentoExterno / d.totalFinanciamento : 0;
  const s4a = concentracao <= 0.20 ? 5 : concentracao <= 0.40 ? 3 : 1;
  const s4b = depFinanc <= 0.30 ? 5 : depFinanc <= 0.60 ? 3 : 1;
  const p4 = (s4a + s4b) / 2;

  // Pilar 5 — Operacional
  const checks = [d.processosDefinidos, d.softwareGestao, d.equipaAutonoma, d.baixaDependenciaGerente, d.controlFinanceiro];
  const p5 = checks.filter(Boolean).length;

  return [p1, p2, p3, p4, p5];
}

function RadarChart({ scores }: { scores: number[] }) {
  const N = 5;
  const cx = 150, cy = 150, R = 110;
  const maxScore = 5;

  const angle = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const point = (score: number, i: number) => {
    const r = (score / maxScore) * R;
    return { x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) };
  };
  const outerPoint = (i: number) => ({ x: cx + R * Math.cos(angle(i)), y: cy + R * Math.sin(angle(i)) });

  const scorePoints = scores.map((s, i) => point(s, i));
  const outerPoints = Array.from({ length: N }, (_, i) => outerPoint(i));

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';

  // Grid rings
  const rings = [1, 2, 3, 4, 5].map(r => {
    const pts = Array.from({ length: N }, (_, i) => {
      const ratio = r / maxScore;
      return { x: cx + R * ratio * Math.cos(angle(i)), y: cy + R * ratio * Math.sin(angle(i)) };
    });
    return toPath(pts);
  });

  const labelOffset = 24;
  const labels = PILAR_LABELS.map((lbl, i) => {
    const a = angle(i);
    return {
      lbl,
      x: cx + (R + labelOffset) * Math.cos(a),
      y: cy + (R + labelOffset) * Math.sin(a),
    };
  });

  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[320px] mx-auto">
      {/* Grid rings */}
      {rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#E2E8F0" strokeWidth={i === 4 ? 1.5 : 0.7} />
      ))}
      {/* Spoke lines */}
      {outerPoints.map((op, i) => (
        <line key={i} x1={cx} y1={cy} x2={op.x} y2={op.y} stroke="#E2E8F0" strokeWidth={0.8} />
      ))}
      {/* Score polygon */}
      <path d={toPath(scorePoints)} fill="rgba(120,29,29,0.18)" stroke="#781D1D" strokeWidth={2} />
      {/* Score dots */}
      {scorePoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill={scoreColor(scores[i])} stroke="white" strokeWidth={1.5} />
      ))}
      {/* Labels */}
      {labels.map(({ lbl, x, y }, i) => (
        <text
          key={i}
          x={x} y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fontWeight={600}
          fill="#475569"
          className="select-none"
        >
          {lbl}
        </text>
      ))}
    </svg>
  );
}

export default function DiagnosticoAutonomia({ initialState, onStateChange }: Props) {
  const d = initialState;
  const setState = (u: Partial<DiagnosticoState>) => onStateChange({ ...d, ...u });

  const scores = useMemo(() => calcScores(d), [d]);
  const globalScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  const alertas: string[] = useMemo(() => {
    const al: string[] = [];
    const liquidez = d.passivoCorrente > 0 ? d.ativoCorrente / d.passivoCorrente : 99;
    const autonomia = d.ativoTotal > 0 ? d.capitaisProprios / d.ativoTotal : 1;
    const concentracao = d.volumeNegocios > 0 ? d.faturacaoMaiorCliente / d.volumeNegocios : 0;
    if (liquidez < 1) al.push('RISCO DE TESOURARIA — rácio de liquidez inferior a 1');
    if (concentracao > 0.40) al.push('Dependência crítica de cliente — mais de 40% da faturação num só cliente');
    if (autonomia < 0.25) al.push('Baixa autonomia financeira — menos de 25% dos activos financiados por capitais próprios');
    if (globalScore < 3) al.push('Empresa vulnerável a choques externos — score global inferior a 3/5');
    return al;
  }, [d, globalScore]);

  const inputCls = "w-full px-[14px] py-[10px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelCls = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[6px]";

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
  const { simMode } = useTheme();
  const outerCls = { split: "h-full flex flex-col lg:grid lg:grid-cols-[420px_1fr] bg-[#F8FAFC] text-[#1E293B]", stacked: "h-full flex flex-col bg-[#F0F4F8] text-[#1E293B] overflow-y-auto", mosaic: "h-full bg-[#F0FDF4] text-[#1E293B] md:grid md:grid-cols-2 gap-4 p-4", compact: "h-full overflow-y-auto bg-white text-[#1E293B]", hero: "h-full flex md:flex-row-reverse overflow-hidden bg-[#F5F5F4] text-[#1E293B]" }[simMode];
  const leftCls = { split: "bg-white border-r border-[#E2E8F0] overflow-y-auto p-[28px] flex flex-col gap-[24px] h-full", stacked: "bg-white border-b-2 border-[#E2E8F0] p-6 flex flex-col gap-5", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pb-0 w-full", hero: "md:w-[440px] shrink-0 bg-white border-l border-[#E2E8F0] overflow-y-auto p-6 flex flex-col gap-5 h-full" }[simMode];
  const rightCls = { split: "overflow-y-auto p-[28px] flex flex-col gap-[20px]", stacked: "p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pt-2 w-full border-t border-slate-100", hero: "flex-1 overflow-y-auto p-6 flex flex-col gap-5" }[simMode];

  const pilaresFracos = PILAR_LABELS.filter((_, i) => scores[i] < 3);

  return (
    <div className={outerCls}>
      {/* Left Pane */}
      <div className={leftCls}>
        <div>
          <h2 className="text-[22px] font-[800] tracking-[-0.5px] text-[#0F172A]">Diagnóstico de Autonomia</h2>
          <p className="text-[13px] text-[#64748B] font-[500] mt-[4px]">Avaliação por 5 pilares — balanço e gestão empresarial.</p>
        </div>

        {/* P1 — Autonomia Financeira */}
        <section className="space-y-[14px]">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-[#781D1D]" />
            <span className="text-[12px] font-[700] uppercase tracking-[1px] text-[#781D1D]">Pilar 1 — Autonomia Financeira</span>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls}>Capitais Próprios (€) <Tip>O valor do capital investido pelos sócios mais os lucros acumulados. É o dinheiro 'da empresa' sem considerar dívidas.</Tip></label>
              <input type="number" min="0" value={d.capitaisProprios === 0 ? '' : d.capitaisProprios} onChange={e => setState({ capitaisProprios: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Ativo Total (€) <Tip>Tudo o que a empresa possui: dinheiro, equipamentos, imóveis, créditos de clientes. O total do lado esquerdo do balanço.</Tip></label>
              <input type="number" min="0" value={d.ativoTotal === 0 ? '' : d.ativoTotal} onChange={e => setState({ ativoTotal: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Passivo Total (€) <Tip>Tudo o que a empresa deve: empréstimos, dívidas a fornecedores, impostos em atraso. O total das dívidas.</Tip></label>
              <input type="number" min="0" value={d.passivoTotal === 0 ? '' : d.passivoTotal} onChange={e => setState({ passivoTotal: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
          </div>
        </section>

        {/* P2 — Tesouraria */}
        <section className="space-y-[14px]">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#781D1D]" />
            <span className="text-[12px] font-[700] uppercase tracking-[1px] text-[#781D1D]">Pilar 2 — Tesouraria</span>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls}>Ativo Corrente (€) <Tip>Os bens e direitos que se convertem em dinheiro em menos de 1 ano: stock, créditos de clientes, dinheiro em caixa.</Tip></label>
              <input type="number" min="0" value={d.ativoCorrente === 0 ? '' : d.ativoCorrente} onChange={e => setState({ ativoCorrente: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Passivo Corrente (€) <Tip>As dívidas a pagar em menos de 1 ano: faturas de fornecedores, impostos correntes, prestações de empréstimos de curto prazo.</Tip></label>
              <input type="number" min="0" value={d.passivoCorrente === 0 ? '' : d.passivoCorrente} onChange={e => setState({ passivoCorrente: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Disponibilidades (€) <Tip>O dinheiro em caixa e nas contas bancárias da empresa, disponível imediatamente.</Tip></label>
              <input type="number" min="0" value={d.disponibilidades === 0 ? '' : d.disponibilidades} onChange={e => setState({ disponibilidades: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Custo Fixo Mensal (€) <Tip>O total de despesas mensais que a empresa tem independentemente de faturar (rendas, salários, seguros, internet).</Tip></label>
              <input type="number" min="0" value={d.custoFixoMensal === 0 ? '' : d.custoFixoMensal} onChange={e => setState({ custoFixoMensal: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
          </div>
        </section>

        {/* P3 — Rentabilidade */}
        <section className="space-y-[14px]">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#781D1D]" />
            <span className="text-[12px] font-[700] uppercase tracking-[1px] text-[#781D1D]">Pilar 3 — Rentabilidade</span>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls}>Resultado Líquido (€/ano) <Tip>O lucro ou prejuízo da empresa depois de todos os impostos e gastos. Um número positivo é lucro; negativo é prejuízo.</Tip></label>
              <input type="number" value={d.resultadoLiquido === 0 ? '' : d.resultadoLiquido} onChange={e => setState({ resultadoLiquido: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Volume de Negócios (€/ano) <Tip>O total de vendas e serviços faturados durante o ano. É a 'receita total' antes de qualquer desconto ou imposto.</Tip></label>
              <input type="number" min="0" value={d.volumeNegocios === 0 ? '' : d.volumeNegocios} onChange={e => setState({ volumeNegocios: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
          </div>
          <div>
            <label className={labelCls}>EBITDA <Tip>EBITDA é o resultado operacional antes de juros, impostos, depreciações e amortizações. Indica a capacidade de gerar dinheiro com a operação.</Tip></label>
            <select value={d.ebitda} onChange={e => setState({ ebitda: e.target.value as DiagnosticoState['ebitda'] })} className={inputCls}>
              <option value="positivo">Positivo e crescente</option>
              <option value="marginal">Marginal / estável</option>
              <option value="negativo">Negativo ou decrescente</option>
            </select>
          </div>
        </section>

        {/* P4 — Dependência */}
        <section className="space-y-[14px]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#781D1D]" />
            <span className="text-[12px] font-[700] uppercase tracking-[1px] text-[#781D1D]">Pilar 4 — Dependência</span>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls}>Faturação maior cliente (€/ano) <Tip>Quanto representa o cliente mais importante da empresa, em euros anuais. Dependência excessiva de um cliente é um risco.</Tip></label>
              <input type="number" min="0" value={d.faturacaoMaiorCliente === 0 ? '' : d.faturacaoMaiorCliente} onChange={e => setState({ faturacaoMaiorCliente: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Financiamento externo (€) <Tip>O valor de empréstimos bancários ou outros financiamentos externos que a empresa tem neste momento.</Tip></label>
              <input type="number" min="0" value={d.financiamentoExterno === 0 ? '' : d.financiamentoExterno} onChange={e => setState({ financiamentoExterno: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Total de fontes de financiamento (€) <Tip>O valor total de todos os financiamentos, incluindo externos e dos sócios (capital social).</Tip></label>
              <input type="number" min="0" value={d.totalFinanciamento === 0 ? '' : d.totalFinanciamento} onChange={e => setState({ totalFinanciamento: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0" />
            </div>
          </div>
        </section>

        {/* P5 — Operacional */}
        <section className="space-y-[14px]">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#781D1D]" />
            <span className="text-[12px] font-[700] uppercase tracking-[1px] text-[#781D1D]">Pilar 5 — Maturidade Operacional</span>
          </div>
          <div className="space-y-[8px]">
            {[
              { key: 'processosDefinidos', label: 'Processos e procedimentos documentados', tip: 'Se a empresa tem procedimentos escritos e organizados para as tarefas principais. Reduz a dependência de pessoas específicas.' },
              { key: 'softwareGestao', label: 'Software de gestão/ERP implementado', tip: 'Se usa software para gerir stock, faturação, contabilidade. Melhora o controlo e a eficiência.' },
              { key: 'equipaAutonoma', label: 'Equipa capaz de operar sem o gerente', tip: 'Se a equipa consegue trabalhar sem depender constantemente do gerente/dono para decisões do dia a dia.' },
              { key: 'baixaDependenciaGerente', label: 'Baixa dependência pessoal do gerente/sócio', tip: 'Se a empresa funcionaria bem durante algum tempo sem a presença do gerente. Sinal de maturidade operacional.' },
              { key: 'controlFinanceiro', label: 'Controlo financeiro e reporting mensal', tip: 'Se existe controlo regular de tesouraria, margem e resultados (relatórios mensais, orçamentos). Essencial para tomar decisões.' },
            ].map(({ key, label, tip }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setState({ [key]: !d[key as keyof DiagnosticoState] } as Partial<DiagnosticoState>)}
                  className={cn(
                    "w-5 h-5 rounded-[4px] border-2 flex items-center justify-center transition-colors shrink-0",
                    d[key as keyof DiagnosticoState] ? "bg-[#781D1D] border-[#781D1D]" : "border-[#E2E8F0] bg-white"
                  )}
                >
                  {d[key as keyof DiagnosticoState] && <CheckCircle className="w-3 h-3 text-white" />}
                </div>
                <span className="text-[13px] text-[#475569] font-[500] group-hover:text-[#0F172A] transition-colors">{label} <Tip>{tip}</Tip></span>
              </label>
            ))}
          </div>
        </section>
      </div>

      {/* Right Pane — Results */}
      <div className={rightCls}>

        {/* Radar Chart + Global Score */}
        <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[24px] flex flex-col lg:flex-row items-center gap-[24px]">
          <div className="flex-1">
            <RadarChart scores={scores} />
          </div>
          <div className="flex-1 flex flex-col gap-[12px]">
            <div className="text-center lg:text-left">
              <div className="text-[13px] font-[700] uppercase tracking-[1px] text-[#64748B]">Score Global</div>
              <div className="text-[48px] font-[900] leading-none mt-1" style={{ color: scoreColor(globalScore) }}>
                {globalScore.toFixed(1)}
                <span className="text-[18px] font-[600] text-[#94A3B8]">/5</span>
              </div>
              <div className="mt-2 inline-block px-3 py-1 rounded-full text-[12px] font-[700]"
                style={{ backgroundColor: scoreColor(globalScore) + '22', color: scoreColor(globalScore) }}>
                {scoreLabel(globalScore)}
              </div>
            </div>

            <div className="space-y-[8px] mt-2">
              {PILAR_LABELS.map((lbl, i) => {
                const Icon = PILAR_ICONS[i];
                return (
                  <div key={lbl} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0"
                      style={{ backgroundColor: scoreColor(scores[i]) + '20' }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: scoreColor(scores[i]) }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[12px] font-[600] text-[#475569]">{lbl}</span>
                        <span className="text-[12px] font-[800]" style={{ color: scoreColor(scores[i]) }}>{scores[i].toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 bg-[#F1F5F9] rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(scores[i] / 5) * 100}%`, backgroundColor: scoreColor(scores[i]) }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-[16px] p-[18px] space-y-[8px]">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-[12px] font-[700] uppercase tracking-[1px] text-red-700">Alertas de Risco</span>
            </div>
            {alertas.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <Circle className="w-2 h-2 fill-red-500 text-red-500 mt-[5px] shrink-0" />
                <span className="text-[13px] text-red-700 font-[500]">{a}</span>
              </div>
            ))}
          </div>
        )}

        {/* Indicadores-chave */}
        <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-[20px]">
          <h3 className="text-[13px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[14px]">Indicadores Calculados</h3>
          <div className="grid grid-cols-2 gap-[10px]">
            {[
              { label: 'Autonomia Financeira', value: d.ativoTotal > 0 ? `${(d.capitaisProprios / d.ativoTotal * 100).toFixed(1)}%` : '—', ok: d.ativoTotal > 0 && d.capitaisProprios / d.ativoTotal >= 0.25 },
              { label: 'Liquidez Geral', value: d.passivoCorrente > 0 ? `${(d.ativoCorrente / d.passivoCorrente).toFixed(2)}x` : '—', ok: d.passivoCorrente > 0 && d.ativoCorrente / d.passivoCorrente >= 1 },
              { label: 'Margem Líquida', value: d.volumeNegocios > 0 ? `${(d.resultadoLiquido / d.volumeNegocios * 100).toFixed(1)}%` : '—', ok: d.volumeNegocios > 0 && d.resultadoLiquido / d.volumeNegocios >= 0.05 },
              { label: 'Meses de Autonomia', value: d.custoFixoMensal > 0 ? `${(d.disponibilidades / d.custoFixoMensal).toFixed(1)}m` : '—', ok: d.custoFixoMensal > 0 && d.disponibilidades / d.custoFixoMensal >= 3 },
              { label: 'Conc. maior cliente', value: d.volumeNegocios > 0 ? `${(d.faturacaoMaiorCliente / d.volumeNegocios * 100).toFixed(1)}%` : '—', ok: d.volumeNegocios > 0 && d.faturacaoMaiorCliente / d.volumeNegocios <= 0.4 },
              { label: 'Dep. financiamento ext.', value: d.totalFinanciamento > 0 ? `${(d.financiamentoExterno / d.totalFinanciamento * 100).toFixed(1)}%` : '—', ok: d.totalFinanciamento > 0 && d.financiamentoExterno / d.totalFinanciamento <= 0.60 },
            ].map(({ label, value, ok }) => (
              <div key={label} className={cn("p-[12px] rounded-[12px] border", ok ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100")}>
                <div className="text-[10px] font-[700] uppercase tracking-[0.5px] text-[#64748B]">{label}</div>
                <div className={cn("text-[20px] font-[800] mt-[2px]", ok ? "text-emerald-700" : "text-red-600")}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Conclusão */}
        <div className="bg-[#0F172A] text-white rounded-[20px] p-[20px]">
          <h3 className="text-[12px] font-[700] uppercase tracking-[1px] text-slate-400 mb-[10px]">Análise Conclusiva</h3>
          <p className="text-[14px] font-[500] leading-relaxed text-slate-200">
            A análise demonstra que a empresa apresenta nível de autonomia{' '}
            <span className="font-[700] text-white">{globalScore >= 4 ? 'elevado' : globalScore >= 2.5 ? 'médio' : 'baixo'}</span>
            {pilaresFracos.length > 0 ? (
              <>, recomendando-se intervenção ao nível de{' '}
                <span className="font-[700] text-white">{pilaresFracos.join(', ')}</span>.</>
            ) : (
              <>. A empresa apresenta solidez nos 5 pilares avaliados.</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
