// Testes da importação em lote de SAF-Ts: dedupe por NIF, fallback de nome e
// orçamento de XML (o localStorage tem ~5MB — nem todo o XML do lote cabe).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { prepararEmpresaSAFT, LOTE_SAFT_XML_BUDGET } from './saftLote';
import { SAFT_REPARSE_REV } from './empresas';
import type { SAFTParseResult } from './saft';
import type { ClientProfile } from '../ClientProfile';
import type { PreviSaState } from '../previSaState';

const XML = '<?xml version="1.0" encoding="Windows-1252"?>\n<AuditFile></AuditFile>';
const NOW = 1_790_000_000_000;

const baseProfile = {
  nomeCliente: '',
  nif: '',
  contabilidade: { caixaDepositos: 0, saftImportado: false },
} as unknown as ClientProfile;
const basePrevisa = { nif: '', designacao: '', volumeNegocios: 0 } as unknown as PreviSaState;

function mkResult(
  profile: Record<string, unknown> = {},
  previsa: Record<string, unknown> = {},
  contabilidade?: Record<string, unknown>,
  contabilidadeAbertura?: Record<string, unknown>,
): SAFTParseResult {
  return {
    profile,
    previsa,
    warnings: [],
    filled: [],
    empty: [],
    details: [],
    ...(contabilidade ? { contabilidade } : {}),
    ...(contabilidadeAbertura ? { contabilidadeAbertura } : {}),
  } as unknown as SAFTParseResult;
}

function args(over: Partial<Parameters<typeof prepararEmpresaSAFT>[0]> = {}) {
  return {
    id: 'emp_1',
    fileName: 'cliente.xml',
    text: XML,
    result: mkResult({ nomeCliente: 'Atlântico Lda', nif: '123 456 789' }),
    existentes: new Set<string>(),
    now: NOW,
    orcamentoXml: LOTE_SAFT_XML_BUDGET,
    baseProfile,
    basePrevisa,
    ...over,
  };
}

describe('prepararEmpresaSAFT', () => {
  it('cria empresa com nome, NIF só dígitos e XML normalizado a UTF-8', () => {
    const d = prepararEmpresaSAFT(args());
    if (d.tipo !== 'criada') assert.fail(`esperava criada, veio ${d.tipo}`);
    assert.equal(d.nome, 'Atlântico Lda');
    assert.equal(d.nif, '123456789');
    assert.equal(d.empresa.nif, '123456789');
    assert.equal(d.empresa.createdAt, NOW);
    assert.equal(d.empresa.saftFileName, 'cliente.xml');
    assert.equal(d.empresa.saftImportedAt, NOW);
    assert.equal(d.empresa.saftReprocessadoEm, NOW);
    assert.equal(d.empresa.saftReparseRev, SAFT_REPARSE_REV);
    assert.match(d.empresa.saftXml!, /encoding="UTF-8"/);
    assert.doesNotMatch(d.empresa.saftXml!, /Windows-1252/);
    assert.equal(d.xmlGuardado, true);
  });

  it('sem nome no SAF-T usa o nome do ficheiro (sem .xml)', () => {
    const d = prepararEmpresaSAFT(args({
      fileName: 'empresa-2025.xml',
      result: mkResult({ nif: '999999990' }),
    }));
    if (d.tipo !== 'criada') assert.fail(`esperava criada, veio ${d.tipo}`);
    assert.equal(d.nome, 'empresa-2025');
  });

  it('NIF já na carteira → repetida, sem criar', () => {
    const d = prepararEmpresaSAFT(args({
      result: mkResult({ nomeCliente: 'Repetida Lda', nif: '123456789' }),
      existentes: new Set(['123456789']),
    }));
    assert.equal(d.tipo, 'repetida');
    if (d.tipo !== 'repetida') return;
    assert.equal(d.nif, '123456789');
    assert.equal(d.nome, 'Repetida Lda');
  });

  it('profile vazio → erro (nada a importar)', () => {
    const d = prepararEmpresaSAFT(args({ result: mkResult() }));
    assert.equal(d.tipo, 'erro');
  });

  it('sem NIF cria na mesma (dedupe só quando há NIF)', () => {
    const d = prepararEmpresaSAFT(args({ result: mkResult({ nomeCliente: 'Sem NIF Lda' }) }));
    if (d.tipo !== 'criada') assert.fail(`esperava criada, veio ${d.tipo}`);
    assert.equal(d.nif, '');
    assert.equal(d.empresa.nif, '');
  });

  it('orçamento esgotado → cria sem guardar o XML em bruto', () => {
    const d = prepararEmpresaSAFT(args({ orcamentoXml: 10 }));
    if (d.tipo !== 'criada') assert.fail(`esperava criada, veio ${d.tipo}`);
    assert.equal(d.xmlGuardado, false);
    assert.equal(d.empresa.saftXml, undefined);
    assert.equal(d.empresa.saftFileName, undefined);
  });

  it('funde contabilidade, abertura e PreviSa por cima das sementes', () => {
    const d = prepararEmpresaSAFT(args({
      result: mkResult(
        { nomeCliente: 'Fusões Lda', nif: '555555550' },
        { volumeNegocios: 12345 },
        { caixaDepositos: 999 },
        { caixaDepositos: 111 },
      ),
    }));
    if (d.tipo !== 'criada') assert.fail(`esperava criada, veio ${d.tipo}`);
    assert.equal(d.empresa.profile.contabilidade?.caixaDepositos, 999);
    assert.equal(d.empresa.profile.contabilidade?.saftImportado, false);
    assert.equal(d.empresa.profile.contabilidadeAbertura?.caixaDepositos, 111);
    assert.equal(d.empresa.previsa?.volumeNegocios, 12345);
    assert.equal(d.empresa.previsa?.nif, '');
  });
});
