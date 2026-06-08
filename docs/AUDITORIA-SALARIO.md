# Auditoria — Simulador de Salário Líquido (TCO)

Data: 2026-06-08 · Estado: Fase 1 (honestidade de copy + testes + sinalizações); Fase 2 (tabelas oficiais) a aguardar validação de um contabilista.

## Resumo
O motor (`src/lib/salario.ts` + constantes em `src/lib/pt2026.ts`) calcula bem a Segurança Social, o subsídio de alimentação (isento vs tributável) e o custo total para a empresa. **Os dois pontos sérios são de fidelidade da retenção de IRS:**

1. A retenção mensal é estimada a partir da **liquidação anual** (escalões 2026 sobre o rendimento anual) **a dividir** pelo nº de pagamentos — **não** pelas **tabelas oficiais de retenção na fonte de 2026**. Dá uma estimativa anualizada razoável, mas **não coincide com o recibo de vencimento real** mês a mês (sobretudo nos subsídios de férias/Natal, que têm regra própria).
2. O simulador **pede o estado civil e a região (Madeira/Açores) e diz na interface que estes "determinam a tabela de retenção"**, mas o motor **ignora ambos** — solteiro e casado dão o mesmo líquido; Continente, Madeira e Açores dão o mesmo líquido. (Confirmado por execução: ver casos-teste.)

Nada disto é "inventar números" — é cruzamento do código com o que a interface promete. A correção fiel exige as **tabelas oficiais de retenção de 2026**, que sinalizo internamente (não as fabrico).

## Eixo 1 — Cobertura legal (2026)
Constantes usadas (todas a confirmar por um contabilista — ver `AUDITORIA-FISCAL-PENDENTE.md`):
- SS trabalhador 11% (`SS_RATE_EMPLOYEE`), SS patronal 23,75% (`SS_RATE_EMPLOYER`) — valores-padrão; confirmar.
- Dedução específica Cat. A = 4 587,09 € (8,54 × IAS 537,13). ✅ coerente com o simulador de IRS.
- Escalões 2026 — **idênticos** aos do motor de IRS (`ESCALOES_OFICIAL_2026` == `IRS_BRACKETS_2026`), verificado linha a linha. ✅ Uma só fonte de verdade na prática.
- Limites do subsídio de alimentação 2026: cartão 10,46 €, dinheiro 6,15 € (`TICKET_LIMITS_2026`, "Despacho 233-A/2026"). ⚠ Confirmar (2025 era 10,20 / 6,00).

## Eixo 2 — Completude (casos reais que faltam)
- **Tabelas oficiais de retenção na fonte 2026** (solteiro / casado 1 titular / casado 2 titulares; Continente / Madeira / Açores; nº de titulares e dependentes). É a base correta da retenção mensal. ❌ Em falta.
- **Subsídios de férias e de Natal**: tributados pela taxa da remuneração mensal, em separado do mês de pagamento. Hoje só existe o interruptor "duodécimos" (12 vs 14 pagamentos), que não aplica a regra de tributação dos subsídios. 🟡 Parcial.
- **Trabalhador casado — quociente conjugal / 2 titulares**: a retenção difere de solteiro. ❌ Não modelado.
- Fora de âmbito provável (a confirmar): horas extra, prémios, trabalhador deslocado, sobretaxas.

## Eixo 3 — Fidelidade
- **Retenção ≠ recibo real**: método anual ÷ pagamentos em vez das tabelas mensais oficiais. Para €1500/mês (solteiro, 14 pag.) dá ~180 €/mês de retenção — uma estimativa, não o valor exato da tabela.
- Casos-teste golden criados (`src/lib/salario.test.ts`) a **fixar o comportamento atual** (anti-regressão) e a **provar** que estado civil e região não alteram hoje o resultado.

## Eixo 4 — Minimalismo de inputs
- **`localizacao` JÁ está ligada** (decisão do Lucca 08-jun): reduz a retenção em Açores (×0,80) e Madeira (×0,70), reutilizando o **mesmo fator do simulador de IRS** (`REGIOES` exportado de `irs.ts`). ⚠ As % continuam a aguardar confirmação de um contabilista.
- **`estadoCivil` ainda não altera o cálculo** — fica para a Fase 2 (precisa das tabelas oficiais por estado civil / nº de titulares; não há um fator simples a reutilizar para um salário individual).
- Pré-preenchíveis do Perfil do Cliente: `idade`, `nrDependentes`, `estadoCivil`, `localizacao`, ano de atividade/IRS Jovem. (Fase 2.)

## Eixo 5 — Funcional / mobile
- Mobile: sem transbordo horizontal a 360px (verificado ao vivo). ✅
- Copy enganosa (corrigida na Fase 1): rótulo "Estado Civil (para tabela de retenção)" e dicas de estado civil/região prometiam um efeito que o motor não tem.

## Eixo 6 — Sincronia do AI Contabilista
- `functions/_kb.ts` atualizado: o bot passa a explicar que o líquido é **estimativa anualizada** e que a retenção oficial segue as tabelas mensais de 2026 (acerto no IRS anual).

## Fase 1 — implementado agora (sem inventar números)
1. Casos-teste golden a fixar o comportamento atual (10 asserções).
2. **`localizacao` ligada** ao fator regional do IRS (Açores 0,80 / Madeira 0,70) — a retenção nas regiões autónomas passa a ser mais baixa, coerente com o simulador de IRS. ⚠ % a confirmar.
3. Copy honesta: resultado marcado como **estimativa**; a dica de estado civil deixa de afirmar um efeito inexistente; a dica de região passa a refletir que já reduz o líquido.
4. KB sincronizado.
5. Sinalizações fiscais acrescentadas internamente.

## Fase 2 — a aguardar tabelas validadas por um contabilista
1. Tabelas oficiais de retenção na fonte 2026 → retenção fiel por estado civil / titulares / dependentes.
2. Regra de tributação dos subsídios de férias e Natal.
3. Ligar `estadoCivil` ao cálculo (1 vs 2 titulares).
4. Pré-preenchimento a partir do Perfil do Cliente.
5. Casos golden validados contra recibos reais.
