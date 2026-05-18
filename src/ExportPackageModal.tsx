import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calculator, FileText, FileSignature, Printer, X, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';
import type { ClientProfile } from './ClientProfile';
import type { OfficeSettings } from './lib/officeSettings';
import type { HonorariosConfig } from './lib/honorarios';
import { officeSettingsAreComplete } from './lib/officeSettings';
import PDFPreviewEditor from './PDFPreviewEditor';
import Proposta from './Proposta';
import MinutaContrato from './MinutaContrato';

// Local mirrors — alinhados ao que o PDFPreviewEditor (consumidor real) espera.
interface TaxSimulatorState {
  profSit: string; currentInc: number; age: number; isMainAct: boolean;
  monthlyNeed: number; isServices: boolean; b2b: boolean; rev: number;
  isSeasonal: boolean; invEquip: number; invLic: number; invWorks: number;
  invFundo: number; fixedMo: number; varYr: number; accMoLda: number;
  accMoEni: number; anosAtividade: number;
}
interface VehicleSimulatorState {
  category: 'comercial' | 'passageiros'; engineType: string; price: number;
  ivaRegime: string; activity: string; maintenanceCost: number;
  insuranceCost: number; fuelCost: number; exemptTA: boolean; phevCompliant: boolean;
}
interface TicketSimulatorState {
  employees: number; ticketValue: number; daysPerMonth: number; months: number;
}
interface SSState {
  income: number; regime: 'general' | 'simplified';
  tipoRendimento: 'servicos' | 'bens'; primeiroAno: boolean;
}

type DocId = 'simulacao' | 'proposta' | 'minuta';

interface Props {
  profile: ClientProfile;
  office: OfficeSettings;
  honorarios: HonorariosConfig;
  taxState?: TaxSimulatorState;
  vehicleState?: VehicleSimulatorState;
  ticketState?: TicketSimulatorState;
  ssState?: SSState;
  onClose: () => void;
  onGoToOfficeSettings: () => void;
}

const TABS: { id: DocId; label: string; short: string; sub: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'simulacao', label: 'Simulação Fiscal',  short: 'Simulação', sub: 'ENI vs Lda + cenários',   Icon: Calculator },
  { id: 'proposta',  label: 'Proposta',           short: 'Proposta',  sub: 'Carta de honorários',     Icon: FileText },
  { id: 'minuta',    label: 'Minuta de Contrato', short: 'Minuta',    sub: 'Modelo OCC preenchido',   Icon: FileSignature },
];

/**
 * Modal multi-tab para gerar o "pacote do cliente": Simulação Fiscal,
 * Proposta de Honorários e Minuta de Contrato. Cada documento pode ser
 * pré-visualizado (com edição inline) e impresso individualmente. A
 * Minuta pode ser saltada (skip) — útil quando o cliente ainda não decidiu.
 */
export default function ExportPackageModal({
  profile, office, honorarios, taxState, vehicleState, ticketState, ssState,
  onClose, onGoToOfficeSettings,
}: Props) {
  const [active, setActive] = useState<DocId>('simulacao');
  const [includeMinuta, setIncludeMinuta] = useState(true);
  const officeOk = officeSettingsAreComplete(office);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Print just the active tab.
  const printActive = () => {
    // Each tab component sets up its own @media print isolation via its
    // printRootId — calling window.print() will only render the visible doc.
    window.print();
  };

  // Hidden tabs still need to be rendered (so contenteditable state survives
  // tab switching), but only the active one is shown.
  const tabStyle = (id: DocId): React.CSSProperties => ({
    display: active === id ? 'block' : 'none',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-[1100] flex items-stretch"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm cursor-default no-print"
      />

      {/* Sheet */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="relative ml-auto w-full max-w-[1080px] h-full bg-[#F8FAFC] shadow-2xl flex flex-col"
      >
        {/* Header */}
        <header className="shrink-0 px-6 py-4 bg-white border-b border-slate-200 flex items-center gap-4 no-print">
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-[#7B98B8] to-[#525C66] flex items-center justify-center text-white shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="export-modal-title" className="text-[18px] font-[800] text-[#0F172A] leading-tight tracking-[-0.3px]">
              Exportar Pacote do Cliente
            </h2>
            <p className="text-[12px] font-[600] text-[#64748B] mt-0.5 truncate">
              {profile.nomeCliente || '— sem nome —'} · NIF {profile.nif || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Office settings warning */}
        {!officeOk && (
          <div className="shrink-0 mx-4 md:mx-6 mt-3 md:mt-4 p-3 md:p-4 bg-amber-50 border border-amber-200 rounded-[12px] flex flex-wrap md:flex-nowrap items-start gap-3 no-print">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-[800] text-amber-900">Definições do escritório incompletas</h3>
              <p className="text-[12px] text-amber-800 font-[500] mt-0.5">
                Preencha o nome, NIF, cédula profissional e morada para os documentos saírem com o seu cabeçalho.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToOfficeSettings}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-[700] transition-colors"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              Configurar
            </button>
          </div>
        )}

        {/* Tab strip */}
        <div className="shrink-0 px-4 md:px-6 pt-3 md:pt-4 pb-0 bg-white border-b border-slate-200 no-print">
          <div className="flex flex-wrap items-stretch gap-1">
            {TABS.map(({ id, label, short, sub, Icon }) => {
              const isActive = active === id;
              const isMinutaSkipped = id === 'minuta' && !includeMinuta;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActive(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'flex items-center gap-2 md:gap-2.5 px-2.5 md:px-4 py-2.5 md:py-3 rounded-t-[10px] border-b-[3px] transition-all text-left',
                    isActive
                      ? 'bg-[#F8FAFC] border-[#7B98B8] text-[#0F172A]'
                      : 'bg-white border-transparent text-slate-500 hover:text-[#0F172A] hover:bg-slate-50',
                    isMinutaSkipped ? 'opacity-50' : '',
                  ].join(' ')}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-[800] leading-tight">
                      <span className="hidden md:inline">{label}</span>
                      <span className="md:hidden">{short}</span>
                    </div>
                    <div className="hidden md:block text-[10px] font-[600] text-slate-400 leading-tight mt-0.5">
                      {isMinutaSkipped ? 'Saltado' : sub}
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="w-full md:w-auto md:ml-auto flex items-center justify-end gap-2 md:gap-3 pb-2 md:pb-2 mt-2 md:mt-0">
              {active === 'minuta' && (
                <label className="flex items-center gap-2 px-2.5 md:px-3 py-1.5 rounded-[8px] bg-slate-50 border border-slate-200 cursor-pointer text-[11px] font-[700] text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={includeMinuta}
                    onChange={e => setIncludeMinuta(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#7B98B8]"
                  />
                  Incluir
                </label>
              )}
              <button
                type="button"
                onClick={printActive}
                className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-[10px] bg-[#7B98B8] text-white text-[12px] font-[800] hover:bg-[#5C7A9E] active:scale-[0.98] transition-all shadow-md shadow-[#7B98B8]/30"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Imprimir / PDF</span>
                <span className="sm:hidden">PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab content area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#E2E8F0]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {/* Simulação Fiscal — re-usa o PDFPreviewEditor existente */}
              <div style={tabStyle('simulacao')}>
                {active === 'simulacao' && (
                  <PDFPreviewEditor
                    profile={profile}
                    taxState={taxState}
                    vehicleState={vehicleState}
                    ticketState={ticketState}
                    ssState={ssState}
                    onClose={() => { /* keep modal open — close via parent */ }}
                    embedded
                    office={office}
                  />
                )}
              </div>

              {/* Proposta */}
              <div style={tabStyle('proposta')}>
                {active === 'proposta' && (
                  <Proposta
                    profile={profile}
                    office={office}
                    honorarios={honorarios}
                  />
                )}
              </div>

              {/* Minuta */}
              <div style={tabStyle('minuta')}>
                {active === 'minuta' && includeMinuta && (
                  <MinutaContrato
                    profile={profile}
                    office={office}
                    honorarios={honorarios}
                  />
                )}
                {active === 'minuta' && !includeMinuta && (
                  <div className="max-w-xl mx-auto bg-white rounded-[16px] p-10 text-center shadow-sm">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                      <FileSignature className="w-7 h-7 text-slate-400" />
                    </div>
                    <h3 className="text-[16px] font-[800] text-[#0F172A]">Minuta saltada</h3>
                    <p className="text-[13px] text-[#64748B] mt-2 font-[500]">
                      Esta proposta vai sair apenas com a simulação e a carta de honorários. Ative novamente em cima caso queira incluir o contrato.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIncludeMinuta(true)}
                      className="mt-5 px-4 py-2 rounded-[10px] bg-[#7B98B8] text-white text-[12px] font-[800] hover:bg-[#5C7A9E] transition-colors"
                    >
                      Voltar a incluir
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
