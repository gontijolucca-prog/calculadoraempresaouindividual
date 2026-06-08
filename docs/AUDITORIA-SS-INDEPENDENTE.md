# Auditoria — Simulador de SS Independente (selfss)

Data: 2026-06-08 · Estado: Fase 1 implementada (teto 12×IAS + testes + KB); restantes casos sinalizados.

## Resumo
É das ferramentas mais sãs: já se assume **estimativa** (nota amarela + dicas honestas) e o cálculo do caso comum está correto. A única lacuna de correção real era a **falta do teto da base de incidência (12 × IAS)** — quem ganhasse muito contribuía a mais. Corrigido.

## Eixo 1 — Cobertura legal (2026)
- Taxa 21,4%, base 70% (serviços) / 20% (bens), mínimo 20 €/mês, isenção 1.º ano (Art. 164.º). Tudo presente. ⚠ Valores a confirmar — ver `AUDITORIA-FISCAL-PENDENTE.md`.
- **Teto da base = 12 × IAS/mês** (6 445,56 € em 2026): **estava em falta**, agora implementado (`Math.min(base, 12×IAS)`). Confirmado por pesquisa (seg-social.pt / guia prático do novo regime).

## Eixo 2 — Completude
- ✅ Caso comum (serviços/bens, mínimo, isenção 1.º ano), agora + teto.
- ❌ Não modelado (a decidir): ajuste da base ±25%; acumulação trabalho dependente+independente (isenção se salário ≥ 4×IAS); contribuição da entidade contratante. Sinalizado.

## Eixo 3 — Fidelidade
- A ferramenta já avisa que a SS apura a base trimestralmente pela média dos 3 meses anteriores. Honesto. Casos golden criados (`src/lib/selfss.test.ts`, 12 asserções), incl. o teto.

## Eixo 4 — Minimalismo de inputs
- Inputs mínimos (rendimento, tipo, 1.º ano). ✅
- `regime` ('general'/'simplified') existe no estado mas **não tem controlo na UI nem é usado** — vestigial; remover na limpeza (Fase 2).
- Pré-preenchível do Perfil: `tipoRendimento` (de atividade), `primeiroAno`. (Fase 2.)

## Eixo 5 — Funcional / mobile
- Mobile: sem transbordo a 360px. ✅
- UI: acrescentado o teto às "REGRAS 2026" e um indicador "teto 12×IAS" no detalhe quando aplicável.

## Eixo 6 — Sincronia do AI Contabilista
- ✅ Corrigido erro no KB: o campo era descrito como "receita anual" mas é **rendimento MENSAL** (o motor faz mensal×12). Sem isto, o bot preenchia a ordem de grandeza errada. Adicionado o método (base, teto, taxa, mínimo, trimestral, estimativa).

## Fase 1 — implementado agora
1. **Teto da base 12 × IAS** no motor (`calcSelfSSContribution`) + flag `baseLimitada`.
2. Casos-teste golden (12).
3. UI: teto nas regras + indicador quando limitado.
4. KB corrigido (mensal, não anual) + método.
5. Sinalizações para a Sandrine.

## Fase 2 — a decidir/validar
1. Ajuste da base ±25%, acumulação TCO+TI, entidade contratante.
2. Remover `regime` vestigial.
3. Pré-preenchimento do Perfil.
4. Confirmar valores com a Sandrine.
