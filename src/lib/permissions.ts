/**
 * Matriz de permissões por cargo — espelho em código das firestore.rules.
 * Fonte do cargo: `gabinetes/{id}.members[uid].role` (fallback: membro legado
 * sem role conta como contabilista; dono é sempre admin).
 */
import type { GabineteRole } from './gabinetes';

export type PermissionAction =
  | 'editar-operacional' // tarefas, ocorrências, documentos, contactos, alertas
  | 'editar-clientes'
  | 'gerir-obrigacoes'
  | 'ver-cofre'
  | 'editar-cofre'
  | 'apagar'
  | 'restaurar'
  | 'purgar'
  | 'gerir-equipa'
  | 'gerir-gabinete';

const MATRIX: Record<GabineteRole, PermissionAction[]> = {
  admin: [
    'editar-operacional', 'editar-clientes', 'gerir-obrigacoes',
    'ver-cofre', 'editar-cofre', 'apagar', 'restaurar', 'purgar',
    'gerir-equipa', 'gerir-gabinete',
  ],
  contabilista: [
    'editar-operacional', 'editar-clientes', 'gerir-obrigacoes',
    'ver-cofre', 'editar-cofre', 'apagar', 'restaurar',
  ],
  estagiaria: ['editar-operacional'],
};

export function can(role: GabineteRole | null | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(action) ?? false;
}

export interface RoleSource {
  ownerUid?: string;
  memberUids?: string[];
  members?: Record<string, { role?: GabineteRole } | undefined>;
}

export function deriveRole(meta: RoleSource | null | undefined, uid: string | null | undefined): GabineteRole | null {
  if (!meta || !uid) return null;
  if (meta.ownerUid && meta.ownerUid === uid) return 'admin';
  const direct = meta.members?.[uid]?.role;
  if (direct === 'admin' || direct === 'contabilista' || direct === 'estagiaria') return direct;
  if (meta.memberUids?.includes(uid)) return 'contabilista';
  return null;
}

/**
 * Tabs do Gabinete visíveis para um cargo. `null` = ainda não se sabe o cargo,
 * por isso mostram-se todas (nunca esconder por dúvida).
 * Ordem igual à da navegação em Layouts.
 */
export function tabsGabinete(role: GabineteRole | null | undefined): string[] | null {
  if (!role) return null;
  const tabs = ['visao-geral', 'dashboard', 'mapa-controlo', 'mapa-rh', 'tarefas', 'agenda', 'obrigacoes'];
  if (can(role, 'ver-cofre')) tabs.push('cofre');
  if (can(role, 'gerir-equipa')) tabs.push('equipa');
  if (can(role, 'restaurar')) tabs.push('lixeira');
  return tabs;
}
