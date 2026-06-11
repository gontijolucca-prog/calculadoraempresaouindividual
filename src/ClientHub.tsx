import { motion } from 'motion/react';
import { UserCircle, ArrowRight } from 'lucide-react';
import { SIM_INTROS } from './SimIntro';

/**
 * Galeria do cliente ativo: abre no ecrã principal sempre que se clica em
 * "A trabalhar em" na sidebar (abrir OU recolher o dropdown). Cards
 * explicativos de cada menu (Perfil + simuladores) — segundo caminho de
 * entrada, em paralelo com o dropdown. Escolher um card mostra o MESMO
 * ecrã-intro do simulador que a sidebar mostra ("Simular" entra).
 */

// Mesma ordem dos simuladores na sidebar (NAV_ITEMS group 'sim').
const SIM_ORDER = ['tax', 'vehicle', 'ticket', 'selfss', 'diagnostico', 'imoveis', 'imt', 'salario', 'irs', 'previsa'];

export default function ClientHub({ clientName, onNavigate }: {
  clientName: string;
  onNavigate: (view: string, opts?: { skipIntro?: boolean }) => void;
}) {
  return (
    <div className="h-full overflow-y-auto bg-[#F5F7FA]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <p className="text-[10px] font-[800] uppercase tracking-[2px] text-[#0677FF]">A trabalhar em</p>
          <h1 className="mt-1 text-[26px] font-[800] text-[#0B1D2D] tracking-[-0.5px] leading-tight">{clientName}</h1>
          <p className="mt-1.5 text-[13.5px] text-slate-500 font-[500]">Escolhe por onde começar — tudo o que fizeres fica guardado neste cliente.</p>
        </motion.div>

        {/* Row 1 — o cliente */}
        <motion.button
          type="button"
          onClick={() => onNavigate('profile')}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
          className="group mt-7 w-full text-left flex items-center gap-4 bg-white rounded-[18px] border border-[#E2E8F0] hover:border-[#0677FF]/50 shadow-sm hover:shadow-md p-5 transition-all"
        >
          <div className="w-12 h-12 rounded-[14px] bg-[#0677FF]/10 flex items-center justify-center shrink-0">
            <UserCircle className="w-6 h-6 text-[#0677FF]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-[800] text-[#0B1D2D] leading-tight">Perfil do Cliente</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500 font-[500] leading-relaxed">
              Identificação, dados empresariais, fiscais &amp; família, custos e objetivos — alimenta todos os simuladores.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-[#0677FF] group-hover:translate-x-0.5 transition-all shrink-0" />
        </motion.button>

        {/* Rows 2–3 — simuladores */}
        <p className="mt-8 mb-3 text-[11px] font-[800] uppercase tracking-[1.5px] text-slate-400">Simuladores</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {SIM_ORDER.map((id, i) => {
            const def = SIM_INTROS[id];
            if (!def) return null;
            const { titulo, Icon, resumo } = def;
            return (
              <motion.button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.08 + i * 0.03 }}
                className="group text-left flex flex-col bg-white rounded-[16px] border border-[#E2E8F0] hover:border-[#0677FF]/50 shadow-sm hover:shadow-md transition-all"
                style={{ padding: 18 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-[#0677FF]/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#0677FF]" />
                  </div>
                  <h3 className="text-[14px] font-[800] text-[#0B1D2D] leading-tight flex-1 min-w-0">{titulo}</h3>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#0677FF] group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
                <p className="mt-2.5 text-[12px] text-slate-500 font-[500] leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {resumo}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
