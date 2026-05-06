import React, { useEffect, useState } from 'react';
import {
  ClipboardCheck, User, Briefcase, FileText, TrendingUp, Calculator, Wallet,
  Users, Shield, Banknote, Car, Building, PieChart, AlertTriangle, Target,
  Lightbulb, FolderCheck, Search, Printer, Plus, Trash2, BookOpen,
} from 'lucide-react';
import type { ClientProfile } from './ClientProfile';
import { defaultFichaState, type FichaState } from './fichaState';

// Re-export for any existing import sites that pull from this module.
export { defaultFichaState };
export type { FichaState };

// ════════════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════════════

// FichaState type and defaultFichaState() factory live in ./fichaState
// (re-exported above) so App.tsx can import them statically without preventing
// React.lazy() from code-splitting this component into its own chunk.

// ════════════════════════════════════════════════════════════════════════
// Sidebar
// ════════════════════════════════════════════════════════════════════════

type SectionEntry = { id: string; label: string; Icon: React.ElementType; legalAnchor?: string };

const FICHA_SECTIONS: SectionEntry[] = [
  { id: 'fd-identificacao',  label: '1. Identificação',     Icon: User },
  { id: 'fd-situacao',       label: '2. Situação Atual',    Icon: Briefcase, legalAnchor: 'legal-csc' },
  { id: 'fd-atividade',      label: '3. Atividade',         Icon: FileText,  legalAnchor: 'legal-cae' },
  { id: 'fd-faturacao',      label: '4. Previsão Faturação', Icon: TrendingUp },
  { id: 'fd-iva',            label: '5. Regime IVA',         Icon: Calculator, legalAnchor: 'legal-iva' },
  { id: 'fd-custos',         label: '6. Estrutura Custos',  Icon: Wallet },
  { id: 'fd-rh',             label: '7. Recursos Humanos',  Icon: Users,     legalAnchor: 'legal-salario' },
  { id: 'fd-ss',             label: '8. Segurança Social',  Icon: Shield,    legalAnchor: 'legal-ss' },
  { id: 'fd-investimento',   label: '9. Investimento',      Icon: Banknote },
  { id: 'fd-viaturas',       label: '10. Viaturas',          Icon: Car,       legalAnchor: 'legal-irc' },
  { id: 'fd-societaria',     label: '11. Estrutura Societária', Icon: Building, legalAnchor: 'legal-csc' },
  { id: 'fd-distribuicao',   label: '12. Distribuição',     Icon: PieChart,  legalAnchor: 'legal-distribuicao' },
  { id: 'fd-fiscal',         label: '13. Situação Fiscal',  Icon: AlertTriangle, legalAnchor: 'legal-dividas' },
  { id: 'fd-objetivos',      label: '14. Objetivos',        Icon: Target },
  { id: 'fd-intencoes',      label: '15. Intenções',        Icon: Lightbulb },
  { id: 'fd-documentos',     label: '16. Documentos',       Icon: FolderCheck, legalAnchor: 'legal-docs' },
  { id: 'fd-analise',        label: 'Análise Interna',      Icon: Search },
];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function FichaSidebar() {
  const [activeId, setActiveId] = useState<string>(FICHA_SECTIONS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).map(e => e.target.id);
        if (visible.length === 0) return;
        const first = FICHA_SECTIONS.map(s => s.id).find(id => visible.includes(id));
        if (first) setActiveId(first);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    );
    FICHA_SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleClick = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
    setActiveId(id);
  };

  return (
    <nav className="space-y-0.5" aria-label="Índice da ficha">
      <p className="text-[10px] font-[800] uppercase tracking-[1.5px] text-[#94A3B8] mb-3 px-3">Ficha</p>
      {FICHA_SECTIONS.map(({ id, label, Icon }) => {
        const isActive = activeId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => handleClick(id)}
            aria-current={isActive ? 'true' : undefined}
            className={
              'w-full flex items-center gap-2 pl-3 pr-3 py-1.5 rounded-[8px] text-[12px] font-[600] transition-all text-left border-l-2 ' +
              (isActive
                ? 'bg-[#FDF2F2] text-[#781D1D] border-[#781D1D] font-[700]'
                : 'border-transparent text-slate-600 hover:text-[#0F172A] hover:bg-slate-50')
            }
          >
            <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Reusable bits
// ════════════════════════════════════════════════════════════════════════

const inputClass = "w-full px-3 py-2 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] focus:border-[#781D1D] outline-none transition-all";
const labelClass = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-1.5";

function Section({
  id, icon: Icon, title, color = '#781D1D', legalAnchor, openLegalAt, children,
}: {
  id: string; icon: React.ElementType; title: string; color?: string;
  legalAnchor?: string; openLegalAt?: (anchor: string) => void; children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-white rounded-[20px] p-7 shadow-sm border border-[#E2E8F0] scroll-mt-24 ficha-card">
      <div className="flex items-center gap-3 mb-5 pb-3 border-b-2" style={{ borderColor: color }}>
        <div className="p-2 rounded-[10px]" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <h2 className="text-[17px] font-[800] text-[#0F172A] flex-1">{title}</h2>
        {legalAnchor && openLegalAt && (
          <button
            onClick={() => openLegalAt(legalAnchor)}
            className="no-print flex items-center gap-1 text-[10.5px] font-[700] text-[#781D1D] hover:bg-[#FDF2F2] px-2.5 py-1.5 rounded-[6px] transition-colors"
            title="Ver na Base Legal"
          >
            <BookOpen className="w-3 h-3" />
            Base Legal →
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number" min={0} step={100}
        value={value || ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={inputClass}
      />
      <span className="text-[13px] text-[#64748B] font-[600]">€</span>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded-[6px] hover:bg-slate-50 transition-colors">
      <input
        type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-[#781D1D] cursor-pointer"
      />
      <span className="text-[13px] font-[600] text-[#334155]">{label}</span>
    </label>
  );
}

function YesNo({ value, onChange }: { value: 'sim' | 'nao' | ''; onChange: (v: 'sim' | 'nao') => void }) {
  const opt = (val: 'sim' | 'nao', label: string) => (
    <button
      type="button"
      onClick={() => onChange(val)}
      className={
        'flex-1 px-4 py-2 rounded-[8px] text-[13px] font-[700] transition-all border-2 ' +
        (value === val
          ? 'bg-[#781D1D] text-white border-[#781D1D]'
          : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#781D1D]/40')
      }
    >
      {label}
    </button>
  );
  return <div className="flex gap-2">{opt('sim', 'Sim')}{opt('nao', 'Não')}</div>;
}

// ════════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════════

interface Props {
  initialState: FichaState;
  onStateChange: (s: FichaState) => void;
  openLegalAt: (anchor: string) => void;
  clientProfile?: ClientProfile;
}

export default function FichaDiagnostico({ initialState, onStateChange, openLegalAt, clientProfile }: Props) {
  const s = initialState;
  const update = <K extends keyof FichaState>(key: K, value: FichaState[K]) => {
    onStateChange({ ...s, [key]: value });
  };

  // One-shot pre-fill from client profile on first mount if Ficha still empty.
  useEffect(() => {
    if (!s.identificacao.nome && clientProfile?.nomeCliente) {
      onStateChange(defaultFichaState(clientProfile));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrint = () => window.print();
  const reseedFromProfile = () => {
    if (!clientProfile) return;
    // Confirm before overwriting any work the user has typed in the form.
    const ok = window.confirm(
      'Isto substitui os dados atualmente preenchidos na ficha pelos do Perfil. Continuar?'
    );
    if (ok) onStateChange(defaultFichaState(clientProfile));
  };

  return (
    <div className="h-full bg-[#F8FAFC] overflow-y-auto" id="ficha-root">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-6 md:px-10 py-4 flex items-center gap-4 no-print">
        <div className="p-2 rounded-[10px] bg-[#781D1D15]">
          <ClipboardCheck className="w-5 h-5 text-[#781D1D]" />
        </div>
        <div>
          <h1 className="text-[18px] font-[800] text-[#0F172A]">Ficha de Diagnóstico Fiscal e Empresarial</h1>
          <p className="text-[11px] font-[600] text-[#781D1D] uppercase tracking-[1px]">Levantamento estruturado do cliente • PT 2026</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {clientProfile?.nomeCliente && (
            <button
              type="button"
              onClick={reseedFromProfile}
              className="flex items-center gap-2 text-[12px] font-[700] text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 px-3 py-2 rounded-[10px] transition-all border border-[#E2E8F0]"
              title="Recarregar dados a partir do Perfil (substitui edições atuais)"
            >
              Pré-preencher do Perfil
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            aria-label="Imprimir ou guardar PDF"
            className="flex items-center gap-2 text-[13px] font-[700] text-white bg-[#781D1D] hover:bg-[#5A1313] px-4 py-2 rounded-[10px] transition-all active:scale-[0.98] shadow-sm shadow-[#781D1D]/20"
          >
            <Printer size={15} aria-hidden="true" />
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
          <aside className="hidden lg:block sticky top-[80px] self-start max-h-[calc(100vh-100px)] overflow-y-auto pr-2 no-print">
            <FichaSidebar />
          </aside>

          <div className="min-w-0 max-w-4xl space-y-8">

            {/* 1. Identificação */}
            <Section id="fd-identificacao" icon={User} title="1. Identificação do Cliente">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome / Denominação social">
                  <input type="text" value={s.identificacao.nome} onChange={e => update('identificacao', { ...s.identificacao, nome: e.target.value })} className={inputClass} />
                </Field>
                <Field label="NIF / NIPC">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{9}"
                    maxLength={9}
                    value={s.identificacao.nif}
                    onChange={e => update('identificacao', { ...s.identificacao, nif: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Data de nascimento (se pessoa singular)">
                  <input type="date" value={s.identificacao.dataNascimento} onChange={e => update('identificacao', { ...s.identificacao, dataNascimento: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Estado civil">
                  <select value={s.identificacao.estadoCivil} onChange={e => update('identificacao', { ...s.identificacao, estadoCivil: e.target.value })} className={inputClass}>
                    <option value="">—</option>
                    <option value="solteiro">Solteiro(a)</option>
                    <option value="casado">Casado(a)</option>
                    <option value="uniao_facto">União de facto</option>
                    <option value="divorciado">Divorciado(a)</option>
                    <option value="viuvo">Viúvo(a)</option>
                  </select>
                </Field>
                <Field label="Número de dependentes">
                  <input type="number" min={0} value={s.identificacao.dependentes} onChange={e => update('identificacao', { ...s.identificacao, dependentes: parseInt(e.target.value) || 0 })} className={inputClass} />
                </Field>
                <Field label="Telefone">
                  <input type="tel" autoComplete="tel" inputMode="tel" value={s.identificacao.telefone} onChange={e => update('identificacao', { ...s.identificacao, telefone: e.target.value })} className={inputClass} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Morada fiscal">
                    <input type="text" autoComplete="street-address" value={s.identificacao.morada} onChange={e => update('identificacao', { ...s.identificacao, morada: e.target.value })} className={inputClass} />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Email">
                    <input type="email" autoComplete="email" inputMode="email" value={s.identificacao.email} onChange={e => update('identificacao', { ...s.identificacao, email: e.target.value })} className={inputClass} />
                  </Field>
                </div>
              </div>
            </Section>

            {/* 2. Situação Atual */}
            <Section id="fd-situacao" icon={Briefcase} title="2. Situação Atual" legalAnchor="legal-csc" openLegalAt={openLegalAt}>
              <p className="text-[12px] text-[#64748B] mb-3 font-[500]">Assinalar a situação do cliente:</p>
              <div className="space-y-1">
                {([
                  ['naoIniciou', 'Ainda não iniciou atividade'],
                  ['eni', 'Empresário em Nome Individual (ENI)'],
                  ['unipessoal', 'Sociedade Unipessoal Lda'],
                  ['quotas', 'Sociedade por Quotas'],
                  ['tcoMaisIndep', 'Trabalhador dependente + atividade independente'],
                  ['outra', 'Outra situação'],
                ] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded-[6px] hover:bg-slate-50">
                    <input
                      type="radio" name="fd-situacao" checked={s.situacaoAtual.tipo === val}
                      onChange={() => update('situacaoAtual', { ...s.situacaoAtual, tipo: val })}
                      className="w-4 h-4 accent-[#781D1D] cursor-pointer"
                    />
                    <span className="text-[13px] font-[600] text-[#334155]">{label}</span>
                  </label>
                ))}
              </div>
              {s.situacaoAtual.tipo === 'outra' && (
                <div className="mt-3">
                  <input
                    type="text" placeholder="Descrever..."
                    value={s.situacaoAtual.outraDesc}
                    onChange={e => update('situacaoAtual', { ...s.situacaoAtual, outraDesc: e.target.value })}
                    className={inputClass}
                  />
                </div>
              )}
            </Section>

            {/* 3. Tipo de Atividade */}
            <Section id="fd-atividade" icon={FileText} title="3. Tipo de Atividade" legalAnchor="legal-cae" openLegalAt={openLegalAt}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Field label="Descrição da atividade">
                    <input type="text" value={s.atividade.descricao} onChange={e => update('atividade', { ...s.atividade, descricao: e.target.value })} className={inputClass} />
                  </Field>
                </div>
                <Field label="CAE principal">
                  <input type="text" value={s.atividade.caePrincipal} onChange={e => update('atividade', { ...s.atividade, caePrincipal: e.target.value })} className={inputClass} />
                </Field>
                <Field label="CAE secundários (se existirem)">
                  <input type="text" value={s.atividade.caeSecundarios} onChange={e => update('atividade', { ...s.atividade, caeSecundarios: e.target.value })} className={inputClass} />
                </Field>
              </div>
              <p className="text-[12px] text-[#64748B] mt-4 mb-2 font-[500]">Local da atividade:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                <Check label="Online" checked={s.atividade.local.online} onChange={v => update('atividade', { ...s.atividade, local: { ...s.atividade.local, online: v } })} />
                <Check label="Estabelecimento físico" checked={s.atividade.local.fisico} onChange={v => update('atividade', { ...s.atividade, local: { ...s.atividade.local, fisico: v } })} />
                <Check label="Prestação de serviços no cliente" checked={s.atividade.local.cliente} onChange={v => update('atividade', { ...s.atividade, local: { ...s.atividade.local, cliente: v } })} />
                <Check label="Misto" checked={s.atividade.local.misto} onChange={v => update('atividade', { ...s.atividade, local: { ...s.atividade.local, misto: v } })} />
              </div>
            </Section>

            {/* 4. Previsão Faturação */}
            <Section id="fd-faturacao" icon={TrendingUp} title="4. Previsão de Faturação">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Ano 1"><MoneyInput value={s.faturacao.ano1} onChange={v => update('faturacao', { ...s.faturacao, ano1: v })} /></Field>
                <Field label="Ano 2"><MoneyInput value={s.faturacao.ano2} onChange={v => update('faturacao', { ...s.faturacao, ano2: v })} /></Field>
                <Field label="Ano 3"><MoneyInput value={s.faturacao.ano3} onChange={v => update('faturacao', { ...s.faturacao, ano3: v })} /></Field>
              </div>
              <p className="text-[12px] text-[#64748B] mt-4 mb-2 font-[500]">Tipo de clientes:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                <Check label="Particulares" checked={s.faturacao.clientes.particulares} onChange={v => update('faturacao', { ...s.faturacao, clientes: { ...s.faturacao.clientes, particulares: v } })} />
                <Check label="Empresas nacionais" checked={s.faturacao.clientes.nacionais} onChange={v => update('faturacao', { ...s.faturacao, clientes: { ...s.faturacao.clientes, nacionais: v } })} />
                <Check label="Empresas da UE" checked={s.faturacao.clientes.ue} onChange={v => update('faturacao', { ...s.faturacao, clientes: { ...s.faturacao.clientes, ue: v } })} />
                <Check label="Empresas fora da UE" checked={s.faturacao.clientes.foraUe} onChange={v => update('faturacao', { ...s.faturacao, clientes: { ...s.faturacao.clientes, foraUe: v } })} />
              </div>
            </Section>

            {/* 5. Regime de IVA */}
            <Section id="fd-iva" icon={Calculator} title="5. Regime de IVA" color="#1D4ED8" legalAnchor="legal-iva" openLegalAt={openLegalAt}>
              <div className="space-y-4">
                <div>
                  <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Clientes principais:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    <Check label="Particulares" checked={s.iva.clientes.particulares} onChange={v => update('iva', { ...s.iva, clientes: { ...s.iva.clientes, particulares: v } })} />
                    <Check label="Empresas com direito a dedução de IVA" checked={s.iva.clientes.dedutivel} onChange={v => update('iva', { ...s.iva, clientes: { ...s.iva.clientes, dedutivel: v } })} />
                  </div>
                </div>
                <div>
                  <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Atividade permite enquadramento:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    <Check label="Artigo 53.º (isenção PME)" checked={s.iva.enquadramento.art53} onChange={v => update('iva', { ...s.iva, enquadramento: { ...s.iva.enquadramento, art53: v } })} />
                    <Check label="Regime normal de IVA" checked={s.iva.enquadramento.normal} onChange={v => update('iva', { ...s.iva, enquadramento: { ...s.iva.enquadramento, normal: v } })} />
                  </div>
                </div>
                <div>
                  <p className="text-[12px] text-[#64748B] mb-2 font-[500]">IVA suportado relevante?</p>
                  <YesNo value={s.iva.ivaSuportadoRelevante} onChange={v => update('iva', { ...s.iva, ivaSuportadoRelevante: v })} />
                </div>
                <div>
                  <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Principais despesas com IVA:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    <Check label="Mercadorias" checked={s.iva.despesas.mercadorias} onChange={v => update('iva', { ...s.iva, despesas: { ...s.iva.despesas, mercadorias: v } })} />
                    <Check label="Equipamentos" checked={s.iva.despesas.equipamentos} onChange={v => update('iva', { ...s.iva, despesas: { ...s.iva.despesas, equipamentos: v } })} />
                    <Check label="Veículos" checked={s.iva.despesas.viaturas} onChange={v => update('iva', { ...s.iva, despesas: { ...s.iva.despesas, viaturas: v } })} />
                    <Check label="Serviços externos" checked={s.iva.despesas.servicosExternos} onChange={v => update('iva', { ...s.iva, despesas: { ...s.iva.despesas, servicosExternos: v } })} />
                    <Check label="Obras / instalações" checked={s.iva.despesas.obras} onChange={v => update('iva', { ...s.iva, despesas: { ...s.iva.despesas, obras: v } })} />
                  </div>
                </div>
              </div>
            </Section>

            {/* 6. Estrutura de Custos */}
            <Section id="fd-custos" icon={Wallet} title="6. Estrutura de Custos">
              <p className="text-[12px] text-[#64748B] mb-3 font-[500]">Custos anuais estimados:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Mercadorias / Matérias primas"><MoneyInput value={s.custos.mercadorias} onChange={v => update('custos', { ...s.custos, mercadorias: v })} /></Field>
                <Field label="Rendas"><MoneyInput value={s.custos.rendas} onChange={v => update('custos', { ...s.custos, rendas: v })} /></Field>
                <Field label="Combustíveis / deslocações"><MoneyInput value={s.custos.combustiveis} onChange={v => update('custos', { ...s.custos, combustiveis: v })} /></Field>
                <Field label="Veículos"><MoneyInput value={s.custos.viaturas} onChange={v => update('custos', { ...s.custos, viaturas: v })} /></Field>
                <Field label="Equipamentos / imobilizado"><MoneyInput value={s.custos.equipamentos} onChange={v => update('custos', { ...s.custos, equipamentos: v })} /></Field>
                <Field label="Serviços externos"><MoneyInput value={s.custos.servicosExternos} onChange={v => update('custos', { ...s.custos, servicosExternos: v })} /></Field>
                <Field label="Outros custos"><MoneyInput value={s.custos.outros} onChange={v => update('custos', { ...s.custos, outros: v })} /></Field>
              </div>
            </Section>

            {/* 7. RH */}
            <Section id="fd-rh" icon={Users} title="7. Recursos Humanos" legalAnchor="legal-salario" openLegalAt={openLegalAt}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Número de trabalhadores previstos">
                  <input type="number" min={0} value={s.rh.numero} onChange={e => update('rh', { ...s.rh, numero: parseInt(e.target.value) || 0 })} className={inputClass} />
                </Field>
                <Field label="Remuneração anual estimada"><MoneyInput value={s.rh.remuneracaoAnual} onChange={v => update('rh', { ...s.rh, remuneracaoAnual: v })} /></Field>
              </div>
              <p className="text-[12px] text-[#64748B] mt-4 mb-2 font-[500]">Tipo:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                <Check label="Trabalhadores dependentes" checked={s.rh.tipo.dependentes} onChange={v => update('rh', { ...s.rh, tipo: { ...s.rh.tipo, dependentes: v } })} />
                <Check label="Prestadores de serviços" checked={s.rh.tipo.prestadores} onChange={v => update('rh', { ...s.rh, tipo: { ...s.rh.tipo, prestadores: v } })} />
              </div>
            </Section>

            {/* 8. SS */}
            <Section id="fd-ss" icon={Shield} title="8. Segurança Social" color="#059669" legalAnchor="legal-ss" openLegalAt={openLegalAt}>
              <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Situação atual do sócio / empresário:</p>
              <div className="space-y-1 mb-4">
                {([
                  ['tco', 'Trabalhador dependente'],
                  ['desempregado', 'Desempregado'],
                  ['estudante', 'Estudante'],
                  ['empresario', 'Empresário'],
                  ['gerente', 'Gerente de sociedade'],
                ] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded-[6px] hover:bg-slate-50">
                    <input
                      type="radio" name="fd-ss-sit" checked={s.ss.situacaoSocio === val}
                      onChange={() => update('ss', { ...s.ss, situacaoSocio: val })}
                      className="w-4 h-4 accent-[#059669] cursor-pointer"
                    />
                    <span className="text-[13px] font-[600] text-[#334155]">{label}</span>
                  </label>
                ))}
              </div>
              <Field label="Remuneração actual anual"><MoneyInput value={s.ss.remuneracaoActual} onChange={v => update('ss', { ...s.ss, remuneracaoActual: v })} /></Field>
            </Section>

            {/* 9. Investimento Inicial */}
            <Section id="fd-investimento" icon={Banknote} title="9. Investimento Inicial">
              <p className="text-[12px] text-[#64748B] mb-3 font-[500]">Investimento previsto:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Equipamentos"><MoneyInput value={s.investimento.equipamentos} onChange={v => update('investimento', { ...s.investimento, equipamentos: v })} /></Field>
                <Field label="Veículos"><MoneyInput value={s.investimento.viaturas} onChange={v => update('investimento', { ...s.investimento, viaturas: v })} /></Field>
                <Field label="Obras / instalações"><MoneyInput value={s.investimento.obras} onChange={v => update('investimento', { ...s.investimento, obras: v })} /></Field>
                <Field label="Stock inicial"><MoneyInput value={s.investimento.stock} onChange={v => update('investimento', { ...s.investimento, stock: v })} /></Field>
                <Field label="Outro"><MoneyInput value={s.investimento.outro} onChange={v => update('investimento', { ...s.investimento, outro: v })} /></Field>
              </div>
            </Section>

            {/* 10. Viaturas */}
            <Section id="fd-viaturas" icon={Car} title="10. Viaturas" legalAnchor="legal-irc" openLegalAt={openLegalAt}>
              <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Existem veículos afetos à atividade?</p>
              <YesNo value={s.viaturas.tem} onChange={v => update('viaturas', { ...s.viaturas, tem: v })} />
              {s.viaturas.tem === 'sim' && (
                <>
                  <p className="text-[12px] text-[#64748B] mt-4 mb-2 font-[500]">Tipo:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    <Check label="Comercial" checked={s.viaturas.tipo.comercial} onChange={v => update('viaturas', { ...s.viaturas, tipo: { ...s.viaturas.tipo, comercial: v } })} />
                    <Check label="Passageiros" checked={s.viaturas.tipo.passageiros} onChange={v => update('viaturas', { ...s.viaturas, tipo: { ...s.viaturas.tipo, passageiros: v } })} />
                    <Check label="Elétrico" checked={s.viaturas.tipo.eletrico} onChange={v => update('viaturas', { ...s.viaturas, tipo: { ...s.viaturas.tipo, eletrico: v } })} />
                    <Check label="Híbrido" checked={s.viaturas.tipo.hibrido} onChange={v => update('viaturas', { ...s.viaturas, tipo: { ...s.viaturas.tipo, hibrido: v } })} />
                  </div>
                  <div className="mt-4">
                    <Field label="Valor estimado"><MoneyInput value={s.viaturas.valor} onChange={v => update('viaturas', { ...s.viaturas, valor: v })} /></Field>
                  </div>
                </>
              )}
            </Section>

            {/* 11. Estrutura Societária */}
            <Section id="fd-societaria" icon={Building} title="11. Estrutura Societária" legalAnchor="legal-csc" openLegalAt={openLegalAt}>
              <p className="text-[12px] text-[#64748B] mb-3 font-[500]">Caso sociedade:</p>
              <Field label="Número de sócios">
                <input
                  type="number" min={1}
                  value={s.societaria.numeroSocios}
                  onChange={e => {
                    const n = Math.max(1, parseInt(e.target.value) || 1);
                    const socios = [...s.societaria.socios];
                    while (socios.length < n) socios.push({ nome: '', percentagem: 0 });
                    while (socios.length > n) socios.pop();
                    update('societaria', { ...s.societaria, numeroSocios: n, socios });
                  }}
                  className={inputClass}
                />
              </Field>
              <p className="text-[12px] text-[#64748B] mt-5 mb-2 font-[500]">Participação:</p>
              <div className="space-y-2">
                {s.societaria.socios.map((socio, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                    <input
                      type="text" placeholder={`Sócio ${i + 1} — nome`}
                      value={socio.nome}
                      onChange={e => {
                        const socios = [...s.societaria.socios];
                        socios[i] = { ...socios[i], nome: e.target.value };
                        update('societaria', { ...s.societaria, socios });
                      }}
                      className={inputClass}
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={100}
                        value={socio.percentagem}
                        onChange={e => {
                          const socios = [...s.societaria.socios];
                          socios[i] = { ...socios[i], percentagem: parseFloat(e.target.value) || 0 };
                          update('societaria', { ...s.societaria, socios });
                        }}
                        className={inputClass}
                      />
                      <span className="text-[13px] text-[#64748B] font-[600]">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const socios = s.societaria.socios.filter((_, idx) => idx !== i);
                        update('societaria', { ...s.societaria, numeroSocios: Math.max(1, socios.length), socios: socios.length ? socios : [{ nome: '', percentagem: 100 }] });
                      }}
                      className="no-print p-2 rounded-[8px] text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Remover sócio"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const socios = [...s.societaria.socios, { nome: '', percentagem: 0 }];
                    update('societaria', { ...s.societaria, numeroSocios: socios.length, socios });
                  }}
                  className="no-print flex items-center gap-1.5 mt-1 text-[12px] font-[700] text-[#781D1D] hover:bg-[#FDF2F2] px-3 py-1.5 rounded-[8px] transition-colors"
                >
                  <Plus size={14} /> Adicionar sócio
                </button>
              </div>
              <p className="text-[12px] text-[#64748B] mt-5 mb-2 font-[500]">Gerência:</p>
              <div className="flex gap-3">
                {([['um', 'Um gerente'], ['varios', 'Vários gerentes']] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio" name="fd-gerencia" checked={s.societaria.gerencia === val}
                      onChange={() => update('societaria', { ...s.societaria, gerencia: val })}
                      className="w-4 h-4 accent-[#781D1D] cursor-pointer"
                    />
                    <span className="text-[13px] font-[600] text-[#334155]">{label}</span>
                  </label>
                ))}
              </div>
            </Section>

            {/* 12. Distribuição */}
            <Section id="fd-distribuicao" icon={PieChart} title="12. Distribuição de Resultados" legalAnchor="legal-distribuicao" openLegalAt={openLegalAt}>
              <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Pretensão do cliente:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                <Check label="Retirar salário mensal" checked={s.distribuicao.salario} onChange={v => update('distribuicao', { ...s.distribuicao, salario: v })} />
                <Check label="Receber dividendos" checked={s.distribuicao.dividendos} onChange={v => update('distribuicao', { ...s.distribuicao, dividendos: v })} />
                <Check label="Reinvestir lucros" checked={s.distribuicao.reinvestir} onChange={v => update('distribuicao', { ...s.distribuicao, reinvestir: v })} />
                <Check label="Misto" checked={s.distribuicao.misto} onChange={v => update('distribuicao', { ...s.distribuicao, misto: v })} />
              </div>
            </Section>

            {/* 13. Situação Fiscal Atual */}
            <Section id="fd-fiscal" icon={AlertTriangle} title="13. Situação Fiscal Atual" color="#D97706" legalAnchor="legal-dividas" openLegalAt={openLegalAt}>
              <div className="space-y-4">
                <div>
                  <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Tem dívidas fiscais?</p>
                  <YesNo value={s.fiscalAtual.dividasFiscais} onChange={v => update('fiscalAtual', { ...s.fiscalAtual, dividasFiscais: v })} />
                </div>
                <div>
                  <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Tem dívidas à Segurança Social?</p>
                  <YesNo value={s.fiscalAtual.dividasSS} onChange={v => update('fiscalAtual', { ...s.fiscalAtual, dividasSS: v })} />
                </div>
                <div>
                  <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Tem processos de execução fiscal?</p>
                  <YesNo value={s.fiscalAtual.execucoesFiscais} onChange={v => update('fiscalAtual', { ...s.fiscalAtual, execucoesFiscais: v })} />
                </div>
              </div>
            </Section>

            {/* 14. Objetivos */}
            <Section id="fd-objetivos" icon={Target} title="14. Objetivos do Cliente">
              <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Qual o principal objetivo? (pode escolher mais que um)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                <Check label="Pagar menos impostos" checked={s.objetivos.menosImpostos} onChange={v => update('objetivos', { ...s.objetivos, menosImpostos: v })} />
                <Check label="Crescer empresa" checked={s.objetivos.crescer} onChange={v => update('objetivos', { ...s.objetivos, crescer: v })} />
                <Check label="Investimento imobiliário" checked={s.objetivos.imobiliario} onChange={v => update('objetivos', { ...s.objetivos, imobiliario: v })} />
                <Check label="Criar várias empresas" checked={s.objetivos.variasEmpresas} onChange={v => update('objetivos', { ...s.objetivos, variasEmpresas: v })} />
                <Check label="Planeamento fiscal familiar" checked={s.objetivos.planeamentoFamiliar} onChange={v => update('objetivos', { ...s.objetivos, planeamentoFamiliar: v })} />
              </div>
            </Section>

            {/* 15. Intenções */}
            <Section id="fd-intencoes" icon={Lightbulb} title="15. Questões Específicas">
              <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Existe intenção de:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                <Check label="Comprar imóveis" checked={s.intencoes.imoveis} onChange={v => update('intencoes', { ...s.intencoes, imoveis: v })} />
                <Check label="Comprar viaturas pela empresa" checked={s.intencoes.viaturasEmpresa} onChange={v => update('intencoes', { ...s.intencoes, viaturasEmpresa: v })} />
                <Check label="Investir em ativos financeiros" checked={s.intencoes.ativosFinanceiros} onChange={v => update('intencoes', { ...s.intencoes, ativosFinanceiros: v })} />
                <Check label="Criar grupo de empresas" checked={s.intencoes.grupoEmpresas} onChange={v => update('intencoes', { ...s.intencoes, grupoEmpresas: v })} />
                <Check label="Internacionalizar atividade" checked={s.intencoes.internacionalizar} onChange={v => update('intencoes', { ...s.intencoes, internacionalizar: v })} />
              </div>
            </Section>

            {/* 16. Documentos */}
            <Section id="fd-documentos" icon={FolderCheck} title="16. Documentos a Recolher" legalAnchor="legal-docs" openLegalAt={openLegalAt}>
              <p className="text-[12px] text-[#64748B] mb-2 font-[500]">Antes da análise final:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                <Check label="Declaração IRS último ano" checked={s.documentos.irs} onChange={v => update('documentos', { ...s.documentos, irs: v })} />
                <Check label="Balancete atual (se empresa)" checked={s.documentos.balancete} onChange={v => update('documentos', { ...s.documentos, balancete: v })} />
                <Check label="IES último ano" checked={s.documentos.ies} onChange={v => update('documentos', { ...s.documentos, ies: v })} />
                <Check label="Modelo 22" checked={s.documentos.modelo22} onChange={v => update('documentos', { ...s.documentos, modelo22: v })} />
                <Check label="Declaração IVA" checked={s.documentos.dec_iva} onChange={v => update('documentos', { ...s.documentos, dec_iva: v })} />
                <Check label="Contratos relevantes" checked={s.documentos.contratos} onChange={v => update('documentos', { ...s.documentos, contratos: v })} />
                <Check label="Extratos bancários" checked={s.documentos.extratos} onChange={v => update('documentos', { ...s.documentos, extratos: v })} />
              </div>
            </Section>

            {/* Análise Interna */}
            <Section id="fd-analise" icon={Search} title="Resultado da Análise (uso interno)" color="#0F172A">
              <p className="text-[12px] text-[#64748B] mb-4 font-[500]">Após recolha de dados, analisar:</p>
              <div className="space-y-4">
                <Field label="ENI vs Lda">
                  <textarea rows={2} value={s.analiseInterna.eniVsLda} onChange={e => update('analiseInterna', { ...s.analiseInterna, eniVsLda: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Regime simplificado vs contabilidade organizada">
                  <textarea rows={2} value={s.analiseInterna.simplifVsOrganizada} onChange={e => update('analiseInterna', { ...s.analiseInterna, simplifVsOrganizada: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Artigo 53.º vs regime normal IVA">
                  <textarea rows={2} value={s.analiseInterna.art53VsNormal} onChange={e => update('analiseInterna', { ...s.analiseInterna, art53VsNormal: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Otimização salário vs dividendos">
                  <textarea rows={2} value={s.analiseInterna.salarioVsDividendos} onChange={e => update('analiseInterna', { ...s.analiseInterna, salarioVsDividendos: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Planeamento fiscal">
                  <textarea rows={2} value={s.analiseInterna.planeamento} onChange={e => update('analiseInterna', { ...s.analiseInterna, planeamento: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Observações">
                  <textarea rows={3} value={s.analiseInterna.observacoes} onChange={e => update('analiseInterna', { ...s.analiseInterna, observacoes: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Recomendações">
                  <textarea rows={3} value={s.analiseInterna.recomendacoes} onChange={e => update('analiseInterna', { ...s.analiseInterna, recomendacoes: e.target.value })} className={inputClass} />
                </Field>
              </div>
            </Section>

            <p className="text-center text-[11px] text-[#94A3B8] py-6 font-[500]">
              Recofatima Contabilidade • Ficha de Diagnóstico • PT 2026 • Para detalhes legais consulte a página{' '}
              <button onClick={() => openLegalAt('legal-honorarios')} className="no-print text-[#781D1D] font-[700] hover:underline">Base Legal</button>.
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
