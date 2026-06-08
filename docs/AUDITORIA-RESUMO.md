# Auditoria Estudo 360 — Resumo da varredura (Fase 1)

Data: 2026-06-08. Varrimento ferramenta-a-ferramenta nos 6 eixos (cobertura legal, completude, fidelidade, minimalismo, funcional/mobile, sincronia do AI Contabilista). **Zero números fiscais inventados — tudo o que é incerto está sinalizado em `AUDITORIA-FISCAL-PENDENTE.md` para a Sandrine.**

## Estado por ferramenta (Fase 1 — tudo LIVE)

| Ferramenta | Motor | Testes golden | Achado principal (F1) |
|------------|-------|---------------|------------------------|
| IRS (Modelo 3) | `lib/irs.ts` | 5 | UI/labels corrigidos; anexos E/F/G/C/H = Fase 2 |
| Lista de Empresas | — | — | **Bug mobile corrigido** (cartões transbordavam) |
| Salário Líquido | `lib/salario.ts` | 14 | Retenção = estimativa; **região ligada** ao fator do IRS; estado civil = F2 |
| SS Independente | `pt2026.ts` | 12 | **Teto da base 12×IAS implementado** (faltava) |
| Fiscal ENI/Lda | `TaxSimulator` (inline) | — | **KB do bot tinha campos inventados** → corrigido |
| Previsa / IRC | `lib/previsaCalc.ts` | 10 | Motor impecável; **PEC** sinalizado (revogado/transitório) |
| IMT | `lib/imt.ts` | 7 | Comentário enganoso corrigido; motor correto |
| Viaturas | `VehicleSimulator` (inline) | — | Coerente; sem agravamento TA com prejuízo |
| Tickets | inline + `pt2026.ts` | — | Fator IRC do subsídio (60%) a confirmar |
| Diagnóstico | inline | — | Diagnóstico de gestão, não fiscal; limpo |
| Imóveis | inline + `lib/imt.ts` | — | Reutiliza IMT; pressupostos assinalados |
| Perfil | — | — | Fonte de pré-preenchimento (chave do minimalismo) |
| Honorários | `lib/honorarios.ts` | 3 | Pricing do escritório; limpo |
| Exportar | gerador | — | Sem cálculo próprio |

**Total: 62 asserções golden** (6 suites) a proteger contra regressões. Motores de cálculo principais agora testados: IRS, Salário, SS, Previsa, IMT, Honorários (`npx tsx src/lib/*.test.ts`).

## Padrão recorrente encontrado
A KB do AI Contabilista (gerada por workflow) tinha **chaves de campo inventadas** em várias ferramentas (IRS, Salário=anual vs mensal, **Fiscal=tudo fabricado**). Corrigidas com as chaves reais — o bot já consegue preencher os simuladores.

## Mudanças que alteraram cálculos (aprovadas peça-a-peça)
1. **SS Independente — teto 12×IAS** (também afeta o Fiscal ENI/Lda em rendimentos altos).
2. **Salário — região (Açores 0,80 / Madeira 0,70)** passa a reduzir a retenção.
Tudo o resto (KB, testes, docs, flags) não mexeu em números.

## Backlog Fase 2 (precisa de validação da Sandrine ou refactor)
- **IRS:** anexos E/F/G/C/H (PPR/donativos), englobamento, pré-preenchimento.
- **Salário:** tabelas oficiais de retenção mensal + estado civil + subsídios férias/Natal.
- **SS:** ajuste ±25%, acumulação TCO, entidade contratante.
- **Fiscal:** extrair motor para `lib/fiscal.ts` + golden tests + **derrama municipal** + hipótese dividendos (−28%) + retenção 25%.
- **Previsa:** confirmar/atualizar **PEC** (limite 2026); importar viaturas/rubricas do SAF-T.
- **Viaturas:** extrair motor para lib + golden tests; agravamento TA com prejuízo.
- **Transversal (maior alavanca):** **pré-preencher todos os simuladores a partir do Perfil**.
- **Validação fiscal:** confirmar TODOS os valores em `AUDITORIA-FISCAL-PENDENTE.md`.

## Mobile
Varrimento ao vivo a 360px: **sem transbordo horizontal** em nenhum simulador. O único bug real (Lista de Empresas) foi corrigido. Falta verificar a vista Exportar ao vivo.
