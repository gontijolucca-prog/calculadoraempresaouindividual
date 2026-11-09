import React, { useState } from 'react';
import { HelpCircle, CheckCircle2 } from 'lucide-react';

const OPCOES: { valor: 'normal' | 'second_hand' | 'leasing'; titulo: string; desc: string }[] = [
  {
    valor: 'normal',
    titulo: 'Comprei novo, com fatura e IVA',
    desc: 'O Stand ou particular passou fatura com IVA. O IVA pode ser recuperado conforme o tipo de carro e a atividade.',
  },
  {
    valor: 'second_hand',
    titulo: 'Comprei usado, sem IVA',
    desc: 'Compra a particular ou em regime de bens usados: não há IVA na fatura. Paga Imposto do Selo na mesma.',
  },
  {
    valor: 'leasing',
    titulo: 'Vou alugar (leasing ou renting)',
    desc: 'Paga uma mensalidade. O IVA é o das rendas, não o da compra do carro.',
  },
];

/** Sub-simulador simples: ajuda a escolher o "Regime Fiscal da Aquisição". */
export default function SeletorRegimeAquisicao({ value, onChange }: { value: string; onChange: (v: 'normal' | 'second_hand' | 'leasing') => void }) {
  const [aberto, setAberto] = useState(false);
  const atual = OPCOES.find(o => o.valor === value) || OPCOES[0];

  return (
    <div className="rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 text-left"
      >
        <HelpCircle className="h-4 w-4 shrink-0 text-[var(--accent)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-[800] text-[#0F172A]">Não sabe qual é o regime? Escolha aqui.</span>
          <span className="block text-[11.5px] text-[#64748B]">Resposta em linguagem simples. Regime atual: <strong>{atual.titulo}</strong>.</span>
        </span>
        <span className="text-[11px] font-[800] text-[var(--accent)]">{aberto ? 'Fechar' : 'Abrir'}</span>
      </button>

      {aberto && (
        <div className="mt-3 grid gap-2">
          {OPCOES.map((o) => {
            const ativo = o.valor === value;
            return (
              <button
                key={o.valor}
                type="button"
                onClick={() => { onChange(o.valor); setAberto(false); }}
                className={`flex items-start gap-2 rounded-[10px] border-2 p-3 text-left transition-colors ${ativo ? 'border-[var(--accent)] bg-white' : 'border-[#E2E8F0] bg-white hover:border-[var(--accent)]/60'}`}
              >
                {ativo ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" /> : <span className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-[#CBD5E1]" />}
                <span>
                  <span className="block text-[13px] font-[800] text-[#0F172A]">{o.titulo}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-[#64748B]">{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
