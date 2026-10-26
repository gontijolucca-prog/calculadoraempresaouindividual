/**
 * Orbe de estado — a "bolinha" que respira.
 *
 * Mesma linguagem da bola azul do logótipo (radial gradient com centro claro),
 * com um pulso suave de escala e halo. Sem deslocar layout: `transform` só.
 * Com `prefers-reduced-motion` fica estática.
 */
import { cn } from '../lib/utils';

export default function StatusOrb({
  size = 10,
  cor = '#E11D48',
  corClara = '#FDA4AF',
  pulse = true,
  className,
  title,
}: {
  size?: number;
  cor?: string;
  corClara?: string;
  pulse?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn('orb-status shrink-0', pulse && 'orb-status--pulse', className)}
      title={title}
      aria-hidden={title ? undefined : true}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${corClara} 0%, ${cor} 55%, #7F0D25 100%)`,
        boxShadow: `0 0 0 3px ${cor}22, 0 1px 2px ${cor}55`,
      }}
    />
  );
}
