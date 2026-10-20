import { cn } from '../lib/utils';

/**
 * Checkbox "N/A" para campos que não se aplicam ao caso do utilizador.
 * Quando ligado, o campo fica desativado e o valor é zerado (os cálculos
 * ignoram-no, como já acontece com qualquer custo a 0).
 */
export function NaoAplicavel({
  ativo, onChange, className,
}: {
  ativo: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={cn('ml-2 inline-flex cursor-pointer items-center gap-1 align-middle text-[10px] font-[800] uppercase tracking-[0.5px] text-[#94A3B8]', className)}
      title="Não se aplica — desativa este campo"
    >
      <input
        type="checkbox"
        checked={ativo}
        onChange={e => onChange(e.target.checked)}
        className="h-3 w-3 accent-slate-500"
      />
      N/A
    </label>
  );
}

/** Devolve o patch de estado para marcar/desmarcar N/A (zera o valor ao marcar). */
export function patchNaoAplicavel<T extends { na?: string[] }>(
  estado: T, campo: string, naoAplicavel: boolean,
): Partial<T> {
  const atuais = estado.na ?? [];
  const na = naoAplicavel
    ? Array.from(new Set([...atuais, campo]))
    : atuais.filter(x => x !== campo);
  const patch: Record<string, unknown> = { na };
  if (naoAplicavel) patch[campo] = 0;
  return patch as Partial<T>;
}

export default NaoAplicavel;
