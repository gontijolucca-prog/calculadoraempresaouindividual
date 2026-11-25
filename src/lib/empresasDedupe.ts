// Duplicadas no registry de empresas — deteção e fusão.
//
// Duplicados nascem de importações repetidas do mesmo SAF-T (cada import criava
// um registo novo com o mesmo NIF). A sincronização já colapsa NIFs ao ler a
// cloud, mas a lista local pode mostrar os dois e apagar um deles à mão perdia
// o SAF-T, o histórico de simulações e o link para a ficha do gabinete.
//
// Regra: só é duplicado quem tem o MESMO NIF válido (9 dígitos). Empresas sem
// NIF (recém-criadas, por preencher) nunca são tocadas — podem ser clientes
// distintos.
import type { EmpresaRecord } from './empresas';

export interface GrupoDuplicadas {
  nif: string;
  empresas: EmpresaRecord[];
}

const nifDigits = (nif: string | undefined) => (nif ?? '').replace(/\D/g, '');

/** Grupos de 2+ empresas com o mesmo NIF válido. Ordem: do mais antigo ao mais recente. */
export function gruposDuplicadas(list: EmpresaRecord[]): GrupoDuplicadas[] {
  const porNif = new Map<string, EmpresaRecord[]>();
  for (const e of list) {
    const nif = nifDigits(e.nif);
    if (!/^\d{9}$/.test(nif)) continue;
    const grupo = porNif.get(nif);
    if (grupo) grupo.push(e); else porNif.set(nif, [e]);
  }
  return [...porNif.entries()]
    .filter(([, empresas]) => empresas.length > 1)
    .map(([nif, empresas]) => ({
      nif,
      empresas: [...empresas].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    }))
    .sort((a, b) => a.empresas[0].createdAt - b.empresas[0].createdAt);
}

const vazio = (v: unknown) =>
  v === undefined || v === null || v === '' || (typeof v === 'string' && v.trim() === '');

/** Junta os dados dos duplicados no registo que fica: preenche vazios, une
 *  simulações por id (mais recente ganha) e preserva o SAF-T original. */
export function juntarEmpresas(manter: EmpresaRecord, outros: EmpresaRecord[]): EmpresaRecord {
  const merged: EmpresaRecord = { ...manter, profile: { ...manter.profile } };
  const perfil = merged.profile as unknown as Record<string, unknown>;

  for (const o of outros) {
    const perfilOutro = (o.profile ?? {}) as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(perfilOutro)) {
      if (vazio(perfil[k]) && !vazio(v)) perfil[k] = v;
    }
  }

  // Histórico de simulações: união por id; a mais recente de cada id fica.
  const sims = new Map<string, NonNullable<EmpresaRecord['simulacoes']>[number]>();
  for (const e of [manter, ...outros]) {
    for (const s of e.simulacoes ?? []) {
      if (!s?.id) continue;
      const ex = sims.get(s.id);
      if (!ex || (s.createdAt ?? 0) > (ex.createdAt ?? 0)) sims.set(s.id, s);
    }
  }
  if (sims.size) merged.simulacoes = [...sims.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  // Estado por simulador: o que fica manda; chaves em falta vêm dos outros.
  if (merged.sims || outros.some(o => o.sims)) {
    merged.sims = { ...(outros.find(o => o.sims)?.sims ?? {}), ...(merged.sims ?? {}) };
    for (const o of outros) {
      for (const [k, v] of Object.entries(o.sims ?? {})) {
        if (vazio((merged.sims as Record<string, unknown>)[k]) && !vazio(v)) {
          (merged.sims as Record<string, unknown>)[k] = v;
        }
      }
    }
  }

  if (vazio(merged.previsa)) {
    const comPrevisa = outros.find(o => !vazio(o.previsa));
    if (comPrevisa) merged.previsa = comPrevisa.previsa;
  }
  if (vazio(merged.toc)) {
    const comToc = outros.find(o => !vazio(o.toc));
    if (comToc) merged.toc = comToc.toc;
  }

  // SAF-T: guarda o XML mais completo (o que permite re-exportar e re-processar).
  const comSaft = [manter, ...outros].filter(e => !vazio(e.saftXml));
  if (comSaft.length) {
    const melhor = comSaft.reduce((a, b) => ((b.saftXml?.length ?? 0) > (a.saftXml?.length ?? 0) ? b : a));
    merged.saftXml = melhor.saftXml;
    merged.saftFileName = melhor.saftFileName ?? merged.saftFileName;
    merged.saftImportedAt = Math.max(...comSaft.map(e => e.saftImportedAt ?? 0)) || merged.saftImportedAt;
    merged.saftReparseRev = comSaft.reduce((m, e) => Math.max(m, e.saftReparseRev ?? 0), 0) || undefined;
    merged.saftReprocessadoEm = Math.max(...comSaft.map(e => e.saftReprocessadoEm ?? 0)) || undefined;
  }

  merged.createdAt = Math.min(manter.createdAt || Infinity, ...outros.map(o => o.createdAt || Infinity));
  if (!Number.isFinite(merged.createdAt)) merged.createdAt = manter.createdAt;
  return merged;
}

/** Números para a pré-visualização: o que se ganha/perde ao escolher `manterId`. */
export function resumoFusao(grupo: GrupoDuplicadas, manterId: string) {
  const manter = grupo.empresas.find(e => e.id === manterId) ?? grupo.empresas[0];
  const outros = grupo.empresas.filter(e => e.id !== manter.id);
  const merged = juntarEmpresas(manter, outros);
  return {
    manter,
    apagadas: outros.length,
    simulacoes: merged.simulacoes?.length ?? 0,
    simulacoesGanhas: (merged.simulacoes?.length ?? 0) - (manter.simulacoes?.length ?? 0),
    temSaft: !!merged.saftXml,
    saftSoNosOutros: !manter.saftXml && outros.some(o => !!o.saftXml),
  };
}
