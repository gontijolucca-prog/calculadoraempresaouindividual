# Auditoria — Simulador de Tickets / Benefícios

Data: 2026-06-08 · Estado: Fase 1 (KB + flags). Sem alterações ao cálculo.

## Resumo
Cobre subsídio de refeição (cartão/dinheiro), creches/infância, educação, saúde, ofertas e Ticket Car. Usa as constantes de `pt2026.ts`. Coerente. Um ponto a confirmar: o **fator de dedutibilidade IRC do subsídio de refeição (60%)** parece subavaliar.

## Eixo 1 — Cobertura legal (2026)
- Limites isenção (cartão 10,46 / dinheiro 6,15), poupança SS (23,75% + 11%), majoração creches 40%, IVA Ticket Car. ⚠ A confirmar — ver `AUDITORIA-FISCAL-PENDENTE.md`.

## Eixo 2 — Completude
- Cobre os tipos principais de benefício. ✅

## Eixo 3 — Fidelidade
- Motor inline (usa constantes de `pt2026.ts`, que já têm cobertura parcial via `salario.test.ts` para os limites). Extração + testes próprios = Fase 2 (baixa prioridade — ferramenta simples).

## Eixo 4 — Minimalismo
- Inputs adequados ao tipo de ticket. ✅

## Eixo 5 — Funcional / mobile
- Mobile: sem transbordo a 360px. ✅

## Eixo 6 — Sincronia do AI Contabilista
- KB com chaves reais; acrescentado o método + a ressalva do fator IRC 60%.

## Fase 1 — implementado agora (sem mudar cálculo)
1. KB com método.
2. Sinalizações internamente (limites, fator IRC 60%, majoração, IVA Car).

## Fase 2 — a validar
1. Confirmar o fator de dedutibilidade IRC do subsídio de refeição.
2. (Opcional) extrair o cálculo para lib + golden tests.
