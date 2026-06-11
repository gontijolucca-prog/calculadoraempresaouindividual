/**
 * Auto-preenchimento da "Análise completa de enquadramento 2026" a partir do
 * SAF-T da empresa ativa. O parser do SAF-T já alimenta `emp.previsa`
 * (rendimentos por conta 71/72/75/78 e gastos classe 6) e o balanço do perfil
 * — aqui só MAPEAMOS esses valores para os inputs do motor, sem inventar nada:
 *  - vendas = contas 711+712; prestações (72) vão para serviços do art. 151.º
 *    ou "outros serviços" consoante a atividade do perfil;
 *  - gastos = classe 6 SÓ rubricas de caixa dedutíveis (CMV/CMC/62/63/68/69 —
 *    excluímos 64-67, não-cash, para a disponibilidade não sair distorcida);
 *  - tributações autónomas = motor do Previsa (calculate().taTotal), testado;
 *  - total do balanço = soma do ativo (mesma fórmula do Diagnóstico).
 * Valores guardados pelo utilizador (enq2026) têm SEMPRE precedência.
 */
import type { ClientProfile } from '../ClientProfile';
import type { EmpresaRecord } from './empresas';
import { defaultPreviSaState, type PreviSaState } from '../previSaState';
import { calculate } from './previsaCalc';
import { coefFromProfile } from './pt2026';
import type { InputEnq2026 } from './enquadramento2026';

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface SaftSeedResult {
  seed: Partial<InputEnq2026>;
  /** O que foi pré-preenchido (mostrado ao utilizador como proveniência). */
  preenchidos: string[];
}

export function seedEnqFromSaft(emp: EmpresaRecord | null | undefined, profile: ClientProfile | undefined): SaftSeedResult {
  const seed: Partial<InputEnq2026> = {};
  const preenchidos: string[] = [];
  if (!emp) return { seed, preenchidos };

  const pv = (emp.previsa ?? {}) as Partial<PreviSaState>;

  // ── Rendimentos por natureza ──
  const vendas = r2(n(pv.rai_711) + n(pv.rai_712));
  const prest72 = r2(n(pv.rai_72));
  const restantes = r2(n(pv.rai_75) + n(pv.rai_78)); // subsídios à exploração + outros rendimentos
  const servProf151 = profile?.atividadePrincipal ? coefFromProfile(profile.atividadePrincipal) === 0.75 : false;
  if (vendas || prest72 || restantes) {
    seed.rend = {
      vendas,
      servicosProf: servProf151 ? prest72 : 0,
      outrosServicos: servProf151 ? 0 : prest72,
      restantes,
    };
    if (vendas) preenchidos.push('vendas (contas 711/712)');
    if (prest72) preenchidos.push(`prestações de serviços (72) → ${servProf151 ? 'art. 151.º (atividade do perfil)' : 'outros serviços'}`);
    if (restantes) preenchidos.push('subsídios e outros rendimentos (75/78)');
    // O SAF-T é do exercício anterior — serve de base às validações de elegibilidade.
    seed.faturacaoAnoAnterior = r2(vendas + prest72 + restantes);
    preenchidos.push('faturação do ano anterior (total do SAF-T)');
  }

  // ── Gastos: rubricas de caixa dedutíveis (sem 64-67, não-cash) ──
  const gastos = r2(n(pv.rai_cmv) + n(pv.rai_cmc) + n(pv.rai_62) + n(pv.rai_63) + n(pv.rai_68) + n(pv.rai_69));
  if (gastos) {
    seed.gastosReais = gastos;
    preenchidos.push('gastos reais (CMV/CMC + FSE 62 + pessoal 63 + outros 68/69; sem depreciações/provisões)');
  }

  // ── Tributações autónomas: motor do Previsa (sem duplicar fórmulas) ──
  if (n(pv.ta_representacao) || n(pv.ta_ajadasCusto) || n(pv.ta_despNaoDocPrincipal) || (pv.viaturas?.length ?? 0) > 0) {
    const ta = calculate({ ...defaultPreviSaState(), ...pv }).taTotal;
    if (ta > 0) {
      seed.taManual = r2(ta);
      preenchidos.push('tributações autónomas (motor do Previsa sobre o SAF-T)');
    }
  }

  // ── Total do balanço: soma do ativo (mesma fórmula do Diagnóstico) ──
  const k = (profile?.contabilidade ?? {}) as Partial<ClientProfile['contabilidade']>;
  const ativoTotal = r2(
    n(k.inventarios) + n(k.clientes) + n(k.estadoOutrosAtivo) + n(k.outrosAtivosCorrentes) + n(k.caixaDepositos)
    + n(k.ativoFixoTangivel) + n(k.ativoIntangivel) + n(k.investimentosFinanceiros),
  );
  if (ativoTotal) {
    seed.totalBalanco = ativoTotal;
    preenchidos.push('total do balanço (ativo do SAF-T/perfil)');
  }

  return { seed, preenchidos };
}
