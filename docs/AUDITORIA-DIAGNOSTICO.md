# Auditoria — Diagnóstico de Autonomia

Data: 2026-06-08 · Estado: Fase 1 (KB método). Ferramenta limpa, sem alterações ao cálculo.

## Resumo
**Não é um cálculo fiscal** — é um diagnóstico de saúde financeira/gestão por 5 pilares (rácios standard). Lógica sólida e defensável; sem números fiscais a sinalizar.

## Eixo 1 — Cobertura
- Rácios padrão: autonomia financeira, endividamento, liquidez corrente, meses de tesouraria, margem líquida, EBITDA, concentração de cliente, dependência de financiamento, maturidade operacional. Limiares razoáveis.

## Eixo 2 — Completude
- 5 pilares cobrem bem a solidez da empresa. ✅

## Eixo 3 — Fidelidade
- `calcScores` é função pura. Os limiares são heurísticos (não lei), por isso não se criam casos golden fiscais; o comportamento é determinístico e simples.

## Eixo 4 — Minimalismo
- Campos financeiros pré-preenchíveis do SAF-T / Perfil (capitais próprios, ativo, passivo, volume de negócios, resultado). Já há ligação parcial ao Perfil. (Fase 2.)

## Eixo 5 — Funcional / mobile
- Mobile: sem transbordo a 360px. ✅ (usa grid-cols-2 denso mas cabe.)

## Eixo 6 — Sincronia do AI Contabilista
- KB já tinha as chaves reais e completas. Acrescentado o **método de pontuação** para o bot poder explicar o score.

## Fase 1 — implementado agora
1. KB com o método de pontuação dos 5 pilares.

## Fase 2 — opcional
1. Pré-preencher os campos financeiros a partir do SAF-T.
