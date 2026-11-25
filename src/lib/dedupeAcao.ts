// Executa a limpeza de empresas duplicadas: funde os registos, reaponta as
// fichas do gabinete, funde fichas com o mesmo NIF e publica na cloud.
//
// Fica separado de `empresasDedupe.ts` (lógica pura, testável sem Firebase)
// porque este módulo toca no gabinete, no Firestore e no cliente ativo.
import {
  listEmpresas, saveEmpresas, getCurrentEmpresaId, setCurrentEmpresaId,
  saveEmpresasToFirestore,
} from './empresas';
import { gruposDuplicadas, juntarEmpresas } from './empresasDedupe';
import { listClientesCache, upsertCliente, fundirClientesDuplicados } from './gabinete';

export interface ResultadoFusao {
  apagadas: number;
  fichasReapontadas: number;
  registosMovidos: number;
}

/** Funde todas as empresas do grupo com este NIF no registo `manterId`. */
export async function fundirEmpresasDuplicadas(nif: string, manterId: string): Promise<ResultadoFusao> {
  const list = listEmpresas();
  const grupo = gruposDuplicadas(list).find((g) => g.nif === nif);
  const vazio: ResultadoFusao = { apagadas: 0, fichasReapontadas: 0, registosMovidos: 0 };
  if (!grupo) return vazio;

  const manter = grupo.empresas.find((e) => e.id === manterId) ?? grupo.empresas[0];
  const apagar = grupo.empresas.filter((e) => e.id !== manter.id);
  if (!apagar.length) return vazio;
  const idsApagar = new Set(apagar.map((e) => e.id));

  const merged = juntarEmpresas(manter, apagar);
  saveEmpresas(
    list
      .map((e) => (e.id === manter.id ? { ...merged, updatedAt: Date.now() } : e))
      .filter((e) => !idsApagar.has(e.id)),
  );

  const ativa = getCurrentEmpresaId();
  if (ativa && idsApagar.has(ativa)) setCurrentEmpresaId(manter.id);

  // Fichas do gabinete: reapontar e depois fundir as que têm o mesmo NIF.
  let fichasReapontadas = 0;
  for (const c of listClientesCache()) {
    if (c.empresaId && idsApagar.has(c.empresaId) && c.empresaId !== manter.id) {
      await upsertCliente({ ...c, empresaId: manter.id });
      fichasReapontadas++;
    }
  }

  let registosMovidos = 0;
  const clientesNif = listClientesCache().filter(
    (c) => !c.deletedAt && (c.nif ?? '').replace(/\D/g, '') === nif,
  );
  if (clientesNif.length > 1) {
    const base = clientesNif.find((c) => c.empresaId === manter.id) ?? clientesNif[0];
    registosMovidos = await fundirClientesDuplicados(
      base.id,
      clientesNif.filter((c) => c.id !== base.id).map((c) => c.id),
    );
  }

  try {
    await saveEmpresasToFirestore(undefined, listEmpresas());
  } catch {
    // Sem rede: a próxima sincronização leva a lista já limpa (stamp local é mais novo).
  }

  return { apagadas: apagar.length, fichasReapontadas, registosMovidos };
}

/** Corre a fusão para os grupos indicados (nif → id que fica). */
export async function limparDuplicadas(escolhas: Record<string, string>): Promise<{
  grupos: number;
  apagadas: number;
  fichasReapontadas: number;
  registosMovidos: number;
}> {
  let gruposFeitos = 0, apagadas = 0, fichasReapontadas = 0, registosMovidos = 0;
  for (const [nif, manterId] of Object.entries(escolhas)) {
    const r = await fundirEmpresasDuplicadas(nif, manterId);
    if (r.apagadas) gruposFeitos++;
    apagadas += r.apagadas;
    fichasReapontadas += r.fichasReapontadas;
    registosMovidos += r.registosMovidos;
  }
  return { grupos: gruposFeitos, apagadas, fichasReapontadas, registosMovidos };
}
