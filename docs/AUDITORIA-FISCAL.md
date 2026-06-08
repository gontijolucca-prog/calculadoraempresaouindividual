# Auditoria — Simulador Fiscal (ENI vs Lda)

Data: 2026-06-08 · Estado: Fase 1 (KB corrigido + flags); engine + derrama = Fase 2 (a decidir).

## Resumo
Modelo **sofisticado e bem documentado** — cita artigos do CIRS/CIRC e cobre coeficientes do art.31.º, regra de justificação dos 15% (n.º13), IRS Jovem, transparência fiscal (art.6.º CIRC), SS independente (agora com o teto 12×IAS) e IRC PME 15%/19%. Dois tipos de achado: (a) **erro grave no cérebro do bot** (chaves de campo inventadas) — corrigido; (b) **simplificações fiscais** a decidir/validar (derrama, dividendos).

## Eixo 1 — Cobertura legal (2026)
- ✅ IRC 15% até 50k / 19% acima (PME). Coeficientes art.31. Justificação 15% n.13 (coef. 0,75/0,35). IRS Jovem. Transparência fiscal. SS independente via motor central (com teto novo).
- ⚠ **Derrama municipal ausente** (até 1,5%). **Retenção serviços 11,5%** a confirmar. Ver `AUDITORIA-FISCAL-PENDENTE.md`.

## Eixo 2 — Completude
- ENI (simplificado) vs Lda (IRC ou transparência) bem coberto.
- ❌ Lado Lda sem **derrama municipal**; o **líquido do vencedor não considera os 28% de dividendos** (assume lucro retido — divulgado em nota, mas pode enganar o headline). Falta **contabilidade organizada ENI** (alternativa ao simplificado).

## Eixo 3 — Fidelidade
- ⚠ **O motor vive inline no componente** (`useMemo`), não numa lib — **não é testável** sem extrair. É a maior dívida técnica desta ferramenta. Proposta: extrair para `src/lib/fiscal.ts` (`compararEniLda(params)`) e criar casos golden (Fase 2).

## Eixo 4 — Minimalismo de inputs
- Muitos inputs (investimento, custos, contabilidade) — inerente à comparação. Pré-preenchíveis do Perfil (já usa `profile.atividadePrincipal`, `beneficioJovem`, `idade`, `nrDependentes`, `faturaçaoAnualPrevista`). Bom.

## Eixo 5 — Funcional / mobile
- Mobile: sem transbordo a 360px. ✅

## Eixo 6 — Sincronia do AI Contabilista
- 🔴 **Corrigido erro grave**: a KB listava campos **inventados** (`revenueAnnual`, `custos_cogs`, `atividade`, `investimento_inicial`…) que **não existem** no estado. O bot não conseguia preencher esta ferramenta. Substituídos pelas **chaves reais** (`rev`, `monthlyNeed`, `isServices`, `transparenciaFiscal`, `fixedMo`, `varYr`, `accMoLda`, `accMoEni`, `invEquip`…) + método e limitações.

## Fase 1 — implementado agora
1. KB corrigido (chaves reais + método + limitações conhecidas).
2. Sinalizações para a Sandrine (derrama, retenção, dividendos, PPC, limiar 15%).

## Fase 2 — a decidir/validar
1. **Extrair o motor para `src/lib/fiscal.ts`** + casos golden (torna testável e protege as futuras mudanças).
2. **Derrama municipal** no IRC da Lda (taxa do concelho/perfil, como o Previsa).
3. Mostrar a hipótese **lucro distribuído (−28%)** a par do lucro retido.
4. Rever retenção na fonte de serviços (11,5% vs 25%).
5. Opção de **contabilidade organizada** para o ENI.
