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

## Fase 2 — IMPLEMENTADA e LIVE (08-jun, luz verde do Lucca)
Construída com as taxas estabelecidas (nunca inventadas); as nuances continuam sinalizadas para a Sandrine validar/afinar depois.
1. **Pré-preenchimento do Perfil** — IRS passa a arrancar com tributação conjunta (casados) + dependentes; restantes simuladores já o faziam.
2. **Salário — estado civil** ligado (quociente conjugal para casado 1 titular).
3. **Fiscal — motor extraído** para `lib/fiscal.ts` (testável) + **derrama municipal** (campo) + **hipótese de dividendos** (−28%).
4. **Viaturas — motor extraído** para `lib/viaturas.ts` + **agravamento TA** (+10 p.p. com prejuízo).
5. **IRS — anexos E/F/G**: capitais/prediais 28% ou englobamento; mais-valias mobiliárias 28% / imobiliárias 50% englobado.
Testes golden agora em 8 suites (irs, salario, selfss, previsa, imt, honorarios, fiscal, viaturas), todas verdes.

### Ainda por fazer (precisa da Sandrine ou de ação do Lucca)
- **Regras Firestore do `ai_suggestions`**: já estão corretas no repo (`firestore.rules`), mas a **publicação na base de dados live tem de ser feita pelo Lucca** (Firebase Console ou `firebase deploy --only firestore:rules`) — é alteração de controlo de acesso, não a faço sozinho.
- **Reconciliar divergência git** local↔remoto (cosmética; o push via API cria commits paralelos com conteúdo idêntico).
- **Nuances fiscais** dos anexos (rendas longas, reinvestimento HPP, anexos C/H-PPR/donativos) e a **discrepância TA Previsa (×1,1) vs Viaturas (+10 p.p.)** — reconciliar com a Sandrine.

## Backlog original Fase 2 (mantido como referência; o essencial acima já foi feito)
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
