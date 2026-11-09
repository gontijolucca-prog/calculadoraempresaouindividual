/**
 * Cópia de segurança do gabinete.
 *
 * Exporta tudo o que é operacional — carteira de clientes, ficheiros do
 * gabinete e definições do escritório — num único ficheiro JSON versionado.
 * O restauro valida o formato antes de escrever: um ficheiro estragado não
 * pode apagar dados nem criar registos sem `id`.
 *
 * O que NÃO é exportado de propósito: senhas do cofre (ficam cifradas e só
 * abrem com a passphrase do utilizador — o `cipher` vai no ficheiro, o que
 * permite restaurar, mas continua ilegível sem a passphrase) e a equipa
 * (uid/credenciais pertencem às contas, não ao gabinete).
 */
import { fetchAll, guardarRegistoGabinete } from './gabinete';
import { listEmpresas, loadEmpresasFromFirestore, type EmpresaRecord } from './empresas';
import { getActiveGabineteId, getGabineteMeta } from './gabinetes';
import { loadOfficeSettings, type OfficeSettings } from './officeSettings';

export const BACKUP_FORMATO = 'estudo360-backup';
export const BACKUP_VERSAO = 1;

/** Coleções incluídas no ficheiro (ordem = dependências). */
export const BACKUP_COLS = [
  'clientes',
  'obrigacoes',
  'tarefas',
  'contactosGeral',
  'alertasGeral',
  'ocorrencias',
  'documentos',
  'actas',
  'cofre',
  'conversas',
  'modelos',
  'envios',
  'tempos',
] as const;

export type BackupCol = (typeof BACKUP_COLS)[number];

export interface GabineteBackup {
  formato: typeof BACKUP_FORMATO;
  versao: number;
  criadoEm: string;
  app: string;
  gabinete: { id: string; nome: string };
  escritorio: OfficeSettings;
  empresas: EmpresaRecord[];
  colecoes: Partial<Record<BackupCol, unknown[]>>;
  contagens: Record<string, number>;
}

export class BackupError extends Error {}

function contar(colecoes: Partial<Record<BackupCol, unknown[]>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(colecoes)) out[k] = Array.isArray(v) ? v.length : 0;
  return out;
}

/** Lê tudo do servidor (com fallback para o cache local) e devolve o pacote. */
export async function criarBackupGabinete(): Promise<GabineteBackup> {
  const gabineteId = getActiveGabineteId();
  if (!gabineteId) throw new BackupError('Não há um gabinete ativo. Escolha um gabinete primeiro.');

  const meta = await getGabineteMeta(gabineteId).catch(() => null);

  const colecoes: Partial<Record<BackupCol, unknown[]>> = {};
  for (const col of BACKUP_COLS) {
    // fetchAll já tenta o servidor e cai para o cache se a rede falhar.
    colecoes[col] = await fetchAll<Record<string, unknown>>(col).catch(() => []);
  }

  const cloud = await loadEmpresasFromFirestore(undefined).catch(() => null);
  const empresas = cloud?.list ?? listEmpresas();

  return {
    formato: BACKUP_FORMATO,
    versao: BACKUP_VERSAO,
    criadoEm: new Date().toISOString(),
    app: 'Estudo360',
    gabinete: { id: gabineteId, nome: meta?.nome || 'Gabinete' },
    escritorio: loadOfficeSettings(),
    empresas,
    colecoes,
    contagens: { empresas: empresas.length, ...contar(colecoes) },
  };
}

export function nomeFicheiroBackup(backup: GabineteBackup): string {
  const data = backup.criadoEm.slice(0, 10);
  const nome = (backup.gabinete.nome || 'gabinete')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `estudo360-backup-${nome || 'gabinete'}-${data}.json`;
}

/** Descarrega o pacote como .json (UTF-8, sem BOM). */
export function descarregarBackup(backup: GabineteBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFicheiroBackup(backup);
  a.click();
  URL.revokeObjectURL(url);
}

export type ValidacaoBackup =
  | { ok: true; backup: GabineteBackup }
  | { ok: false; erro: string };

/** Valida o ficheiro antes de tocar em dados. Nunca lança. */
export function validarBackup(dados: unknown): ValidacaoBackup {
  if (!dados || typeof dados !== 'object') return { ok: false, erro: 'O ficheiro não é um JSON válido.' };
  const b = dados as Partial<GabineteBackup>;

  if (b.formato !== BACKUP_FORMATO) {
    return { ok: false, erro: 'Este ficheiro não é uma cópia de segurança do Estudo360.' };
  }
  if (typeof b.versao !== 'number' || b.versao < 1) {
    return { ok: false, erro: 'A cópia não tem versão reconhecida.' };
  }
  if (b.versao > BACKUP_VERSAO) {
    return { ok: false, erro: `A cópia é de uma versão mais recente (${b.versao}). Atualize a aplicação.` };
  }
  if (!b.gabinete || typeof b.gabinete !== 'object' || typeof b.gabinete.nome !== 'string') {
    return { ok: false, erro: 'A cópia não identifica o gabinete.' };
  }
  if (b.colecoes && typeof b.colecoes !== 'object') {
    return { ok: false, erro: 'A secção de dados está corrompida.' };
  }
  if (b.empresas !== undefined && !Array.isArray(b.empresas)) {
    return { ok: false, erro: 'A carteira de clientes está corrompida.' };
  }

  // Cada registo tem de ter id. Um id em falta criaria documentos inválidos
  // que a app não consegue abrir nem apagar.
  const colecoes = (b.colecoes ?? {}) as Record<string, unknown>;
  for (const col of BACKUP_COLS) {
    const lista = colecoes[col];
    if (lista === undefined) continue;
    if (!Array.isArray(lista)) {
      return { ok: false, erro: `A coleção «${col}» não é uma lista.` };
    }
    const semId = lista.findIndex((x) => !x || typeof (x as { id?: unknown }).id !== 'string');
    if (semId >= 0) {
      return { ok: false, erro: `A coleção «${col}» tem um registo sem identificador (posição ${semId + 1}).` };
    }
  }

  return { ok: true, backup: b as GabineteBackup };
}

export interface ResultadoRestauro {
  importados: number;
  porColecao: Record<string, number>;
  empresas: number;
}

/**
 * Escreve o conteúdo no gabinete ativo.
 * `substituir` remove do cache os registos que não existem na cópia (o
 * servidor só perde os que forem apagados explicitamente, por isso é preciso
 * confirmar antes na UI).
 */
export async function restaurarBackupGabinete(
  backup: GabineteBackup,
  opcoes: { substituir?: boolean } = {},
): Promise<ResultadoRestauro> {
  const gabineteId = getActiveGabineteId();
  if (!gabineteId) throw new BackupError('Não há um gabinete ativo. Escolha um gabinete primeiro.');

  const v = validarBackup(backup);
  if (v.ok === false) throw new BackupError(v.erro);

  const porColecao: Record<string, number> = {};
  let importados = 0;

  for (const col of BACKUP_COLS) {
    const lista = backup.colecoes?.[col];
    if (!Array.isArray(lista) || lista.length === 0) continue;
    for (const item of lista) {
      const registo = item as Record<string, unknown>;
      const id = String(registo.id);
      // Nunca copiar `deletedAt` de outro gabinete: um registo apagado na
      // origem voltaria apagado aqui e pareceria perdido.
      const { deletedAt: _ignorado, ...semLixeira } = registo;
      guardarRegistoGabinete(col, id, semLixeira);
    }
    porColecao[col] = lista.length;
    importados += lista.length;
  }

  return { importados, porColecao, empresas: backup.empresas?.length ?? 0 };
}

/** Resumo legível para a UI, sem listar tudo. */
export function resumoBackup(backup: GabineteBackup): Array<{ label: string; valor: number }> {
  const rotulos: Record<string, string> = {
    empresas: 'Clientes na carteira',
    clientes: 'Fichas de cliente',
    obrigacoes: 'Obrigações',
    tarefas: 'Tarefas',
    contactosGeral: 'Contactos',
    alertasGeral: 'Alertas',
    ocorrencias: 'Ocorrências',
    documentos: 'Documentos',
    actas: 'Atas',
    cofre: 'Entradas do cofre',
    conversas: 'Conversas',
    modelos: 'Modelos de comunicação',
    envios: 'Envios',
    tempos: 'Tempos',
  };
  return Object.entries(backup.contagens || {})
    .filter(([, n]) => typeof n === 'number')
    .map(([k, n]) => ({ label: rotulos[k] || k, valor: n as number }));
}
