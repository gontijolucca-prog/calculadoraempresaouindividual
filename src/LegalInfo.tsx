import React, { useState } from 'react';
import { ArrowLeft, Scale, BookOpen, Car, Ticket, Shield, AlertTriangle, CheckCircle2, Briefcase, Save, Layers, Building, Banknote, Home, ClipboardList } from 'lucide-react';
import { IRS_BRACKETS_2026, IAS_2026 } from './lib/pt2026';
import {
  loadPricing,
  savePricing,
  calcClientEstimate,
  type PricingConfig,
} from './lib/pricing';
import type { ClientProfile } from './ClientProfile';

interface Props {
  onBack: () => void;
  onOpenUpdates?: () => void;
  clientProfile?: ClientProfile;
  vehicleState?: { price: number };
  ticketState?: { ticketValue: number };
}

const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

const SectionHeader = ({ icon: Icon, title, color = '#781D1D' }: { icon: React.ElementType; title: string; color?: string }) => (
  <div className="flex items-center gap-3 mb-5 pb-3 border-b-2" style={{ borderColor: color }}>
    <div className="p-2 rounded-[10px]" style={{ backgroundColor: `${color}15` }}>
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <h2 className="text-[18px] font-[800] text-[#0F172A]">{title}</h2>
  </div>
);

const LegalRow = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className="py-[10px] border-b border-[#F1F5F9] last:border-0">
    <div className="flex justify-between items-start gap-4">
      <span className="text-[13px] font-[700] text-[#475569] shrink-0 w-[200px]">{label}</span>
      <span className="text-[13px] font-[600] text-[#0F172A] text-right flex-1">{value}</span>
    </div>
    {note && <p className="text-[11px] text-[#94A3B8] mt-1 ml-0 font-[500]">{note}</p>}
  </div>
);

const Article = ({ code, description }: { code: string; description: string }) => (
  <div className="flex gap-3 py-[8px] border-b border-[#F1F5F9] last:border-0">
    <span className="text-[11px] font-[800] text-[#781D1D] bg-[#FDF2F2] px-2 py-1 rounded-[6px] h-fit shrink-0 whitespace-nowrap">{code}</span>
    <span className="text-[13px] font-[500] text-[#334155]">{description}</span>
  </div>
);

const ptEurShort = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);

const PriceInput = ({
  label,
  description,
  value,
  suffix = '€/mês',
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  suffix?: string;
  onChange: (v: number) => void;
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-[12px] font-[700] text-[#0F172A]">{label}</label>
    <p className="text-[11px] text-[#94A3B8] font-[500]">{description}</p>
    <div className="flex items-center gap-2 mt-1">
      <input
        type="number"
        min={0}
        step={5}
        value={value}
        onChange={e => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
        className="w-28 px-3 py-2 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[700] text-[#0F172A] focus:border-[#781D1D] outline-none"
      />
      <span className="text-[12px] text-[#64748B] font-[500]">{suffix}</span>
    </div>
  </div>
);

export default function LegalInfo({ onBack, onOpenUpdates, clientProfile, vehicleState, ticketState }: Props) {
  const [pricing, setPricing] = useState<PricingConfig>(loadPricing);
  const [saved, setSaved] = useState(false);

  const update = (field: keyof PricingConfig, value: number) => {
    const next = { ...pricing, [field]: value };
    setPricing(next);
    savePricing(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const estimate =
    clientProfile && clientProfile.nomeCliente
      ? calcClientEstimate(pricing, clientProfile, vehicleState, ticketState)
      : null;

  return (
    <div className="h-full bg-[#F8FAFC] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-6 md:px-10 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] font-[700] text-[#475569] hover:text-[#781D1D] transition-colors px-3 py-2 rounded-[8px] hover:bg-[#FDF2F2]"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div className="h-6 w-px bg-[#E2E8F0]" />
        <div>
          <h1 className="text-[18px] font-[800] text-[#0F172A]">Base Legal & Referências</h1>
          <p className="text-[11px] font-[600] text-[#781D1D] uppercase tracking-[1px]">Legislação • Taxas • Limites • OE 2026</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] font-[700] bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full">
            ✓ Atualizado Abril 2026
          </span>
          {onOpenUpdates && (
            <button
              onClick={onOpenUpdates}
              className="flex items-center gap-2 text-[13px] font-[700] text-white bg-[#781D1D] hover:bg-[#5A1313] px-4 py-2 rounded-[10px] transition-all active:scale-[0.98] shadow-sm shadow-[#781D1D]/20"
            >
              <ClipboardList size={15} />
              Checklist
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 py-10 space-y-12">

        {/* Aviso */}
        <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-5 flex gap-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[13px] text-amber-900 font-[500] leading-relaxed">
            <strong>Nota:</strong> Esta página apresenta a legislação em que os cálculos dos simuladores se baseiam, com dados válidos para <strong>abril de 2026</strong>. A lei fiscal pode sofrer alterações. Este simulador não substitui o aconselhamento de um <strong>contabilista certificado (OCC)</strong>.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TABELA DE HONORÁRIOS                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <div className="flex items-center justify-between mb-5 pb-3 border-b-2 border-[#781D1D]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-[10px] bg-[#781D1D15]">
                <Briefcase className="w-5 h-5 text-[#781D1D]" />
              </div>
              <h2 className="text-[18px] font-[800] text-[#0F172A]">Tabela de Honorários</h2>
            </div>
            {saved && (
              <span className="flex items-center gap-1.5 text-[12px] font-[700] text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                <Save size={12} /> Guardado
              </span>
            )}
          </div>

          <p className="text-[13px] text-[#64748B] font-[500] mb-6">
            Configure os valores dos seus serviços. Os preços são guardados automaticamente neste dispositivo e utilizados para calcular a estimativa de honorários para cada cliente.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* ── Coluna de configuração ── */}
            <div className="lg:col-span-2 space-y-8">

              {/* Contabilidade base */}
              <div>
                <h3 className="text-[13px] font-[800] text-[#0F172A] uppercase tracking-[0.5px] mb-4 pb-2 border-b border-[#F1F5F9]">Contabilidade Mensal</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <PriceInput
                    label="ENI / Trab. Independente"
                    description="Contabilidade de recibos verdes em regime simplificado"
                    value={pricing.contabilidadeEni}
                    onChange={v => update('contabilidadeEni', v)}
                  />
                  <PriceInput
                    label="Lda. / Unipessoal"
                    description="Contabilidade organizada de sociedade por quotas"
                    value={pricing.contabilidadeLda}
                    onChange={v => update('contabilidadeLda', v)}
                  />
                  <PriceInput
                    label="Sociedade Anónima (SA)"
                    description="Contabilidade de SA com maiores obrigações reportivas"
                    value={pricing.contabilidadeSA}
                    onChange={v => update('contabilidadeSA', v)}
                  />
                </div>
              </div>

              {/* Salários */}
              <div>
                <h3 className="text-[13px] font-[800] text-[#0F172A] uppercase tracking-[0.5px] mb-4 pb-2 border-b border-[#F1F5F9]">Processamento Salarial</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <PriceInput
                    label="Por funcionário"
                    description="Processamento de salário, SS e IRS retenção mensal"
                    suffix="€ / func. / mês"
                    value={pricing.salarioPorFuncionario}
                    onChange={v => update('salarioPorFuncionario', v)}
                  />
                  <PriceInput
                    label="Tickets de refeição"
                    description="Emissão e gestão mensal de vales de refeição"
                    value={pricing.processamentoTickets}
                    onChange={v => update('processamentoTickets', v)}
                  />
                </div>
              </div>

              {/* IVA */}
              <div>
                <h3 className="text-[13px] font-[800] text-[#0F172A] uppercase tracking-[0.5px] mb-4 pb-2 border-b border-[#F1F5F9]">Declarações de IVA</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <PriceInput
                    label="Declaração trimestral"
                    description="IVA periódico — 4 declarações por ano"
                    suffix="€ / declaração"
                    value={pricing.ivaDeclaracaoTrimestral}
                    onChange={v => update('ivaDeclaracaoTrimestral', v)}
                  />
                  <PriceInput
                    label="Declaração mensal"
                    description="IVA periódico — 12 declarações por ano"
                    suffix="€ / declaração"
                    value={pricing.ivaDeclaracaoMensal}
                    onChange={v => update('ivaDeclaracaoMensal', v)}
                  />
                </div>
              </div>

              {/* Declarações anuais */}
              <div>
                <h3 className="text-[13px] font-[800] text-[#0F172A] uppercase tracking-[0.5px] mb-4 pb-2 border-b border-[#F1F5F9]">Declarações Anuais</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <PriceInput
                    label="IRS anual — ENI"
                    description="Declaração Mod. 3 categoria B"
                    suffix="€ / ano"
                    value={pricing.irsAnualEni}
                    onChange={v => update('irsAnualEni', v)}
                  />
                  <PriceInput
                    label="IRC / Modelo 22"
                    description="Declaração anual de IRC para sociedades"
                    suffix="€ / ano"
                    value={pricing.ircAnualLda}
                    onChange={v => update('ircAnualLda', v)}
                  />
                  <PriceInput
                    label="DAI / IES"
                    description="Declaração Anual de Informação Empresarial"
                    suffix="€ / ano"
                    value={pricing.daiIES}
                    onChange={v => update('daiIES', v)}
                  />
                </div>
              </div>

              {/* Outros serviços */}
              <div>
                <h3 className="text-[13px] font-[800] text-[#0F172A] uppercase tracking-[0.5px] mb-4 pb-2 border-b border-[#F1F5F9]">Outros Serviços</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <PriceInput
                    label="Gestão de viaturas"
                    description="Por viatura: depreciação, TA e custos dedutíveis mensais"
                    suffix="€ / viatura / mês"
                    value={pricing.gestaoPorViatura}
                    onChange={v => update('gestaoPorViatura', v)}
                  />
                  <PriceInput
                    label="Consultoria / hora"
                    description="Aconselhamento fiscal, reuniões e apoio pontual"
                    suffix="€ / hora"
                    value={pricing.consultoriaHora}
                    onChange={v => update('consultoriaHora', v)}
                  />
                  <PriceInput
                    label="Constituição de empresa"
                    description="Apoio na constituição de Lda., Unipessoal ou SA"
                    suffix="€ (valor único)"
                    value={pricing.constituicaoEmpresa}
                    onChange={v => update('constituicaoEmpresa', v)}
                  />
                  <PriceInput
                    label="Registo como ENI"
                    description="Abertura de atividade e primeiras obrigações fiscais"
                    suffix="€ (valor único)"
                    value={pricing.registoEni}
                    onChange={v => update('registoEni', v)}
                  />
                </div>
              </div>
            </div>

            {/* ── Painel de resumo ── */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                {estimate ? (
                  <div className="bg-[#0F172A] rounded-[20px] p-6 text-white">
                    <div className="mb-4">
                      <p className="text-[11px] font-[700] uppercase tracking-[1px] text-[#94A3B8] mb-1">Estimativa para</p>
                      <p className="text-[16px] font-[800]">{clientProfile!.nomeCliente || 'Cliente'}</p>
                      <span className="inline-block mt-1 text-[11px] font-[700] bg-[#781D1D] text-white px-2 py-0.5 rounded-full">
                        {estimate.entityLabel}
                      </span>
                    </div>

                    <div className="space-y-2 mb-5">
                      {[
                        { label: 'Contabilidade base', value: estimate.baseMonthly },
                        {
                          label: `Salários (${clientProfile!.nrFuncionarios} func.)`,
                          value: estimate.salarios,
                          hide: estimate.salarios === 0,
                        },
                        {
                          label: clientProfile!.regimeIva === 'normal_mensal' ? 'IVA mensal' : clientProfile!.regimeIva === 'pequenos_retalhistas' ? 'IVA Peq. Retalhistas (÷3)' : 'IVA trimestral (÷3)',
                          value: estimate.iva,
                          hide: estimate.iva === 0,
                        },
                        {
                          label: clientProfile!.tipoEntidade === 'eni' ? 'IRS anual (÷12)' : 'IRC + IES (÷12)',
                          value: estimate.anuaisAmortizados,
                        },
                        {
                          label: 'Gestão de viaturas',
                          value: estimate.viaturas,
                          hide: estimate.viaturas === 0,
                        },
                        {
                          label: 'Tickets de refeição',
                          value: estimate.tickets,
                          hide: estimate.tickets === 0,
                        },
                      ]
                        .filter(r => !r.hide)
                        .map(r => (
                          <div key={r.label} className="flex justify-between items-center text-[13px]">
                            <span className="text-[#94A3B8] font-[500]">{r.label}</span>
                            <span className="font-[700]">{ptEurShort(r.value)}</span>
                          </div>
                        ))}
                    </div>

                    <div className="border-t border-[#334155] pt-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] text-[#94A3B8] font-[600]">Total / mês</span>
                        <span className="text-[20px] font-[800] text-white">{ptEurShort(estimate.totalMensal)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[12px] text-[#64748B] font-[500]">Total / ano</span>
                        <span className="text-[14px] font-[700] text-[#94A3B8]">{ptEurShort(estimate.totalAnual)}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-[#475569] mt-4 leading-relaxed">
                      Estimativa indicativa. Serviços pontuais (constituição, consultoria) não incluídos.
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#F8FAFC] border-2 border-dashed border-[#E2E8F0] rounded-[20px] p-6 text-center">
                    <Briefcase className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
                    <p className="text-[13px] font-[600] text-[#64748B]">Preencha o nome do cliente no Perfil para ver a estimativa de honorários.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* REGIMES DE CONTABILIDADE & IVA                             */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Layers} title="Regimes de Contabilidade & IVA em Portugal" color="#334155" />

          <p className="text-[13px] text-[#64748B] font-[500] mb-6 leading-relaxed">
            O enquadramento contabilístico e fiscal de um cliente depende do tipo de entidade, volume de faturação, natureza da atividade e opções exercidas. Abaixo resumem-se todos os regimes em vigor.
          </p>

          {/* ── Regimes de Apuramento do Rendimento ── */}
          <h3 className="text-[14px] font-[800] text-[#0F172A] mb-4 mt-2 uppercase tracking-[0.5px]">Regimes de Apuramento do Rendimento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">

            {/* 1 - Regime Simplificado */}
            {(() => {
              const isActive = clientProfile?.regimeContabilidade === 'simplificado';
              return (
                <div className={`rounded-[16px] border-2 p-5 ${isActive ? 'border-[#781D1D] bg-[#FDF2F2]' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-[800] text-[#781D1D] bg-[#FDF2F2] border border-[#F8B4B4] px-2 py-0.5 rounded-full">Art. 28.º CIRS / Art. 86.º-A CIRC</span>
                      <h4 className="text-[15px] font-[800] text-[#0F172A] mt-2">Regime Simplificado</h4>
                    </div>
                    {isActive && <span className="shrink-0 text-[10px] font-[800] bg-[#781D1D] text-white px-2 py-1 rounded-full uppercase">Cliente Atual</span>}
                  </div>
                  <div className="space-y-1.5 text-[13px]">
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Para quem:</strong> ENI (Cat. B) e pequenas sociedades com faturação até <strong>€200.000/ano</strong>.</p>
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Como funciona:</strong> Não apura lucro real. Usa coeficientes sobre as receitas.</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="bg-white rounded-[8px] border border-[#E2E8F0] p-2 text-center">
                        <div className="text-[11px] text-[#94A3B8] font-[600]">Serviços</div>
                        <div className="text-[18px] font-[800] text-[#781D1D]">75%</div>
                        <div className="text-[10px] text-[#94A3B8]">rendimento coletável</div>
                      </div>
                      <div className="bg-white rounded-[8px] border border-[#E2E8F0] p-2 text-center">
                        <div className="text-[11px] text-[#94A3B8] font-[600]">Mercadorias</div>
                        <div className="text-[18px] font-[800] text-[#781D1D]">15%</div>
                        <div className="text-[10px] text-[#94A3B8]">rendimento coletável</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] font-[500] mt-1">Vantagem: menos obrigações contabilísticas. Obriga a Contabilidade Organizada acima de €200k.</p>
                  </div>
                </div>
              );
            })()}

            {/* 2 - Contabilidade Organizada */}
            {(() => {
              const isActive = clientProfile?.regimeContabilidade === 'organizada';
              return (
                <div className={`rounded-[16px] border-2 p-5 ${isActive ? 'border-[#0F172A] bg-slate-50' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-[800] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">SNC + CIRS/CIRC</span>
                      <h4 className="text-[15px] font-[800] text-[#0F172A] mt-2">Contabilidade Organizada</h4>
                    </div>
                    {isActive && <span className="shrink-0 text-[10px] font-[800] bg-[#0F172A] text-white px-2 py-1 rounded-full uppercase">Cliente Atual</span>}
                  </div>
                  <div className="space-y-1.5 text-[13px]">
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Para quem:</strong> Sociedades (obrigatório) e ENI acima de €200k ou por opção.</p>
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Como funciona:</strong> Apura o lucro real. Imposto = sobre <em>Rendimentos − Gastos</em>.</p>
                    <p className="text-[#475569] font-[500]">Obriga a Contabilista Certificado (OCC) e demonstrações financeiras (Balanço, DRD).</p>
                    <p className="text-[11px] text-[#94A3B8] font-[500] mt-1">ENI pode optar voluntariamente mesmo abaixo de €200k para deduzir custos reais superiores aos coeficientes.</p>
                  </div>
                </div>
              );
            })()}

            {/* 3 - Transparência Fiscal */}
            {(() => {
              const isActive = clientProfile?.regimeContabilidade === 'transparencia_fiscal';
              return (
                <div className={`rounded-[16px] border-2 p-5 ${isActive ? 'border-purple-500 bg-purple-50' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-[800] text-purple-700 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">Art. 6.º CIRC</span>
                      <h4 className="text-[15px] font-[800] text-[#0F172A] mt-2">Regime de Transparência Fiscal</h4>
                    </div>
                    {isActive && <span className="shrink-0 text-[10px] font-[800] bg-purple-600 text-white px-2 py-1 rounded-full uppercase">Cliente Atual</span>}
                  </div>
                  <div className="space-y-1.5 text-[13px]">
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Para quem:</strong> Sociedades de profissionais (advogados, médicos, arquitetos, etc.).</p>
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Como funciona:</strong> A empresa <strong>não paga IRC</strong>. O lucro é imputado aos sócios e tributado em IRS na esfera pessoal.</p>
                    <p className="text-[#475569] font-[500]">Pode ser vantajoso quando a taxa marginal de IRS do sócio é inferior à taxa de IRC.</p>
                    <p className="text-[11px] text-[#94A3B8] font-[500] mt-1">Muito usado em estruturas profissionais com sócios de rendimentos moderados. Simulável no separador de Enquadramento Fiscal.</p>
                  </div>
                </div>
              );
            })()}

            {/* 4 - RETGS */}
            {(() => {
              const isActive = clientProfile?.regimeContabilidade === 'retgs';
              return (
                <div className={`rounded-[16px] border-2 p-5 ${isActive ? 'border-blue-500 bg-blue-50' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-[800] text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">Art. 69.º CIRC</span>
                      <h4 className="text-[15px] font-[800] text-[#0F172A] mt-2">RETGS — Tributação de Grupos</h4>
                    </div>
                    {isActive && <span className="shrink-0 text-[10px] font-[800] bg-blue-600 text-white px-2 py-1 rounded-full uppercase">Cliente Atual</span>}
                  </div>
                  <div className="space-y-1.5 text-[13px]">
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Para quem:</strong> Grupos de sociedades em que a dominante detém ≥75% do capital e direitos de voto.</p>
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Como funciona:</strong> Resultado fiscal consolidado — lucros e prejuízos compensam-se dentro do grupo.</p>
                    <p className="text-[11px] text-[#94A3B8] font-[500] mt-1">Requer autorização prévia da AT e contabilidade consolidada. Os simuladores desta ferramenta não cobrem o RETGS.</p>
                  </div>
                </div>
              );
            })()}

            {/* 5 - Não Residentes */}
            {(() => {
              const isActive = clientProfile?.regimeContabilidade === 'nao_residente';
              return (
                <div className={`rounded-[16px] border-2 p-5 col-span-full md:col-span-1 ${isActive ? 'border-amber-500 bg-amber-50' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-[800] text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">CIRS/CIRC + CDT</span>
                      <h4 className="text-[15px] font-[800] text-[#0F172A] mt-2">Regime de Não Residentes</h4>
                    </div>
                    {isActive && <span className="shrink-0 text-[10px] font-[800] bg-amber-600 text-white px-2 py-1 rounded-full uppercase">Cliente Atual</span>}
                  </div>
                  <div className="space-y-1.5 text-[13px]">
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Para quem:</strong> Entidades estrangeiras com rendimentos obtidos em Portugal (estabelecimento estável, dividendos, royalties, etc.).</p>
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Como funciona:</strong> Tributação específica, muitas vezes com retenção na fonte. Depende da Convenção de Dupla Tributação (CDT) aplicável.</p>
                    <p className="text-[11px] text-[#94A3B8] font-[500] mt-1">Requer análise casuística. A AT disponibiliza orientações no Portal das Finanças.</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Regimes de IVA ── */}
          <h3 className="text-[14px] font-[800] text-[#0F172A] mb-4 mt-6 uppercase tracking-[0.5px]">Regimes de IVA</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* IVA Art. 53 */}
            {(() => {
              const isActive = clientProfile?.regimeIva === 'isento';
              return (
                <div className={`rounded-[16px] border-2 p-4 ${isActive ? 'border-emerald-500 bg-emerald-50' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                  <span className="text-[11px] font-[800] text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">Art. 53.º CIVA</span>
                  <h4 className="text-[14px] font-[800] text-[#0F172A] mt-2 mb-2 flex items-center justify-between">
                    Isenção de IVA
                    {isActive && <span className="text-[10px] font-[800] bg-emerald-600 text-white px-2 py-0.5 rounded-full">Cliente Atual</span>}
                  </h4>
                  <p className="text-[12px] text-[#475569] font-[500] mb-2">Pequenos negócios com faturação até <strong>≈ €15.000/ano</strong>. Não cobra IVA, não deduz IVA.</p>
                  <p className="text-[11px] text-[#94A3B8] font-[500]">Vantagem em B2C: preço final mais competitivo. Desvantagem: sem recuperação do IVA suportado nas compras.</p>
                </div>
              );
            })()}

            {/* IVA Trimestral */}
            {(() => {
              const isActive = clientProfile?.regimeIva === 'normal_trimestral';
              return (
                <div className={`rounded-[16px] border-2 p-4 ${isActive ? 'border-[#0F172A] bg-slate-50' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                  <span className="text-[11px] font-[800] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">CIVA Normal</span>
                  <h4 className="text-[14px] font-[800] text-[#0F172A] mt-2 mb-2 flex items-center justify-between">
                    Regime Normal Trimestral
                    {isActive && <span className="text-[10px] font-[800] bg-[#0F172A] text-white px-2 py-0.5 rounded-full">Cliente Atual</span>}
                  </h4>
                  <p className="text-[12px] text-[#475569] font-[500] mb-2">Declaração periódica de IVA a cada trimestre (4×/ano). Regra geral para faturação &lt; €650.000.</p>
                  <p className="text-[11px] text-[#94A3B8] font-[500]">Entrega até ao final do 2.º mês seguinte ao trimestre (ex: jan–mar → maio).</p>
                </div>
              );
            })()}

            {/* IVA Mensal */}
            {(() => {
              const isActive = clientProfile?.regimeIva === 'normal_mensal';
              return (
                <div className={`rounded-[16px] border-2 p-4 ${isActive ? 'border-[#781D1D] bg-[#FDF2F2]' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                  <span className="text-[11px] font-[800] text-[#781D1D] bg-[#FDF2F2] border border-[#F8B4B4] px-2 py-0.5 rounded-full">CIVA Normal</span>
                  <h4 className="text-[14px] font-[800] text-[#0F172A] mt-2 mb-2 flex items-center justify-between">
                    Regime Normal Mensal
                    {isActive && <span className="text-[10px] font-[800] bg-[#781D1D] text-white px-2 py-0.5 rounded-full">Cliente Atual</span>}
                  </h4>
                  <p className="text-[12px] text-[#475569] font-[500] mb-2">Declaração periódica mensal (12×/ano). Obrigatório para faturação ≥ €650.000/ano.</p>
                  <p className="text-[11px] text-[#94A3B8] font-[500]">Entrega até ao dia 20 do 2.º mês seguinte. Mais obrigações mas cashback de IVA mais rápido.</p>
                </div>
              );
            })()}

            {/* Pequenos Retalhistas */}
            {(() => {
              const isActive = clientProfile?.regimeIva === 'pequenos_retalhistas';
              return (
                <div className={`rounded-[16px] border-2 p-4 ${isActive ? 'border-amber-500 bg-amber-50' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
                  <span className="text-[11px] font-[800] text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">Art. 60.º-A CIVA</span>
                  <h4 className="text-[14px] font-[800] text-[#0F172A] mt-2 mb-2 flex items-center justify-between">
                    Regime dos Pequenos Retalhistas
                    {isActive && <span className="text-[10px] font-[800] bg-amber-600 text-white px-2 py-0.5 rounded-full">Cliente Atual</span>}
                  </h4>
                  <p className="text-[12px] text-[#475569] font-[500] mb-2">Pequenos comerciantes: IVA calculado com base nas <strong>compras</strong>, não nas vendas. Taxa de 25% sobre o IVA suportado.</p>
                  <p className="text-[11px] text-[#94A3B8] font-[500]">Atualmente pouco utilizado. Simplifica o apuramento mas pode ser desvantajoso em margens elevadas.</p>
                </div>
              );
            })()}

            {/* Isenção específica */}
            <div className="rounded-[16px] border-2 border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <span className="text-[11px] font-[800] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Art. 9.º CIVA</span>
              <h4 className="text-[14px] font-[800] text-[#0F172A] mt-2 mb-2">Isenção por Natureza da Atividade</h4>
              <p className="text-[12px] text-[#475569] font-[500] mb-2">Certas atividades estão isentas por natureza: saúde, educação, seguros, serviços financeiros, etc.</p>
              <p className="text-[11px] text-[#94A3B8] font-[500]">Diferente da isenção Art. 53.º — sem limite de faturação. Sem direito à dedução do IVA suportado.</p>
            </div>
          </div>

          {/* Tabela resumo obrigações */}
          <div className="mt-8 overflow-x-auto">
            <h3 className="text-[13px] font-[800] text-[#0F172A] mb-3 uppercase tracking-[0.5px]">Resumo de Obrigações por Regime</h3>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#0F172A] text-white">
                  <th className="text-left px-4 py-2 rounded-tl-[8px]">Regime</th>
                  <th className="text-center px-3 py-2">Contabilista OCC</th>
                  <th className="text-center px-3 py-2">Declarações IVA</th>
                  <th className="text-center px-3 py-2">Modelo 22 / Mod. 3</th>
                  <th className="text-center px-3 py-2 rounded-tr-[8px]">DAI / IES</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Simplificado ENI', 'Recomendado', '0 / trimestral / mensal', 'Mod. 3 Cat. B', 'Não'],
                  ['Contab. Organizada ENI', 'Obrigatório', '0 / trimestral / mensal', 'Mod. 3 Cat. B', 'Não'],
                  ['Contab. Organizada Lda/SA', 'Obrigatório', 'Trimestral ou Mensal', 'Modelo 22 IRC', 'Sim (IES)'],
                  ['Transparência Fiscal', 'Obrigatório', 'Trimestral ou Mensal', 'Mod. 22 + Mod. 3', 'Sim (IES)'],
                  ['RETGS', 'Obrigatório', 'Trimestral ou Mensal', 'Consolidado', 'Sim (consolidado)'],
                ].map(([regime, occ, iva, imp, ies], i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                    <td className="px-4 py-2 font-[700] text-[#0F172A]">{regime}</td>
                    <td className="px-3 py-2 text-center">{occ}</td>
                    <td className="px-3 py-2 text-center">{iva}</td>
                    <td className="px-3 py-2 text-center">{imp}</td>
                    <td className="px-3 py-2 text-center">{ies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 1. IRS — IMPOSTO SOBRE O RENDIMENTO DE PESSOAS SINGULARES  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={BookOpen} title="IRS — Imposto sobre o Rendimento (CIRS)" />

          <div className="space-y-6">
            {/* Escalões */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Escalões de IRS 2026 (Art. 68.º CIRS)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#0F172A] text-white">
                      <th className="text-left px-4 py-2 rounded-tl-[8px]">Rendimento Coletável</th>
                      <th className="text-right px-4 py-2">Taxa Marginal</th>
                      <th className="text-right px-4 py-2 rounded-tr-[8px]">Parcela a Abater</th>
                    </tr>
                  </thead>
                  <tbody>
                    {IRS_BRACKETS_2026.map((b, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                        <td className="px-4 py-2 font-[500]">
                          {i === 0 ? `Até ${ptEur(b.limit)}` :
                           b.limit === Infinity ? `Acima de ${ptEur(IRS_BRACKETS_2026[i-1].limit)}` :
                           `${ptEur(IRS_BRACKETS_2026[i-1].limit)} – ${ptEur(b.limit)}`}
                        </td>
                        <td className="px-4 py-2 text-right font-[700] text-[#781D1D]">{(b.rate * 100).toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right font-mono">{ptEur(b.ded)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 font-[500]">Fonte: OE 2026 (validado abril 2026) • Aplicável a residentes em Portugal Continental</p>
            </div>

            {/* IRS Jovem */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">IRS Jovem — Art. 12.º-B CIRS (OE 2025)</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-[12px] p-4 mb-3">
                <p className="text-[13px] text-blue-900 font-[500] leading-relaxed">
                  Aplica-se a trabalhadores até <strong>35 anos</strong>, nos primeiros 5 anos de atividade profissional. Teto máximo: <strong>5× IAS anual = {ptEur(IAS_2026 * 12 * 5)}</strong> (IAS 2026: {ptEur(IAS_2026)}).
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { ano: '1.º ano', taxa: '100%', desc: 'Isenção total do rendimento coletável' },
                  { ano: '2.º e 3.º anos', taxa: '75%', desc: 'Isenção de 75% do rendimento coletável' },
                  { ano: '4.º e 5.º anos', taxa: '50%', desc: 'Isenção de 50% do rendimento coletável' },
                ].map(({ ano, taxa, desc }) => (
                  <div key={ano} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-4 text-center">
                    <div className="text-[11px] font-[700] text-[#64748B] uppercase mb-1">{ano}</div>
                    <div className="text-[24px] font-[800] text-blue-600">{taxa}</div>
                    <div className="text-[11px] text-[#64748B] font-[500] mt-1">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regime Simplificado */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Regime Simplificado ENI — Art. 31.º CIRS</h3>
              <div className="space-y-2">
                <LegalRow label="Serviços — coeficiente" value="0,75 (rendimento coletável = 75% da faturação)" note="25% é automaticamente deduzido como despesas presumidas" />
                <LegalRow label="Bens — coeficiente" value="0,15 (rendimento coletável = 15% da faturação)" note="85% é automaticamente deduzido como custo de aquisição presumido" />
                <LegalRow label="Regra especial >€27.360 (serviços)" value="Justificação de despesas de 15% da faturação obrigatória" note="Sem justificação, o rendimento coletável é acrescido da diferença" />
              </div>
            </div>

            {/* Dependentes */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Dedução por Dependentes — Art. 78.º-A CIRS</h3>
              <div className="space-y-2">
                <LegalRow label="1.º ao 3.º dependente" value="€600 por dependente (dedução à coleta)" />
                <LegalRow label="A partir do 4.º dependente" value="€900 por dependente adicional" />
                <LegalRow label="Dependente com deficiência" value="€900 por dependente" />
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 font-[500]">Dedução à coleta (subtrai diretamente ao imposto calculado, não ao rendimento)</p>
            </div>

            {/* Retenção na Fonte */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Retenção na Fonte — Categoria B</h3>
              <div className="space-y-2">
                <LegalRow label="Serviços profissionais (geral)" value="11,5%" note="Aplicável quando o prestador emite fatura a entidades com contabilidade organizada" />
                <LegalRow label="Direitos de autor" value="16,5%" />
                <LegalRow label="Isenção para novos ENI" value="Primeiro ano: sem retenção obrigatória (Art. 101.º CIRS)" />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 2. IRC — IMPOSTO SOBRE O RENDIMENTO DE PESSOAS COLETIVAS   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Scale} title="IRC — Imposto sobre o Rendimento das Empresas (CIRC)" color="#334155" />

          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Taxas IRC — Art. 87.º CIRC</h3>
              <div className="space-y-2">
                <LegalRow label="PME — primeiros €50.000" value="15% (taxa reduzida para micro, pequenas e médias empresas)" note="Aplicável a PME conforme Art. 2.º da Recomendação CE 2003/361/CE" />
                <LegalRow label="Acima de €50.000" value="19% (taxa geral)" />
                <LegalRow label="Tributação mínima" value="15% de tributação mínima para empresas com volume de negócios >€2M (OE 2024)" />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Tributação Autónoma (TA) — Art. 88.º CIRC</h3>
              <p className="text-[13px] text-[#64748B] font-[500] mb-3">Incide sobre encargos com viaturas ligeiras de passageiros. Base de cálculo: depreciação + manutenção + seguro + combustível.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#781D1D] text-white">
                      <th className="text-left px-4 py-2 rounded-tl-[8px]">Custo Aquisição (s/ IVA)</th>
                      <th className="text-right px-4 py-2">Combustão / Híbrido</th>
                      <th className="text-right px-4 py-2">PHEV Conforme</th>
                      <th className="text-right px-4 py-2 rounded-tr-[8px]">Elétrico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { range: 'Até €27.500', gas: '8,5%', phev: '2,5%', elec: '0%' },
                      { range: '€27.500 – €35.000', gas: '25,5%', phev: '7,5%', elec: '0%' },
                      { range: 'Acima de €35.000', gas: '32,5%', phev: '15%', elec: '0%' },
                      { range: 'Acima de €62.500 (elétrico)', gas: '—', phev: '—', elec: '10%' },
                    ].map(({ range, gas, phev, elec }, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#FDF2F2]' : 'bg-white'}>
                        <td className="px-4 py-2 font-[500]">{range}</td>
                        <td className="px-4 py-2 text-right font-[700]">{gas}</td>
                        <td className="px-4 py-2 text-right font-[700] text-amber-700">{phev}</td>
                        <td className="px-4 py-2 text-right font-[700] text-emerald-700">{elec}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-[#94A3B8] font-[500]">PHEV Conforme: autonomia elétrica ≥50 km E emissões CO₂ &lt;50 g/km</p>
                <p className="text-[11px] text-[#94A3B8] font-[500]">Elétrico &gt;€62.500: Lei n.º 82/2023 — taxa de 10% sobre encargos (exceto atividades isentas)</p>
                <p className="text-[11px] text-[#94A3B8] font-[500]">Dispensa de TA: possível com acordo escrito de imputação de custos ao trabalhador (Art. 88.º, n.º 14)</p>
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Limites de Depreciação Fiscal (DR 25/2009 + OE 2026)</h3>
              <div className="space-y-2">
                <LegalRow label="Viaturas passageiros (geral)" value={`${ptEur(25000)} por veículo`} note="Taxa de depreciação: 25%/ano. Dep. acima do limite → não aceite fiscalmente" />
                <LegalRow label="Viaturas elétricas" value={`${ptEur(62500)} por veículo`} />
                <LegalRow label="PHEV conforme" value={`${ptEur(50000)} por veículo`} />
                <LegalRow label="GPL / GNV passageiros" value={`${ptEur(37500)} por veículo`} />
                <LegalRow label="Veículos comerciais / isentos" value="Sem limite (100% dedutível)" />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 3. IVA — IMPOSTO SOBRE O VALOR ACRESCENTADO               */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Scale} title="IVA — Imposto sobre o Valor Acrescentado (CIVA)" color="#1D4ED8" />

          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Taxas de IVA em Portugal Continental</h3>
              <div className="space-y-2">
                <LegalRow label="Taxa normal" value="23%" note="Aplica-se por defeito a todos os bens e serviços" />
                <LegalRow label="Taxa intermédia" value="13%" note="Restauração, vinho, etc." />
                <LegalRow label="Taxa reduzida" value="6%" note="Bens de primeira necessidade, livros, etc." />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Isenção PME — Art. 53.º CIVA</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-[12px] p-4">
                <p className="text-[13px] text-blue-900 font-[500] leading-relaxed">
                  Isenção de IVA para sujeitos passivos com <strong>volume de negócios ≤ €15.000</strong> no ano civil anterior e que <strong>não pratiquem operações de exportação ou intracomunitárias</strong>. A isenção é geralmente recomendada apenas para negócios B2C (consumidores finais não podem deduzir IVA).
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Dedução IVA — Viaturas (Art. 21.º CIVA)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#1D4ED8] text-white">
                      <th className="text-left px-4 py-2 rounded-tl-[8px]">Tipo de Viatura / Combustível</th>
                      <th className="text-right px-4 py-2">IVA Aquisição</th>
                      <th className="text-right px-4 py-2">IVA Manutenção</th>
                      <th className="text-right px-4 py-2 rounded-tr-[8px]">IVA Combustível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { tipo: 'Elétrico (passageiros, ≤€62.500)', aq: '100%', mant: '0%', comb: '100%' },
                      { tipo: 'PHEV conforme (passageiros, ≤€50.000)', aq: '100%', mant: '0%', comb: '0%' },
                      { tipo: 'Gasóleo (passageiros)', aq: '50%', mant: '0%', comb: '50%' },
                      { tipo: 'GPL / GNV (passageiros, ≤€37.500)', aq: '50%', mant: '0%', comb: '50%' },
                      { tipo: 'Gasolina / Híbrido não plug-in', aq: '0%', mant: '0%', comb: '0%' },
                      { tipo: 'Comercial (2/3 lugares)', aq: '100%', mant: '100%', comb: '100%' },
                      { tipo: 'Atividades isentas (táxi, TVDE, rent-a-car, esc. condução)', aq: '100%', mant: '100%', comb: '100%' },
                    ].map(({ tipo, aq, mant, comb }, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#EFF6FF]' : 'bg-white'}>
                        <td className="px-4 py-2 font-[500]">{tipo}</td>
                        <td className={`px-4 py-2 text-right font-[700] ${aq === '100%' ? 'text-emerald-600' : aq === '0%' ? 'text-red-500' : 'text-amber-600'}`}>{aq}</td>
                        <td className={`px-4 py-2 text-right font-[700] ${mant === '100%' ? 'text-emerald-600' : mant === '0%' ? 'text-red-500' : 'text-amber-600'}`}>{mant}</td>
                        <td className={`px-4 py-2 text-right font-[700] ${comb === '100%' ? 'text-emerald-600' : comb === '0%' ? 'text-red-500' : 'text-amber-600'}`}>{comb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 font-[500]">O seguro automóvel está isento de IVA em Portugal (sujeito a Imposto de Selo) — dedução de IVA = 0% por natureza.</p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 4. SEGURANÇA SOCIAL                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Shield} title="Segurança Social (SS)" color="#059669" />

          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">TSU — Trabalhadores por Conta de Outrem (TCO)</h3>
              <div className="space-y-2">
                <LegalRow label="Contribuição patronal (empresa)" value="23,75% sobre remuneração ilíquida" />
                <LegalRow label="Contribuição do trabalhador" value="11% sobre remuneração ilíquida" />
                <LegalRow label="Base de incidência" value="Todas as remunerações, incluindo subsídios de férias e Natal (14 meses)" />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">SS Independente — CRCSPSS Art. 162.º e ss.</h3>
              <div className="space-y-2">
                <LegalRow label="Taxa de contribuição 2026" value="21,4% sobre rendimento relevante" />
                <LegalRow label="Base — Prestação de Serviços" value="70% do rendimento mensal declarado" note="Efetivo: 14,98% do rendimento bruto" />
                <LegalRow label="Base — Venda de Bens" value="20% do rendimento mensal declarado" note="Efetivo: 4,28% do rendimento bruto" />
                <LegalRow label="Mínimo de contribuição" value={`€20,00/mês (se rendimento > IAS — ${ptEur(IAS_2026)})`} />
                <LegalRow label="Pagamento" value="Trimestral — até dia 20 de jan, abr, jul e out" />
                <LegalRow label="Isenção 1.º ano" value="Total — Art. 164.º CRCSPSS" note="Aplica-se a novos inscritos como TI. Isenção durante 12 meses." />
                <LegalRow label="Isenção TCO secundário" value="Se rendimento ≤€20.000 e atividade não é principal: isenção de SS como TI" />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Cálculo Trimestral na Prática</h3>
              <div className="bg-[#F0FDF4] border border-emerald-200 rounded-[12px] p-4">
                <p className="text-[13px] text-emerald-900 font-[500] leading-relaxed">
                  A SS calcula o <strong>rendimento relevante trimestral</strong> com base nos rendimentos do trimestre anterior (declarados na plataforma da Segurança Social Direta). A contribuição trimestral = rendimento médio mensal do trimestre anterior × base (70% ou 20%) × 21,4% × 3 meses.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 5. TICKETS DE REFEIÇÃO                                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Ticket} title="Tickets / Vales de Refeição" color="#7C3AED" />

          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Limites e Isenções — DL 133/2024 + EBF Art. 18.º-A</h3>
              <div className="space-y-2">
                <LegalRow label="Limite diário — setor geral" value="€5,00/dia útil" note="Acima deste valor, o excedente é tributável em IRS e sujeito a SS para o trabalhador" />
                <LegalRow label="Limite diário — hotelaria/restauração/construção" value="€7,00/dia útil" note="DL 133/2024, com efeitos a partir de 1 janeiro 2024" />
                <LegalRow label="Isenção SS para o trabalhador" value="Total — até ao limite legal diário" />
                <LegalRow label="Isenção IRS para o trabalhador" value="Total — até ao limite legal diário" />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Dedutibilidade para a Empresa — CIRC Art. 43.º</h3>
              <div className="space-y-2">
                <LegalRow label="Percentagem dedutível" value="60% do custo total dos tickets" note="Apenas o custo dentro do limite legal. Excedente: 0% dedutível." />
                <LegalRow label="SS patronal sobre tickets" value="Não aplicável — até ao limite legal (poupança de 23,75%)" />
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-[12px] p-4">
              <h4 className="text-[13px] font-[700] text-purple-900 mb-2">Comparação: Ticket vs Aumento Salarial Equivalente</h4>
              <p className="text-[13px] text-purple-800 font-[500] leading-relaxed">
                Se a empresa paga €5/dia × 22 dias × 12 meses = €1.320/ano por trabalhador em tickets, pouparia €1.320 × 23,75% = €313,50/trabalhador em SS patronal face a um aumento salarial equivalente. O trabalhador recebe o mesmo valor líquido (sem descontos).
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 6. IMT — IMPOSTO MUNICIPAL SOBRE TRANSMISSÕES              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Building} title="IMT — Imposto Municipal sobre Transmissões (CIMT)" color="#7C3AED" />

          <div className="space-y-6">
            <p className="text-[13px] text-[#64748B] font-[500] leading-relaxed">
              O IMT incide sobre a transmissão onerosa de imóveis situados em Portugal. As taxas e limites abaixo aplicam-se ao Continente (Madeira e Açores têm thresholds 25% superiores).
            </p>

            {/* Tabela HPP */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Habitação Própria e Permanente (HPP) — Continente 2026</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#7C3AED] text-white">
                      <th className="text-left px-4 py-2 rounded-tl-[8px]">Valor de Aquisição</th>
                      <th className="text-right px-4 py-2">Taxa Marginal</th>
                      <th className="text-right px-4 py-2 rounded-tr-[8px]">Parcela a Abater</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { range: 'Até €106.346', taxa: '0%', ded: '—' },
                      { range: '€106.346 – €145.470', taxa: '2%', ded: '€2.126,92' },
                      { range: '€145.470 – €198.347', taxa: '5%', ded: '€6.491,02' },
                      { range: '€198.347 – €330.539', taxa: '7%', ded: '€10.457,96' },
                      { range: '€330.539 – €660.982', taxa: '8%', ded: '€13.763,35' },
                      { range: '€660.982 – €1.150.853', taxa: '6% (plana)', ded: '—' },
                      { range: 'Acima de €1.150.853', taxa: '7,5% (plana)', ded: '—' },
                    ].map(({ range, taxa, ded }, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#F5F3FF]' : 'bg-white'}>
                        <td className="px-4 py-2 font-[500]">{range}</td>
                        <td className="px-4 py-2 text-right font-[700] text-[#7C3AED]">{taxa}</td>
                        <td className="px-4 py-2 text-right font-mono">{ded}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Outras taxas */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Outras Taxas IMT — CIMT Art. 17.º</h3>
              <div className="space-y-2">
                <LegalRow label="Habitação secundária / arrendamento" value="Escalões progressivos (1% a 7,5%)" note="Thresholds inferiores aos da HPP. Tabela própria no CIMT." />
                <LegalRow label="Prédios urbanos — outros fins" value="6,5% (taxa plana)" note="Comércio, serviços, indústria, armazéns" />
                <LegalRow label="Prédios rústicos" value="5% (taxa plana)" />
                <LegalRow label="Madeira e Açores" value="Thresholds 25% superiores ao Continente" />
              </div>
            </div>

            {/* IMT Jovem */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">IMT Jovem — CIMT Art. 11.º-A (OE 2026)</h3>
              <div className="bg-purple-50 border border-purple-200 rounded-[12px] p-4 mb-4">
                <p className="text-[13px] text-purple-900 font-[500] leading-relaxed">
                  <strong>Condições:</strong> Comprador com idade ≤ 35 anos, aquisição de HPP como primeira habitação.
                </p>
              </div>
              <div className="space-y-2">
                <LegalRow label="Até €330.539 (Continente)" value="IMT = 0 e Imposto de Selo = 0 (isenção total)" note="Medida introduzida pelo OE 2026 para facilitar acesso à habitação" />
                <LegalRow label="€330.539 – €660.982" value="IMT sobre excedente acima de €330.539" note="Cálculo: IMT_normal(valor) - IMT_normal(330.539); IS também isento" />
                <LegalRow label="Acima de €660.982" value="IMT e IS normais (sem isenção jovem)" />
              </div>
            </div>

            {/* Imposto de Selo */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Imposto de Selo — TGIS Verba 1.1</h3>
              <div className="space-y-2">
                <LegalRow label="Taxa" value="0,8% sobre o valor de transação" note="Incide sobre aquisições onerosas de imóveis. Pago pelo adquirente." />
                <LegalRow label="IMT Jovem" value="Isento até ao tecto da isenção total (€330.539)" />
                <LegalRow label="Hipotecas" value="0,6% sobre o capital mutuado (verba 17.3 TGIS)" />
              </div>
            </div>

            {/* Outros custos */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-4">
              <h4 className="text-[13px] font-[700] text-[#0F172A] mb-2">Outros Custos de Aquisição (estimativas)</h4>
              <div className="space-y-1 text-[12px] text-[#64748B]">
                <div>• Escritura notarial: ~0,5% do valor de transação</div>
                <div>• Registo predial: ~0,25% do valor de transação</div>
                <div>• IMI (imposto anual): 0,3%–0,8% do VPT (Valor Patrimonial Tributário)</div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 7. SALÁRIO LÍQUIDO — TCO                                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Banknote} title="Salário Líquido — Trabalhador por Conta de Outrem" color="#0369A1" />

          <div className="space-y-6">
            <p className="text-[13px] text-[#64748B] font-[500] leading-relaxed">
              Cálculo do salário líquido para TCO, com descontos de SS, retenção de IRS e subsídio de alimentação. Base legal: CIRS Art. 99.º (retenção) e CRCSPSS Art. 53.º (SS).
            </p>

            {/* SS TCO */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Segurança Social — Taxas TCO (CRCSPSS Art. 53.º)</h3>
              <div className="space-y-2">
                <LegalRow label="Taxa do trabalhador" value="11% sobre remuneração ilíquida" />
                <LegalRow label="Taxa patronal (empresa)" value="23,75% sobre remuneração ilíquida" />
                <LegalRow label="Custo total" value="34,75% por mês (trabalhador + empresa)" />
                <LegalRow label="Base de incidência" value="Todas as remunerações, exceto ajudas de custo, despesas de deslocação e subsídio de alimentação isento" />
              </div>
            </div>

            {/* Dedução específica */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Retenção na Fonte IRS — CIRS Art. 99.º</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-[12px] p-4 mb-3">
                <p className="text-[13px] text-blue-900 font-[500] leading-relaxed">
                  A retenção aproxima-se do IRS anual estimado / nº de pagamentos anuais. Fórmula simplificada utilizada no simulador (via escalões progressivos 2026).
                </p>
              </div>
              <div className="space-y-2">
                <LegalRow label="Dedução específica Cat. A — CIRS Art. 25.º" value="Maior de: €4.104 ou 72% do rendimento anual bruto" note="Subtrai ao rendimento bruto para determinar o rendimento coletável" />
                <LegalRow label="Nº de pagamentos (sem duodécimos)" value="14 pagamentos (12 × ordenado + sub. férias + sub. Natal)" />
                <LegalRow label="Nº de pagamentos (com duodécimos)" value="12 pagamentos (subsídios distribuídos mensalmente)" />
              </div>
            </div>

            {/* Subsídio alimentação */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Subsídio de Alimentação — DL 133/2024 / Despacho 233-A/2026</h3>
              <div className="space-y-2">
                <LegalRow label="Limite isento — dinheiro" value="€6,15/dia" note="Atualizado pelo Despacho 233-A/2026 (vigorou a partir de 1 jan 2026)" />
                <LegalRow label="Limite isento — cartão/vale refeição" value="€10,46/dia" note="Pagamento em suporte eletrónico (cartão refeição) tem limite superior" />
                <LegalRow label="Hotelaria / Restauração / Construção" value="€7,00/dia (em dinheiro)" note="DL 133/2024 — setores específicos" />
                <LegalRow label="Excedente ao limite" value="Tributável em IRS e sujeito a SS (para o trabalhador)" />
                <LegalRow label="Para a empresa" value="Custo dedutível em IRC (CIRC Art. 23.º)" note="Parte dentro do limite: não sujeita a SS patronal" />
              </div>
            </div>

            {/* SMN */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Salário Mínimo Nacional 2026</h3>
              <div className="space-y-2">
                <LegalRow label="SMN 2026" value="€870/mês" note="DL n.º 94/2025, de 31 dezembro 2025" />
                <LegalRow label="SMN anual (14 meses)" value="€12.180" />
                <LegalRow label="Custo empresa SMN" value="~€1.066,63/mês (SMN + 23,75% SS patronal)" />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 8. IMÓVEIS NA EMPRESA                                      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={Home} title="Imóveis na Empresa — Enquadramento Fiscal" color="#065F46" />

          <div className="space-y-6">
            <p className="text-[13px] text-[#64748B] font-[500] leading-relaxed">
              A decisão de colocar um imóvel em nome da empresa (entrada em espécie) ou mantê-lo em nome pessoal e arrendar/ceder à empresa tem implicações fiscais significativas. Resumem-se abaixo os principais pontos legais.
            </p>

            {/* Arrendamento */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Arrendamento / Comodato — Regime Fiscal</h3>
              <div className="space-y-2">
                <LegalRow label="IRS — Categoria F (rendas)" value="Taxa de 28% sobre rendas recebidas" note="CIRS Art. 8.º — opção de englobamento pode ser mais favorável em escalões baixos" />
                <LegalRow label="Isenção de IVA sobre rendas" value="Rendas de imóveis isentas de IVA por natureza (CIVA Art. 9.º, n.º 29)" />
                <LegalRow label="IMI" value="Continua em nome do titular (não há transmissão)" />
                <LegalRow label="Comodato" value="Cedência gratuita. Sem IRS na esfera do sócio, mas a empresa não pode deduzir renda" note="Diferente do arrendamento oneroso. A AT pode contestar subavaliações." />
                <LegalRow label="Gasto dedutível na empresa" value="Sim, se arrendamento oneroso (Art. 23.º CIRC)" note="A renda paga é custo fiscal da empresa" />
              </div>
            </div>

            {/* Entrada em Espécie */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Entrada em Espécie — Regime Fiscal</h3>
              <div className="space-y-2">
                <LegalRow label="IMT" value="Aplicável — taxa depende do tipo de imóvel (ver secção IMT)" note="Base de incidência: maior entre valor de transação e VPT (CIMT Art. 12.º)" />
                <LegalRow label="Imposto de Selo" value="0,8% sobre o valor de transação (TGIS verba 1.1)" />
                <LegalRow label="Escritura notarial" value="Obrigatória — honorários ~0,5-1% do valor" />
                <LegalRow label="IVA na transmissão" value="Geralmente isento — imóveis usados (CIVA Art. 9.º, n.º 30)" note="Exceto imóveis novos ou reabilitados — sujeitos a IVA 23%" />
                <LegalRow label="Depreciação fiscal" value="2%/ano sobre valor de aquisição (DR 25/2009)" note="CIRC Art. 31.º — imóveis afetos à atividade podem ser depreciados fiscalmente" />
                <LegalRow label="Mais-valias na venda futura" value="IRC sobre mais-valia (valor venda - valor líquido contabilístico)" note="Reinvestimento pode beneficiar de exclusão tributária — CIRC Art. 48.º" />
                <LegalRow label="Reavaliação IMI" value="Transmissão implica reavaliação do VPT. Taxa IMI sobre novo VPT." />
              </div>
            </div>

            {/* ENI específico */}
            <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-4">
              <h4 className="text-[13px] font-[700] text-amber-900 mb-2">ENI — Afetação do Imóvel à Atividade</h4>
              <p className="text-[13px] text-amber-800 font-[500] leading-relaxed mb-2">
                Para ENIs (Categoria B), a afetação parcial de um imóvel à atividade (ex: home office) é possível mas mais complexa:
              </p>
              <div className="space-y-1 text-[12px] text-amber-700">
                <div>• Dedução da proporção das despesas (percentagem afeta à atividade)</div>
                <div>• Não há "transmissão" — apenas afetação contabilística</div>
                <div>• Desafetação posterior pode implicar tributação de mais-valias latentes</div>
                <div>• CIRS Art. 3.º, n.º 2, alínea d) — afetação de bens a atividade</div>
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Artigos de Referência</h3>
              <div className="space-y-1">
                <Article code="CIRS Art. 8.º" description="Rendimentos da categoria F — rendas e arrendamento" />
                <Article code="CIVA Art. 9.º, n.º 29-30" description="Isenção de IVA em operações imobiliárias" />
                <Article code="CIRC Art. 23.º" description="Gastos dedutíveis — incluindo rendas pagas pela empresa" />
                <Article code="CIRC Art. 29.º e 31.º" description="Depreciações e amortizações fiscais de imóveis" />
                <Article code="CIRC Art. 48.º" description="Exclusão de tributação de mais-valias por reinvestimento" />
                <Article code="CIMT Art. 12.º" description="Base tributável IMT — maior de VPT vs valor de contrato" />
                <Article code="DR 25/2009" description="Taxas de depreciação — imóveis afetos à atividade: 2%/ano" />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* REFERÊNCIAS LEGISLATIVAS COMPLETAS                         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0]">
          <SectionHeader icon={BookOpen} title="Índice de Referências Legislativas" color="#475569" />

          <div className="space-y-1">
            <Article code="CIRS Art. 12.º-B" description="IRS Jovem — Isenção progressiva para trabalhadores ≤35 anos nos primeiros 5 anos de atividade (OE 2025)" />
            <Article code="CIRS Art. 28.º" description="Categorias de rendimento de atividade empresarial e profissional (Categoria B)" />
            <Article code="CIRS Art. 31.º" description="Regime Simplificado — coeficientes de 0,15 (bens) e 0,75 (serviços)" />
            <Article code="CIRS Art. 68.º" description="Taxas gerais de IRS 2026 — escalões progressivos de 13% a 48%" />
            <Article code="CIRS Art. 78.º-A" description="Dedução por dependentes — €600/dependente (€900 a partir do 4.º)" />
            <Article code="CIRS Art. 101.º" description="Retenção na fonte — Categoria B: 11,5% para serviços profissionais" />
            <Article code="CIRC Art. 87.º" description="Taxas de IRC: 15% (PME, primeiros €50k) / 19% (geral)" />
            <Article code="CIRC Art. 88.º, n.º 3" description="Tributação autónoma sobre encargos com viaturas ligeiras de passageiros" />
            <Article code="CIRC Art. 43.º" description="Dedutibilidade de encargos com vales de refeição: 60% do custo" />
            <Article code="CIVA Art. 21.º" description="Exclusões do direito à dedução de IVA — viaturas e combustíveis" />
            <Article code="CIVA Art. 53.º" description="Regime especial de isenção para PME com volume de negócios ≤€15.000" />
            <Article code="DR 25/2009" description="Tabelas de depreciações e amortizações fiscais" />
            <Article code="DL 110/2009" description="Código dos Regimes Contributivos do Sistema Previdencial (CRCSPSS)" />
            <Article code="CRCSPSS Art. 162.º" description="Base de incidência da SS para trabalhadores independentes" />
            <Article code="CRCSPSS Art. 164.º" description="Isenção de contribuições no 1.º ano de atividade independente" />
            <Article code="EBF Art. 18.º-A" description="Isenção de SS e IRS para vales de refeição até ao limite legal" />
            <Article code="DL 133/2024" description="Novos limites diários de vales de refeição: €5,00 (geral) / €7,00 (hotelaria/construção)" />
            <Article code="Lei n.º 82/2023" description="Tributação autónoma de 10% para viaturas elétricas com custo >€62.500" />
            <Article code="OE 2026" description="Orçamento do Estado para 2026 — referência principal para todos os valores desta ferramenta" />
            <Article code="CIMT Art. 11.º-A" description="IMT Jovem — isenção total de IMT e IS para compradores ≤35 anos na 1.ª habitação até €330.539 (Continente)" />
            <Article code="CIMT Art. 17.º" description="Tabela de taxas IMT — HPP, habitação secundária, prédios urbanos e rústicos" />
            <Article code="TGIS Verba 1.1" description="Imposto de Selo sobre transmissões de imóveis — 0,8% sobre o valor de aquisição" />
            <Article code="CRCSPSS Art. 53.º" description="Taxas de SS TCO: 11% (trabalhador) + 23,75% (patronal)" />
            <Article code="CIRS Art. 25.º" description="Dedução específica Categoria A — mínimo €4.104 ou 72% do rendimento bruto anual" />
            <Article code="Despacho 233-A/2026" description="Limites do subsídio de alimentação 2026: €6,15/dia (dinheiro), €10,46/dia (cartão)" />
            <Article code="DL n.º 94/2025" description="Salário Mínimo Nacional 2026: €870/mês" />
            <Article code="CIRS Art. 8.º" description="Rendimentos da Categoria F — rendas e arrendamento de imóveis" />
            <Article code="CIRC Art. 31.º" description="Depreciações de imóveis afetos à atividade empresarial — taxa de 2%/ano" />
            <Article code="DR 25/2009" description="Tabelas de depreciações — imóveis afetos à atividade" />
          </div>
        </section>

        {/* Rodapé */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-full px-6 py-3 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[13px] font-[600] text-[#475569]">
              Informação atualizada em <strong>Abril de 2026</strong> • RECOFATIMA Contabilidade
            </span>
          </div>
          <p className="text-[12px] text-[#94A3B8] mt-3 max-w-xl mx-auto">
            Esta ferramenta é desenvolvida e mantida pela equipa RECOFATIMA. Para questões específicas sobre a sua situação fiscal, consulte sempre um contabilista certificado (OCC).
          </p>
        </div>
      </div>
    </div>
  );
}
