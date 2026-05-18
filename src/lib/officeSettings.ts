/**
 * Definições do Escritório de Contabilidade.
 *
 * Estes dados pertencem ao licenciado (escritório que comprou a ferramenta),
 * não ao cliente. Aparecem como cabeçalho/rodapé em todas as propostas, simulações
 * e contratos exportados — branding.
 *
 * Persistência: localStorage (mesma chave-prefix das outras settings).
 * Migração futura: Firestore por utilizador autenticado.
 */

import { loadFromStorage, saveToStorage } from './storage';

export type EntidadeOutorgante = 'individual' | 'sociedade';

export interface OfficeSettings {
  /** Tipo de entidade — contabilista a título individual ou sociedade de contabilidade. */
  tipo: EntidadeOutorgante;

  /** Nome do contabilista (PF) ou Firma/Denominação social (PJ). */
  nome: string;

  /** NIF (PF) ou NIPC (PJ). 9 dígitos. */
  nif: string;

  /** Cédula profissional do CC responsável (ou Diretor Técnico se PJ). */
  cedulaProfissional: string;

  /** Nome do contabilista certificado responsável (relevante apenas se tipo='sociedade'). */
  contabilistaResponsavel: string;

  /** Nº inscrição na Ordem dos Contabilistas Certificados (sociedade). */
  numeroInscricaoOCC: string;

  /** Representante legal (gerente/administrador) — sociedade. */
  representanteLegal: string;

  /** Morada profissional / sede. */
  morada: string;
  codigoPostal: string;
  localidade: string;

  telefone: string;
  email: string;
  website: string;

  /** IBAN para receber honorários (mostrado em propostas e na minuta). */
  iban: string;

  /** Foro escolhido para resolução de litígios (Cláusula Nona). */
  foroComarca: string;

  /** Logo do escritório em base64 data URL (PNG, JPG ou SVG). */
  logoDataUrl: string;

  /** Cor primária do branding (hex). Usada em PDFs e cabeçalhos. */
  corPrimaria: string;
}

export const defaultOfficeSettings: OfficeSettings = {
  tipo: 'individual',
  nome: '',
  nif: '',
  cedulaProfissional: '',
  contabilistaResponsavel: '',
  numeroInscricaoOCC: '',
  representanteLegal: '',
  morada: '',
  codigoPostal: '',
  localidade: '',
  telefone: '',
  email: '',
  website: '',
  iban: '',
  foroComarca: 'Lisboa',
  logoDataUrl: '',
  corPrimaria: '#7B98B8',
};

const STORAGE_KEY = 'officeSettings';

export function loadOfficeSettings(): OfficeSettings {
  return loadFromStorage<OfficeSettings>(STORAGE_KEY, defaultOfficeSettings);
}

export function saveOfficeSettings(s: OfficeSettings): void {
  saveToStorage(STORAGE_KEY, s);
}

/** Verifica se as definições mínimas estão preenchidas para emitir propostas/contratos. */
export function officeSettingsAreComplete(s: OfficeSettings): boolean {
  const baseRequired = !!s.nome && !!s.nif && !!s.cedulaProfissional && !!s.morada;
  if (s.tipo === 'sociedade') {
    return baseRequired && !!s.numeroInscricaoOCC && !!s.representanteLegal && !!s.contabilistaResponsavel;
  }
  return baseRequired;
}
