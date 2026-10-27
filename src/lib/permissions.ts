/**
 * Matriz de permissões por cargo — espelho em código das firestore.rules.
 * Fonte do cargo: `gabinetes/{id}.members[uid].role` (fallback: membro legado
 * sem role conta como contabilista; dono é sempre admin).
 */
import type { GabineteRole, GabineteRoleBase } from './gabinetes';

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

export const PERMISSION_LABELS: Record<PermissionAction, string> = {
  'editar-operacional': 'Trabalho do dia a dia (tarefas, contactos, documentos)',
  'editar-clientes': 'Criar e editar clientes',
  'gerir-obrigacoes': 'Gerir obrigações e mapas',
  'ver-cofre': 'Ver o cofre de acessos',
  'editar-cofre': 'Editar o cofre',
  'apagar': 'Apagar registos',
  'restaurar': 'Restaurar da Lixeira',
  'purgar': 'Apagar definitivamente (Lixeira)',
  'gerir-equipa': 'Gerir a equipa e os cargos',
  'gerir-gabinete': 'Gerir o gabinete',
};

const MATRIX: Record<GabineteRoleBase, PermissionAction[]> = {
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

// Cargos personalizados: cache local preenchida quando o gabinete é carregado.
let customRoles: Record<string, { nome: string; permissoes: string[] }> = {};

export function setCustomRolesCache(map: Record<string, { nome: string; permissoes: string[] }> | null | undefined): void {
  customRoles = map && typeof map === 'object' ? map : {};
}
export function getCustomRolesCache(): Record<string, { nome: string; permissoes: string[] }> {
  return customRoles;
}
export function isCargoCustom(role: string | null | undefined): boolean {
  return !!role && role.startsWith('custom:');
}

export function can(role: GabineteRole | null | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  if (isCargoCustom(role)) {
    const direto = customRoles[role]?.permissoes;
    const legado = customRoles[role.slice('custom:'.length)]?.permissoes;
    return (direto || legado || []).includes(action);
  }
  return MATRIX[role as GabineteRoleBase]?.includes(action) ?? false;
}

export interface RoleSource {
  ownerUid?: string;
  memberUids?: string[];
  members?: Record<string, { role?: GabineteRole } | undefined>;
  customRoles?: Record<string, unknown>;
}

export function deriveRole(meta: RoleSource | null | undefined, uid: string | null | undefined): GabineteRole | null {
  if (!meta || !uid) return null;
  if (meta.ownerUid && meta.ownerUid === uid) return 'admin';
  const direct = meta.members?.[uid]?.role;
  if (direct === 'admin' || direct === 'contabilista' || direct === 'estagiaria') return direct;
  if (direct && direct.startsWith('custom:') && (meta as RoleSource & { customRoles?: Record<string, unknown> }).customRoles?.[direct]) return direct;
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
