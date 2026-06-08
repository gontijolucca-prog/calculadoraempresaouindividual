# Auditoria — Simulador de IRS (Modelo 3)

Data: 2026-06-08 · Estado: Fase 1 implementada, Fase 2 planeada (a aguardar validação fiscal)

## Resumo
O motor (`src/lib/irs.ts`) está bem construído e cita os artigos do CIRS. Modela corretamente, para os casos cobertos, os escalões 2026, a dedução específica, o IRS Jovem, o mínimo de existência, as deduções à coleta, o benefício municipal, a taxa adicional de solidariedade e o quociente conjugal. 5 casos-teste golden (`src/lib/irs.test.ts`), com valores calculados à mão, confirmam a lógica. **O problema não é a correção do que existe — é a completude (anexos em falta) e alguns rótulos/textos errados na UI.**

## Eixo 1 — Cobertura legal
Modelado: Cat. A (trabalho dependente), Cat. B simplificada (4 coeficientes), deduções à coleta, IRS Jovem, mínimo de existência, solidariedade, benefício municipal por concelho.
⚠ Todos os **valores numéricos de 2026** precisam de confirmação da Sandrine — ver `AUDITORIA-FISCAL-PENDENTE.md`.

## Eixo 2 — Completude (cobertura de TODOS os anexos do Modelo 3)

Checklist completa dos anexos da declaração de IRS (nenhum pode faltar):

| Anexo | O que cobre | Estado atual |
|-------|-------------|--------------|
| **A** | Trabalho dependente e pensões | ✅ Modelado (rend. trabalho + retenção + contribuições) |
| **B** | Cat. B — regime simplificado | 🟡 Parcial (só 4 coeficientes; faltam 0,10 / 0,50 / 0,95 e a regra da majoração/justificação de despesas) |
| **C** | Cat. B — contabilidade organizada | ❌ Em falta |
| **D** | Transparência fiscal / imputação de rendimentos | ❌ Em falta |
| **E** | Rendimentos de capitais (juros, dividendos) | ❌ Em falta (englobamento opcional vs 28% liberatória) |
| **F** | Rendimentos prediais (rendas) | ❌ Em falta (28% autónoma ou englobamento; taxas reduzidas por duração do contrato) |
| **G** | Mais-valias (imobiliárias 50% englobado c/ exclusão por reinvestimento HPP; mobiliárias 28%) e **G1** (não tributadas) | ❌ Em falta |
| **H** | Benefícios fiscais e deduções à coleta (PPR — EBF art. 21.º; donativos/mecenato; deduções à coleta) | 🟡 Parcial (deduções à coleta saúde/educação/habitação/lares/gerais/dependentes/pensões modeladas; **faltam PPR, donativos e restantes benefícios**) |
| **I** | Herança indivisa (rendimentos) | ❌ Em falta |
| **J** | Rendimentos obtidos no estrangeiro | ❌ Em falta (crédito de imposto / dupla tributação) |
| **L** | Residente Não Habitual / IFICI | ❌ Em falta |
| **SS** | Anexo SS — Segurança Social (atividade independente) | ❌ Em falta (relevante para a folha de cálculo da SS Independente) |

Outros pontos de completude:
- **Toggle de englobamento** por categoria — em falta (afeta E/F/G).
- Dependentes com idade **4–6 anos** (regra OE 2026 do 2.º+ filho) — o motor só distingue ≤3a.
- **SP A e B**: JÁ funciona (botão "Adicionar Sujeito Passivo B"). A queixa estava resolvida; tornámos o rótulo mais claro.

Prioridade sugerida para a Fase 2 (do mais comum ao mais raro): **H** (PPR/donativos) e **B/C** completos → **F** (prediais) e **E** (capitais) → **G** (mais-valias) → **D/I/J/L** (nicho).

### Confirmação por pesquisa (2026-06-08)
Pesquisa às fontes oficiais e da especialidade confirma que a lista acima é **exaustiva** — o Modelo 3 tem exatamente os anexos A, B, C, D, E, F, G, G1, H, I, J, L e SS. Não existe mais nenhum anexo. Notas:
- **Anexo L** cobre agora **RNH e IFICI** (novas instruções pela Portaria 72-B/2025).
- **IRS Jovem 2026**: limite de isenção ≈ 29 500 € — coincide com a constante do motor (29 542,15 €). ✅
- **Cripto-ativos** não são um anexo novo; distribuem-se pelos existentes: **G** (mais-valias <365 dias), **G1** (≥365 dias, isentas mas declaráveis), **J** (plataforma sem residência em PT), **B** (atividade económica/mineração), **E** (rendimentos de capitais, ex.: staking). Ao construir estes anexos na Fase 2, incluir campos para cripto.

Fontes: Portal das Finanças (Modelo 3 / anexos), ComparaJá ("Declaração IRS 2026: todos os anexos explicados"), OCC (anexo L / IFICI), Finbooks/ECO/Doutor Finanças (cripto-ativos 2026).

## Eixo 3 — Fidelidade
Sem casos de referência oficiais ainda. Criados 5 casos golden hand-computed (regressão). Para certificar fidedignidade total à liquidação da AT, precisamos de casos validados pela Sandrine ou pelo simulador oficial.

## Eixo 4 — Minimalismo de inputs
- O IRS é rendimento pessoal; o SAF-T (contabilidade da empresa) dá pouco.
- **Oportunidade**: pré-preencher do Perfil do Cliente — `dependentes`, `cenario` (de estadoCivil), `regiao` (da morada), ano de IRS Jovem (de idade + beneficioJovem). Hoje não há pré-preenchimento. (Fase 2.)

## Eixo 5 — Funcional (corrigido na Fase 1)
- ✅ Selector "Tabela de escalões" estava partido (valor por defeito `oficial2026` não existia nas opções) — **removido** (o motor é sempre 2026).
- ✅ Reduções regionais com rótulos errados ("Açores −30% / Madeira −23,5%" vs motor 0,80/0,70) — **rótulos neutralizados** + sinalizado para validação.
- ✅ Textos desatualizados: habitação "700€"→"900€", contribuições "4 462,15€"→"4 587,09€", rodapé "2025"→"2026".
- ✅ "PPR / pensões" alimentava as pensões de alimentos — **renomeado** para "Pensões de alimentos"; PPR real fica para Fase 2.

## Eixo 6 — Sincronia do AI Contabilista
✅ `functions/_kb.ts` atualizado com as **chaves reais** do IRS (as anteriores estavam inventadas) e nota de que os anexos E/F/G/C estão em Fase 2.

## Plano Fase 2 (a aguardar aprovação + validação fiscal)
Cobrir **todos** os anexos em falta, por ondas de prioridade:
1. **Anexo H** completo — PPR (EBF art. 21.º), donativos/mecenato, restantes benefícios fiscais.
2. **Anexo B** completo (todos os coeficientes + majoração) e **Anexo C** (contabilidade organizada).
3. **Anexo F** (prediais) e **Anexo E** (capitais), com toggle de englobamento.
4. **Anexo G/G1** (mais-valias imobiliárias e mobiliárias).
5. **Anexos D, I, J, L, SS** (transparência, herança indivisa, estrangeiro, RNH/IFICI, SS).
6. Campo dependentes 4–6 anos.
7. Pré-preenchimento a partir do Perfil do Cliente.
8. Casos golden por anexo, validados pela Sandrine.
