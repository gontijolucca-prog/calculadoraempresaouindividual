/**
 * Importação em lote de SAF-Ts: converte cada XML já processado num registo de
 * empresa novo (uma empresa por ficheiro), com dedupe por NIF e um orçamento de
 * armazenamento para o XML em bruto — o localStorage tem ~5MB, por isso um lote
 * grande não pode guardar todos os ficheiros (os dados importados ficam sempre).
 *
 * Lógica pura (sem DOM): o parse do XML fica em saft.ts (DOMParser) e a leitura
 * dos ficheiros no App. Testado em saftLote.test.ts.
 */
import type { SAFTParseResult } from './saft';
import { normalizeXmlEncodingToUtf8 } from './saft';
import type { EmpresaRecord } from './empresas';
import { SAFT_REPARSE_REV } from './empresas';
import type { ClientProfile } from '../ClientProfile';
import type { PreviSaState } from '../previSaState';

/** Orçamento de caracteres de XML em bruto por lote (~2MB). */
export const LOTE_SAFT_XML_BUDGET = 2_000_000;

export interface SaftLoteCriada { id: string; nome: string; nif: string; xmlGuardado: boolean; }
export interface SaftLoteRepetida { fileName: string; nome: string; nif: string; }
export interface SaftLoteErro { fileName: string; erro: string; }

export interface SaftLoteResumo {
  criadas: SaftLoteCriada[];
  repetidas: SaftLoteRepetida[];
  erros: SaftLoteErro[];
}

export type SaftLoteDestino =
  | { tipo: 'criada'; empresa: EmpresaRecord; nome: string; nif: string; xmlGuardado: boolean }
  | { tipo: 'repetida'; nome: string; nif: string }
  | { tipo: 'erro'; erro: string };

export function prepararEmpresaSAFT(args: {
  id: string;
  fileName: string;
  /** XML em bruto, já descodificado pelo caller (decodeSaftText). */
  text: string;
  result: SAFTParseResult;
  /** NIFs (só dígitos) já na carteira; o caller adiciona o novo após criar. */
  existentes: Set<string>;
  now: number;
  /** Caracteres de XML que ainda cabem neste lote. */
  orcamentoXml: number;
  /** Sementes: defaultProfile / defaultPreviSaState() do App. */
  baseProfile: ClientProfile;
  basePrevisa: PreviSaState;
}): SaftLoteDestino {
  const { id, fileName, text, result, existentes, now, baseProfile, basePrevisa } = args;
  if (!result?.profile || Object.keys(result.profile).length === 0) {
    return { tipo: 'erro', erro: 'Nenhum campo reconhecido no ficheiro.' };
  }
  const nome = (result.profile.nomeCliente || '').trim() || fileName.replace(/\.xml$/i, '');
  const nif = String(result.profile.nif ?? '').replace(/\D/g, '');
  if (nif && existentes.has(nif)) return { tipo: 'repetida', nome, nif };

  const profile: ClientProfile = { ...baseProfile, ...result.profile };
  if (result.contabilidade && Object.keys(result.contabilidade).length > 0) {
    profile.contabilidade = { ...baseProfile.contabilidade, ...result.contabilidade };
  }
  if (result.contabilidadeAbertura && Object.keys(result.contabilidadeAbertura).length > 0) {
    profile.contabilidadeAbertura = result.contabilidadeAbertura;
  }

  const xml = normalizeXmlEncodingToUtf8(text);
  const xmlGuardado = xml.length <= args.orcamentoXml;
  const empresa: EmpresaRecord = {
    id,
    nome,
    nif,
    createdAt: now,
    updatedAt: now,
    profile,
    previsa: { ...basePrevisa, ...(result.previsa ?? {}) },
    ...(xmlGuardado
      ? { saftXml: xml, saftFileName: fileName, saftImportedAt: now, saftReprocessadoEm: now, saftReparseRev: SAFT_REPARSE_REV }
      : {}),
  };
  return { tipo: 'criada', empresa, nome, nif, xmlGuardado };
}
