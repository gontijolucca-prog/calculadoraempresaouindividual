# Auditoria — Simulador Previsa (IRC Modelo 22)

Data: 2026-06-08 · Estado: Fase 1 (testes golden + KB + flags). É a ferramenta mais bem construída do site.

## Resumo
Motor `src/lib/previsaCalc.ts` — **função pura, testável, extremamente fiel ao Modelo 22**: usa os campos reais (c708, c753, c776, c347/351/358/367), Q07/Q09/Q10, derrama estadual e municipal, tributações autónomas (viaturas + despesas), PEC e PC. Cita os artigos. **Nenhum erro de cálculo encontrado nas partes verificáveis.** Único ponto sério: o **PEC** pode estar desatualizado (regime revogado/transitório).

## Eixo 1 — Cobertura legal (2026)
- IRC 19% geral / 15% PME (+ regionais Madeira/Açores/interioridade/startup), derrama estadual por escalões (art.87-A), derrama municipal, TA art.88 — todos presentes e coerentes. ⚠ Valores a confirmar — ver `AUDITORIA-FISCAL-PENDENTE.md`.
- ⚠ **PEC**: art.93.º revogado (Lei 12/2022), regime transitório. O código usa o limite antigo (máx. 70 000 €); fontes 2026 apontam máx. ~1 000 €. **Sinalizado — não alterado sem aval da Sandrine.**

## Eixo 2 — Completude
- Cobertura quase total do Modelo 22 (apuramento, matéria coletável, prejuízos com limite 65%/75%, deduções à coleta, TA, derramas, PEC/PC, retenções). Excelente.

## Eixo 3 — Fidelidade
- ✅ Motor numa lib pura → **testável**. Criados 10 casos golden (`src/lib/previsa.test.ts`): coleta PME/geral, derrama estadual por escalões, TA de viaturas (convencional/elétrico/agravamento). Todos passam.

## Eixo 4 — Minimalismo de inputs
- Muitos campos — inerente ao Modelo 22. Já tem toggle RAI calculado a partir da demonstração de resultados (SAF-T). Oportunidade: importar viaturas e rubricas do SAF-T. (Fase 2.)

## Eixo 5 — Funcional / mobile
- Mobile: sem transbordo a 360px (verificado). As tabelas de acréscimos/deduções são densas mas não saem do ecrã.

## Eixo 6 — Sincronia do AI Contabilista
- KB tinha as chaves **reais** (ao contrário do Fiscal) mas incompleta — acrescentado isPME/isStartup/taxaDerramaMunicipal/viaturas/ta_*, o método e a ressalva do PEC.

## Fase 1 — implementado agora
1. 10 casos-teste golden (partes estáveis do motor).
2. KB completado + ressalva do PEC.
3. Sinalizações para a Sandrine (PEC, taxas IRC/regionais, derramas, PC, TA).

## Fase 2 — a validar
1. **Confirmar/atualizar o PEC** (limite 2026) com a Sandrine — provavelmente reduzir o teto.
2. Confirmar todas as taxas com a Sandrine.
3. Importar viaturas e rubricas do SAF-T.
