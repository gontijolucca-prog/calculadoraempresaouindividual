// Regras fiscais "duras" que o site impõe sozinho, para o utilizador NUNCA poder
// pôr o perfil num estado ilegal. Estes parâmetros são derivados da faturação e do
// tipo de entidade — não devem ser escolhidos à mão (nem pelo utilizador, nem pelo
// AI Contabilista). Aplicado num único ponto (updateProfileWithSimulatorSync) por
// onde passam TODAS as escritas ao perfil, e refletido na UI (opções bloqueadas).
import type { ClientProfile } from '../ClientProfile';

export type RegimeIva = ClientProfile['regimeIva'];

// Limiares legais (CIVA / CIRS) — manter alinhados com os comentários da UI.
export const LIMIAR_ISENCAO_IVA = 15000;      // Art. 53.º CIVA — até este valor pode ser isento
export const LIMIAR_IVA_MENSAL = 650000;      // Art. 41.º n.º 1 al. a) CIVA — acima disto, IVA mensal obrigatório
export const LIMIAR_ENI_ORGANIZADA = 200000;  // Art. 28.º/31.º CIRS / Art. 86.º-A CIRC — acima disto, contab. organizada obrigatória

/** Tipos de entidade que são sociedades comerciais (precisam de contab. organizada >200k). */
export const SOCIEDADE_TYPES = ['lda', 'unipessoal', 'sa', 'socio_unico'];

/** Regimes de IVA legalmente possíveis para uma dada faturação anual. */
export function allowedIvaRegimes(fat: number): RegimeIva[] {
  if (fat <= 0) return ['isento', 'normal_trimestral', 'normal_mensal', 'pequenos_retalhistas'];
  if (fat <= LIMIAR_ISENCAO_IVA) return ['isento', 'normal_trimestral', 'normal_mensal', 'pequenos_retalhistas'];
  if (fat > LIMIAR_IVA_MENSAL) return ['normal_mensal'];
  // Faixa intermédia: isento já não é permitido; mensal é opção voluntária.
  return ['normal_trimestral', 'normal_mensal', 'pequenos_retalhistas'];
}

/** Corrige o regime de IVA para um valor legal sem desfazer escolhas válidas. */
export function ivaForFat(regimeIva: RegimeIva, fat: number): RegimeIva {
  if (fat <= 0) return regimeIva;
  if (fat <= LIMIAR_ISENCAO_IVA) return regimeIva;                 // isento permitido (e qualquer outro voluntário)
  if (fat > LIMIAR_IVA_MENSAL) return 'normal_mensal';            // mensal obrigatório
  // Faixa intermédia: só corrige se estiver num regime proibido (isento).
  return regimeIva === 'isento' ? 'normal_trimestral' : regimeIva;
}

/** ENI no simplificado acima do limiar passa obrigatoriamente a organizada.
 *  Art. 86.º-A CIRC: sociedades com VN >200k também precisam de contab. organizada. */
export function regimeContabForFat(
  tipoEntidade: string, regimeContabilidade: ClientProfile['regimeContabilidade'], fat: number,
): ClientProfile['regimeContabilidade'] {
  const isSociedade = SOCIEDADE_TYPES.includes(tipoEntidade);
  if ((tipoEntidade === 'eni' || isSociedade) && regimeContabilidade === 'simplificado' && fat > LIMIAR_ENI_ORGANIZADA)
    return 'organizada';
  // Nota: transparencia_fiscal e RETGS nao sao forcados porque ja implicam
  // contabilidade organizada na pratica (art.86-A CIRC).
  return regimeContabilidade;
}

/**
 * Aplica TODAS as regras duras a um perfil e devolve a versão corrigida.
 * Idempotente: correr duas vezes dá o mesmo resultado. Este é o guarda-rede
 * central — qualquer escrita ao perfil (formulário, wizard ou AI Contabilista)
 * passa por aqui, por isso é impossível guardar uma combinação ilegal.
 */
export function enforceProfileRules(p: ClientProfile): ClientProfile {
  const fat = p.faturaçaoAnualPrevista || 0;
  const regimeIva = ivaForFat(p.regimeIva, fat);
  const regimeContabilidade = regimeContabForFat(p.tipoEntidade, p.regimeContabilidade, fat);
  if (regimeIva === p.regimeIva && regimeContabilidade === p.regimeContabilidade) return p;
  return { ...p, regimeIva, regimeContabilidade };
}
