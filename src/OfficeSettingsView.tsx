import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Building2, Image as ImageIcon, Upload, Trash2, Save, Calculator, Plus, X, Info } from 'lucide-react';
import type { OfficeSettings, EntidadeOutorgante } from './lib/officeSettings';
import { officeSettingsAreComplete } from './lib/officeSettings';
import type { HonorariosConfig, TipoEntidadeCliente } from './lib/honorarios';

interface Props {
  office: OfficeSettings;
  onOfficeChange: (s: OfficeSettings) => void;
  honorarios: HonorariosConfig;
  onHonorariosChange: (c: HonorariosConfig) => void;
}

type Tab = 'escritorio' | 'honorarios';

const inputCls = "w-full px-3 py-2 bg-[#F5F7FA] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] focus:border-[#0677FF] outline-none transition-all";
const labelCls = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-1.5";
const sectionTitleCls = "text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-3";
const eur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

const TIPO_LABELS: Record<TipoEntidadeCliente, string> = {
  eni: 'ENI / Recibos Verdes',
  unipessoal: 'Unipessoal Lda',
  socio_unico: 'Unipessoal — Sócio Único',
  lda: 'Sociedade por Quotas (Lda)',
  sa: 'Sociedade Anónima (SA)',
};

export default function OfficeSettingsView({ office, onOfficeChange, honorarios, onHonorariosChange }: Props) {
  const [tab, setTab] = useState<Tab>('escritorio');
  const complete = officeSettingsAreComplete(office);

  return (
    <motion.div
      className="h-full overflow-y-auto bg-[#F5F7FA]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
      <div className="max-w-5xl mx-auto p-6 md:p-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] md:text-[36px] font-[800] tracking-[-1px] text-[#0F172A] leading-tight">Definições do Escritório</h1>
            <p className="text-[14px] text-[#64748B] font-[500] mt-1">Configuração de branding e tabela de honorários — aparece em propostas, contratos e PDFs exportados.</p>
          </div>
          {!complete && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-[10px]">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-[12px] text-amber-900 font-[600]">Faltam dados obrigatórios para emitir contratos.</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[#E2E8F0]" role="tablist">
          <TabButton active={tab === 'escritorio'} onClick={() => setTab('escritorio')} icon={Building2}>Dados do Escritório</TabButton>
          <TabButton active={tab === 'honorarios'} onClick={() => setTab('honorarios')} icon={Calculator}>Tabela de Honorários</TabButton>
        </div>

        {tab === 'escritorio' && (
          <EscritorioForm office={office} onChange={onOfficeChange} />
        )}
        {tab === 'honorarios' && (
          <HonorariosForm config={honorarios} onChange={onHonorariosChange} />
        )}
      </div>
    </motion.div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-[700] border-b-2 -mb-px transition-colors ${
        active
          ? 'text-[#0F172A] border-[#0677FF]'
          : 'text-[#64748B] border-transparent hover:text-[#0F172A]'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

// ─── Escritorio Form ────────────────────────────────────────────────────────

function EscritorioForm({ office, onChange }: { office: OfficeSettings; onChange: (s: OfficeSettings) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof OfficeSettings>(k: K, v: OfficeSettings[K]) => onChange({ ...office, [k]: v });

  const [logoBusy, setLogoBusy] = useState(false);

  const onLogoUpload = async (file: File) => {
    setLogoBusy(true);
    try {
      const dataUrl = await downscaleImageToDataURL(file, 1024 * 1024);
      set('logoDataUrl', dataUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível carregar a imagem.');
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Logo + Cor */}
      <section className="bg-white rounded-[16px] border border-[#E2E8F0] p-6">
        <h2 className={sectionTitleCls}>Identidade Visual</h2>
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
          <div>
            <div
              className="w-[200px] h-[160px] border-2 border-dashed border-[#CBD5E1] rounded-[12px] bg-[#F5F7FA] flex items-center justify-center overflow-hidden"
              aria-label="Pré-visualização do logo"
            >
              {office.logoDataUrl ? (
                <img src={office.logoDataUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <ImageIcon className="w-12 h-12 text-[#CBD5E1]" />
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={logoBusy}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#0F172A] text-white text-[12px] font-[700] rounded-[8px] hover:bg-[#1E293B] transition-colors disabled:opacity-60 disabled:cursor-progress"
              >
                <Upload className="w-3.5 h-3.5" />
                {logoBusy ? 'A otimizar…' : office.logoDataUrl ? 'Substituir' : 'Carregar logo'}
              </button>
              {office.logoDataUrl && !logoBusy && (
                <button
                  onClick={() => set('logoDataUrl', '')}
                  className="px-3 py-2 bg-[#FEF2F2] text-[#B91C1C] text-[12px] font-[700] rounded-[8px] hover:bg-[#FEE2E2] transition-colors"
                  aria-label="Remover logo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/gif,image/bmp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onLogoUpload(f); e.target.value = ''; }} />
            <p className="text-[10px] text-[#94A3B8] mt-2 leading-snug">PNG, JPG, SVG ou WebP. Qualquer tamanho — o sistema otimiza automaticamente. Fundo transparente recomendado.</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelCls}>Cor primária do branding</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={office.corPrimaria} onChange={e => set('corPrimaria', e.target.value)} className="w-12 h-10 rounded-[8px] border-2 border-[#E2E8F0] cursor-pointer" />
                <input type="text" value={office.corPrimaria} onChange={e => set('corPrimaria', e.target.value)} className={inputCls + ' max-w-[140px] font-mono'} placeholder="#0677FF" />
                <div className="flex-1 h-10 rounded-[8px]" style={{ backgroundColor: office.corPrimaria }} aria-hidden="true" />
              </div>
              <p className="text-[11px] text-[#64748B] mt-1">Usada em cabeçalhos de proposta, contratos e PDFs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Identificação Legal */}
      <section className="bg-white rounded-[16px] border border-[#E2E8F0] p-6">
        <h2 className={sectionTitleCls}>Identificação Legal</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-2">
            <label className={labelCls}>Tipo de Outorgante</label>
            <div className="grid grid-cols-2 gap-2">
              <RadioCard
                checked={office.tipo === 'individual'}
                onClick={() => set('tipo', 'individual')}
                title="Contabilista Certificado"
                subtitle="A título individual"
              />
              <RadioCard
                checked={office.tipo === 'sociedade'}
                onClick={() => set('tipo', 'sociedade')}
                title="Sociedade de Contabilidade"
                subtitle="Sociedade de Profissionais"
              />
            </div>
          </div>

          <div className="col-span-2">
            <label className={labelCls}>{office.tipo === 'individual' ? 'Nome do Contabilista' : 'Firma / Denominação Social'}</label>
            <input type="text" value={office.nome} onChange={e => set('nome', e.target.value)} className={inputCls} placeholder={office.tipo === 'individual' ? 'João Pereira da Silva' : 'Pereira & Associados, Lda'} />
          </div>

          <div>
            <label className={labelCls}>{office.tipo === 'individual' ? 'NIF' : 'NIPC'}</label>
            <input type="text" inputMode="numeric" maxLength={9} value={office.nif} onChange={e => set('nif', e.target.value.replace(/\D/g, '').slice(0, 9))} className={inputCls} placeholder="123456789" />
          </div>

          <div>
            <label className={labelCls}>Nº Cédula Profissional (CC)</label>
            <input type="text" value={office.cedulaProfissional} onChange={e => set('cedulaProfissional', e.target.value)} className={inputCls} placeholder="12345" />
          </div>

          {office.tipo === 'sociedade' && (
            <>
              <div>
                <label className={labelCls}>Nº Inscrição na OCC</label>
                <input type="text" value={office.numeroInscricaoOCC} onChange={e => set('numeroInscricaoOCC', e.target.value)} className={inputCls} placeholder="OCC-12345" />
              </div>
              <div>
                <label className={labelCls}>Representante Legal (gerente/admin.)</label>
                <input type="text" value={office.representanteLegal} onChange={e => set('representanteLegal', e.target.value)} className={inputCls} placeholder="Nome completo" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Contabilista Responsável (Diretor Técnico)</label>
                <input type="text" value={office.contabilistaResponsavel} onChange={e => set('contabilistaResponsavel', e.target.value)} className={inputCls} placeholder="Nome do CC responsável" />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Contactos */}
      <section className="bg-white rounded-[16px] border border-[#E2E8F0] p-6">
        <h2 className={sectionTitleCls}>Contactos & Sede</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-2">
            <label className={labelCls}>Morada / Sede Profissional</label>
            <input type="text" value={office.morada} onChange={e => set('morada', e.target.value)} className={inputCls} placeholder="Rua, Avenida..." />
          </div>
          <div>
            <label className={labelCls}>Código Postal</label>
            <input type="text" value={office.codigoPostal} onChange={e => set('codigoPostal', e.target.value)} className={inputCls} placeholder="1000-001" maxLength={8} />
          </div>
          <div>
            <label className={labelCls}>Localidade</label>
            <input type="text" value={office.localidade} onChange={e => set('localidade', e.target.value)} className={inputCls} placeholder="Lisboa" />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input type="tel" value={office.telefone} onChange={e => set('telefone', e.target.value)} className={inputCls} placeholder="+351 21 000 0000" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={office.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="geral@escritorio.pt" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Website (opcional)</label>
            <input type="url" value={office.website} onChange={e => set('website', e.target.value)} className={inputCls} placeholder="https://www.escritorio.pt" />
          </div>
        </div>
      </section>

      {/* Pagamentos & Jurídico */}
      <section className="bg-white rounded-[16px] border border-[#E2E8F0] p-6">
        <h2 className={sectionTitleCls}>Pagamentos & Jurídico</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-2">
            <label className={labelCls}>IBAN para Pagamento de Honorários</label>
            <input type="text" value={office.iban} onChange={e => set('iban', e.target.value.toUpperCase().replace(/\s/g, ''))} className={inputCls + ' font-mono tracking-wider'} placeholder="PT50000000000000000000000" maxLength={25} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Foro da Comarca (Cláusula 9.ª da minuta de contrato)</label>
            <input type="text" value={office.foroComarca} onChange={e => set('foroComarca', e.target.value)} className={inputCls} placeholder="Lisboa" />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 text-[12px] text-[#64748B] font-[600]">
        <Save className="w-3.5 h-3.5" />
        <span>As alterações são guardadas automaticamente.</span>
      </div>
    </div>
  );
}

function RadioCard({ checked, onClick, title, subtitle }: { checked: boolean; onClick: () => void; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className={`text-left p-3 rounded-[10px] border-2 transition-all ${
        checked ? 'border-[#0677FF] bg-[#0677FF]/5' : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-4 h-4 rounded-full border-2 ${checked ? 'border-[#0677FF] bg-[#0677FF]' : 'border-[#CBD5E1]'}`} aria-hidden="true" />
        <span className="text-[13px] font-[700] text-[#0F172A]">{title}</span>
      </div>
      <p className="text-[11px] text-[#64748B] font-[500] mt-1 pl-6">{subtitle}</p>
    </button>
  );
}

// ─── Honorarios Form ────────────────────────────────────────────────────────

function HonorariosForm({ config, onChange }: { config: HonorariosConfig; onChange: (c: HonorariosConfig) => void }) {
  const set = <K extends keyof HonorariosConfig>(k: K, v: HonorariosConfig[K]) => onChange({ ...config, [k]: v });
  const setBase = (tipo: TipoEntidadeCliente, v: number) =>
    onChange({ ...config, baseMensal: { ...config.baseMensal, [tipo]: v } });
  const setEscalao = (i: number, patch: Partial<HonorariosConfig['escaloesFaturacao'][number]>) => {
    const next = [...config.escaloesFaturacao]; next[i] = { ...next[i], ...patch }; set('escaloesFaturacao', next);
  };
  const setServico = (i: number, patch: Partial<HonorariosConfig['servicosExtra'][number]>) => {
    const next = [...config.servicosExtra]; next[i] = { ...next[i], ...patch }; set('servicosExtra', next);
  };
  const addServico = () => set('servicosExtra', [
    ...config.servicosExtra,
    { id: `custom-${Date.now()}`, nome: 'Novo serviço', descricao: '', precoMensal: 0, ativoPorDefeito: false },
  ]);
  const removeServico = (i: number) => set('servicosExtra', config.servicosExtra.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-8">
      {/* Mensalidade por tipo de entidade */}
      <section className="bg-white rounded-[16px] border border-[#E2E8F0] p-6">
        <h2 className={sectionTitleCls}>Mensalidade Base por Tipo de Entidade</h2>
        <p className="text-[12px] text-[#64748B] mb-4">Valor mensal base (€), antes de funcionários extra e majorações de faturação.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(config.baseMensal) as TipoEntidadeCliente[]).map(tipo => (
            <div key={tipo} className="flex items-center gap-3 p-3 bg-[#F5F7FA] rounded-[10px]">
              <span className="text-[13px] font-[700] text-[#0F172A] flex-1">{TIPO_LABELS[tipo]}</span>
              <div className="flex items-center gap-1">
                <input type="number" min={0} step={5} value={config.baseMensal[tipo]} onChange={e => setBase(tipo, Number(e.target.value) || 0)} className={inputCls + ' w-24 text-right'} />
                <span className="text-[12px] font-[700] text-[#64748B]">€/mês</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Funcionários */}
      <section className="bg-white rounded-[16px] border border-[#E2E8F0] p-6">
        <h2 className={sectionTitleCls}>Funcionários</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Funcionários incluídos no valor base</label>
            <input type="number" min={0} value={config.funcionariosIncluidos} onChange={e => set('funcionariosIncluidos', Number(e.target.value) || 0)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Acréscimo €/mês por funcionário adicional</label>
            <input type="number" min={0} step={1} value={config.acrescimoPorFuncionario} onChange={e => set('acrescimoPorFuncionario', Number(e.target.value) || 0)} className={inputCls} />
          </div>
        </div>
      </section>

      {/* Escalões */}
      <section className="bg-white rounded-[16px] border border-[#E2E8F0] p-6">
        <h2 className={sectionTitleCls}>Majoração por Volume de Faturação</h2>
        <div className="space-y-2">
          {config.escaloesFaturacao.map((e, i) => (
            <div key={i} className="grid grid-cols-[1fr_140px_140px] gap-2 items-center">
              <input type="text" value={e.descricao} onChange={ev => setEscalao(i, { descricao: ev.target.value })} className={inputCls} />
              <input type="number" min={0} step={1000} value={e.minFaturacao} onChange={ev => setEscalao(i, { minFaturacao: Number(ev.target.value) || 0 })} className={inputCls + ' text-right'} placeholder="Min (€)" />
              <input type="number" min={0} step={5} value={e.acrescimoMensal} onChange={ev => setEscalao(i, { acrescimoMensal: Number(ev.target.value) || 0 })} className={inputCls + ' text-right'} placeholder="Acrésc. €/mês" />
            </div>
          ))}
        </div>
      </section>

      {/* Serviços Extra */}
      <section className="bg-white rounded-[16px] border border-[#E2E8F0] p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className={sectionTitleCls + ' mb-0'}>Catálogo de Serviços Extra</h2>
          <button onClick={addServico} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0677FF] text-white text-[12px] font-[700] rounded-[8px] hover:bg-[#0556CC] transition-colors">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {config.servicosExtra.map((s, i) => (
            <div key={s.id} className="grid grid-cols-[1fr_2fr_100px_100px_36px] gap-2 items-center p-2 bg-[#F5F7FA] rounded-[10px]">
              <input type="text" value={s.nome} onChange={e => setServico(i, { nome: e.target.value })} className={inputCls} placeholder="Nome" />
              <input type="text" value={s.descricao} onChange={e => setServico(i, { descricao: e.target.value })} className={inputCls} placeholder="Descrição" />
              <input type="number" min={0} step={5} value={s.precoMensal} onChange={e => setServico(i, { precoMensal: Number(e.target.value) || 0 })} className={inputCls + ' text-right'} placeholder="€/mês" />
              <label className="flex items-center justify-center gap-1 text-[11px] font-[700] text-[#475569] cursor-pointer">
                <input type="checkbox" checked={s.ativoPorDefeito} onChange={e => setServico(i, { ativoPorDefeito: e.target.checked })} className="w-4 h-4 accent-[#0677FF]" />
                Default
              </label>
              <button onClick={() => removeServico(i)} className="p-2 text-[#B91C1C] hover:bg-[#FEF2F2] rounded-[6px] transition-colors" aria-label="Remover">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* IVA + mínimo */}
      <section className="bg-white rounded-[16px] border border-[#E2E8F0] p-6">
        <h2 className={sectionTitleCls}>Outras Definições</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Taxa de IVA aplicável</label>
            <div className="flex items-center gap-1">
              <input type="number" min={0} max={100} step={0.5} value={(config.taxaIVA * 100).toFixed(1)} onChange={e => set('taxaIVA', (Number(e.target.value) || 0) / 100)} className={inputCls + ' text-right'} />
              <span className="text-[12px] font-[700] text-[#64748B]">%</span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">23% no continente.</p>
          </div>
          <div>
            <label className={labelCls}>Mínimo mensal absoluto</label>
            <div className="flex items-center gap-1">
              <input type="number" min={0} step={5} value={config.minimoMensal} onChange={e => set('minimoMensal', Number(e.target.value) || 0)} className={inputCls + ' text-right'} />
              <span className="text-[12px] font-[700] text-[#64748B]">€/mês</span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">Propostas nunca caem abaixo deste valor.</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 text-[12px] text-[#64748B] font-[600]">
        <Save className="w-3.5 h-3.5" />
        <span>As alterações são guardadas automaticamente. Exemplo: cliente Lda, 3 funcionários, €120k/ano = <strong className="text-[#0F172A]">{eur(((config.baseMensal.lda || 0) + Math.max(0, 3 - config.funcionariosIncluidos) * config.acrescimoPorFuncionario + (config.escaloesFaturacao.find(e => 120000 >= e.minFaturacao && (config.escaloesFaturacao.find(e2 => e2.minFaturacao > e.minFaturacao && 120000 >= e2.minFaturacao) === undefined))?.acrescimoMensal ?? 0)))} /mês</strong>.</span>
      </div>
    </div>
  );
}

// ─── Auto-redimensionamento de imagens ─────────────────────────────────────
//
// Aceita qualquer tamanho/formato suportado pelo navegador (PNG, JPG, WebP, SVG)
// e devolve um Data URL com o ficheiro decodificado a caber em `maxBytes` bytes
// (binário). SVG passa direto (vetorial, normalmente pequeno). Bitmaps são
// re-encodados em canvas com dimensão progressivamente menor até caber.
//
// Preserva transparência: começa em PNG; se mesmo a 640px ainda não couber,
// converte para JPEG (mais compacto, sem alfa).
function fileToDataURL(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || ''));
    r.onerror = () => rej(new Error('Não foi possível ler o ficheiro.'));
    r.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Ficheiro de imagem inválido.'));
    img.src = dataUrl;
  });
}

// Tamanho do conteúdo binário codificado em base64 dentro de um data URL.
function dataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return dataUrl.length;
  const b64 = dataUrl.slice(commaIdx + 1);
  // base64: cada 4 chars → 3 bytes (descontando padding '=')
  const padding = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  return Math.floor((b64.length * 3) / 4) - padding;
}

async function downscaleImageToDataURL(file: File, maxBytes: number): Promise<string> {
  // SVG é texto vetorial — não compensa rasterizar. Mantém intacto.
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    return fileToDataURL(file);
  }

  // Carrega para um <img> sem alocar memória extra.
  const originalDataUrl = await fileToDataURL(file);
  const img = await loadImage(originalDataUrl);

  // Caminho rápido: se já é pequeno e não precisa de mexer, devolve o original.
  if (file.size <= maxBytes) {
    return originalDataUrl;
  }

  const wantsAlpha = file.type === 'image/png' || /\.png$/i.test(file.name);
  const MAX_WIDTH = 1600;
  let format: 'png' | 'jpeg' = wantsAlpha ? 'png' : 'jpeg';
  let quality = 0.92;
  let maxW = Math.min(MAX_WIDTH, img.naturalWidth);
  let out = '';

  // Até 10 iterações é mais que suficiente para convergir.
  for (let i = 0; i < 10; i++) {
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(64, Math.round(img.naturalWidth * scale));
    const h = Math.max(64, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('O navegador não suporta canvas para redimensionar a imagem.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    out = canvas.toDataURL(`image/${format}`, quality);
    if (dataUrlBytes(out) <= maxBytes) return out;

    // Estratégia de redução: primeiro tenta diminuir resolução,
    // depois qualidade JPEG; finalmente converte PNG → JPEG se ainda for grande.
    if (format === 'png' && maxW <= 640) {
      format = 'jpeg';
      quality = 0.85;
      maxW = Math.min(MAX_WIDTH, img.naturalWidth);
    } else if (format === 'jpeg' && quality > 0.55) {
      quality = Math.max(0.55, quality - 0.1);
    } else {
      maxW = Math.max(256, Math.round(maxW * 0.8));
    }
  }
  // Devolve a última tentativa mesmo que esteja acima — é o melhor possível.
  return out;
}
