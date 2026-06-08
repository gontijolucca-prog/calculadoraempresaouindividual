# Auditoria — Imóveis na Empresa

Data: 2026-06-08 · Estado: Fase 1 (KB método + flags). Sem alterações ao cálculo.

## Resumo
Guia de decisão **arrendar vs entrada em espécie**. Reutiliza o motor IMT (bom) + Imposto de Selo 0,8%. O resto são pressupostos heurísticos (yield 4%, depreciação 2%, escritura 0,7%) e um score de recomendação. Não é um cálculo fiscal definitivo.

## Eixo 1 — Cobertura
- IMT (via motor IMT) + Selo 0,8% na entrada em espécie. ⚠ Usa sempre "urbano outros" (6,5%) — confirmar para habitação. Pressupostos a confirmar — ver `AUDITORIA-FISCAL-PENDENTE.md`.

## Eixo 2 — Completude
- Cobre os fatores de decisão principais (horizonte, liquidez, reforço de CE, ENI vs sociedade). ✅

## Eixo 3 — Fidelidade
- Parte fiscal (IMT/Selo) reutiliza `calcIMT` (já testado). Os pressupostos são estimativas assumidas — bem assinaladas como tal.

## Eixo 4 — Minimalismo
- Inputs adequados. ✅

## Eixo 5 — Funcional / mobile
- Mobile: sem transbordo a 360px. ✅

## Eixo 6 — Sincronia do AI Contabilista
- KB com chaves reais; acrescentado o método e os pressupostos.

## Fase 1 — implementado agora
1. KB com método + pressupostos.
2. Flags (IMT por tipo de uso; yield/depreciação/escritura).

## Fase 2 — a validar
1. Confirmar se a entrada em espécie de habitação usa escalões de habitação no IMT.
2. Confirmar os pressupostos (yield/depreciação/escritura) com um contabilista.
