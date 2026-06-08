# Auditoria — Simulador IMT + Imposto de Selo

Data: 2026-06-08 · Estado: Fase 1 (testes golden + KB + comentário corrigido + flags). Sem alterações ao cálculo.

## Resumo
Motor `src/lib/imt.ts` — bem construído, função pura, escalões progressivos, IMT Jovem, multiplicador regional, Imposto de Selo 0,8%, cita o CIMT. **Sem erros de cálculo.** Corrigi um **comentário enganoso** no IMT Jovem (dizia que IMT(limite)=0; o código subtrai o valor real — está certo, o comentário é que estava errado).

## Eixo 1 — Cobertura legal (2026)
- HPP e habitação secundária por escalões; rústico 5%; urbano outros 6,5%; Selo 0,8%; IMT Jovem (isenção + redução); regional ×1,25. ⚠ Todos os valores a confirmar — ver `AUDITORIA-FISCAL-PENDENTE.md`.

## Eixo 2 — Completude
- Cobre os tipos principais e o IMT Jovem. Não modela isenções de nicho (revenda, reabilitação urbana, fundos) — provavelmente fora de âmbito; a confirmar.

## Eixo 3 — Fidelidade
- ✅ Lib pura → testável. 7 casos golden (`src/lib/imt.test.ts`): HPP isento/escalão, habitação secundária, rústico, urbano outros, IMT Jovem isento e redução parcial. Todos passam.

## Eixo 4 — Minimalismo de inputs
- Inputs mínimos. `idadeComprador` pré-preenchível do Perfil. (Fase 2.)

## Eixo 5 — Funcional / mobile
- Mobile: sem transbordo a 360px. ✅

## Eixo 6 — Sincronia do AI Contabilista
- KB tinha as chaves reais; acrescentado o método (escalões, taxas planas, Selo, IMT Jovem, regional).

## Fase 1 — implementado agora (sem mudar cálculo)
1. 7 casos-teste golden.
2. Comentário do IMT Jovem corrigido.
3. KB com método.
4. Sinalizações para a Sandrine.
