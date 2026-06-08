# Auditoria — Simulador de Viaturas

Data: 2026-06-08 · Estado: Fase 1 (KB + flags). Sem alterações ao cálculo. Engine + testes = Fase 2.

## Resumo
Modelo bom e coerente: IVA dedutível por tipo de motor/atividade (CIVA art.21), limites de depreciação fiscal, Tributação Autónoma de ligeiros de passageiros (CIRC art.88, mesmos escalões do Previsa). **Sem erros de cálculo aparentes.** Limitação técnica: o motor vive **inline no componente** (não é lib), por isso ainda **não é testável** — extrair na Fase 2.

## Eixo 1 — Cobertura legal (2026)
- IVA aquisição/manutenção/combustível por motor e atividade; limites de depreciação (25/37,5/50/62,5k); TA por escalões. ⚠ Valores a confirmar — ver `AUDITORIA-FISCAL-PENDENTE.md`.

## Eixo 2 — Completude
- Cobre passageiros vs comercial, motores (diesel/gasolina/híbrido/PHEV/elétrico/GPL/GNV), atividades isentas (táxi, rent-a-car, escola de condução).
- ❌ Não modela o **agravamento de +10 p.p. da TA quando a empresa tem prejuízo** (o Previsa modela). Sinalizado.

## Eixo 3 — Fidelidade
- ⚠ Motor **inline** (não lib) → não testável sem extração. Proposta Fase 2: extrair para `src/lib/viaturas.ts` + casos golden. (A TA já tem cobertura indireta via `previsa.test.ts`, que usa os mesmos escalões.)

## Eixo 4 — Minimalismo de inputs
- Inputs adequados. Nada a remover.

## Eixo 5 — Funcional / mobile
- Mobile: sem transbordo a 360px. ✅

## Eixo 6 — Sincronia do AI Contabilista
- KB tinha as chaves reais; acrescentado o método (IVA, limites, TA, seguro isento, nota do agravamento).

## Fase 1 — implementado agora (sem mudar cálculo)
1. KB com método.
2. Sinalizações internamente.

## Fase 2 — a fazer/validar
1. Extrair o motor para `src/lib/viaturas.ts` + casos golden.
2. Modelar o agravamento +10 p.p. da TA com prejuízo (opcional, com input de prejuízo).
3. Confirmar valores com um contabilista.
