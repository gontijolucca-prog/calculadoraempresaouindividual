# Sinalizações fiscais a confirmar (Sandrine)

Lista de valores e regras que o simulador usa e que **precisam de confirmação profissional** antes de os afirmarmos como certos. Nenhum destes foi inventado pela auditoria — vêm do código existente; só não temos fonte oficial confirmada. Marcar ✅ quando validado.

## IRS (2026) — `src/lib/irs.ts`
- [ ] **IAS 2026 = 537,13 €** (Portaria 480-A/2025?) e **SMN 2026 = 920 €** (DL 139/2025?).
- [ ] **Escalões 2026** (9 escalões: limites e taxas 12,5% → 48%, e parcelas a abater). Confirmar tabela completa.
- [ ] **Dedução específica Cat. A = 4 587,09 €** (8,54 × IAS).
- [ ] **Mínimo de existência = 14 × SMN = 12 880 €**.
- [ ] **Limite de isenção IRS Jovem = 55 × IAS = 29 542,15 €** e o calendário de isenção (ano 1 = 100%; 2–4 = 75%; 5–7 = 50%; 8–10 = 25%).
- [ ] **Tetos das deduções à coleta 2026**: Saúde 15%/1 000 €; Educação 30%/800 €; Habitação (rendas HPP) 15%/**900 €**; Lares 25%/403,75 €; Pensões de alimentos 20%/419,22 €; Gerais 35%/250 € (500 € conjunto; 45%/335 € monoparental).
- [ ] **Dedução por dependente**: 600 € (>3a); 726 € (1.º ≤3a); 900 € (2.º+ ≤3a, e ≤6a por extensão OE 2026).
- [ ] **Reduções regionais**: motor usa Açores ×0,80 (−20%) e Madeira ×0,70 (−30%). **Confirmar as percentagens corretas e a quais escalões/categorias se aplicam** (os rótulos da UI estavam inconsistentes — foram neutralizados a aguardar isto).
- [ ] **Taxa adicional de solidariedade**: 2,5% entre 80 000 € e 250 000 €; 5% acima.
- [ ] **Benefício municipal por concelho** (`MUNICIPIOS_BM`): confirmar a tabela de devolução de IRS por câmara para o ano em causa (Portal das Finanças).

## Salário Líquido (2026) — `src/lib/salario.ts` + `src/lib/pt2026.ts`
- [ ] **Tabelas oficiais de retenção na fonte 2026** (Despacho) — por estado civil (solteiro / casado 1 titular / casado 2 titulares), nº de titulares, nº de dependentes e região (Continente / Madeira / Açores). **É o que falta para a retenção mensal ser fiel ao recibo.** Hoje o motor usa a liquidação anual dos escalões ÷ nº de pagamentos (estimativa).
- [ ] **Região JÁ ligada** (08-jun) com o fator do simulador de IRS — Açores ×0,80, Madeira ×0,70 sobre a coleta. **Confirmar estas percentagens** (são as mesmas já sinalizadas no bloco IRS). **Estado civil** continua sem efeito — fica para a Fase 2 com as tabelas oficiais.
- [ ] **Subsídios de férias e de Natal** — regra de tributação própria (taxa da remuneração mensal, em separado). Hoje só há o interruptor "duodécimos".
- [ ] **SS trabalhador 11% / SS patronal 23,75%** — confirmar (e 22,3% para entidades sem fins lucrativos).
- [ ] **Limites do subsídio de alimentação 2026**: cartão **10,46 €**/dia, dinheiro **6,15 €**/dia ("Despacho 233-A/2026"). Confirmar (2025: 10,20 / 6,00).
- [ ] **Seguro de acidentes de trabalho** — taxa default 1% (varia por atividade); confirmar se deve ser editável/obrigatório.

## SS Independente (2026) — `calcSelfSSContribution` em `src/lib/pt2026.ts`
- [ ] **Taxa 21,4%** (`SS_RATE_SELF_EMPLOYED`) — confirmar.
- [ ] **Base de incidência**: 70% prestação de serviços / 20% venda de bens — confirmar coeficientes.
- [ ] **Teto da base = 12 × IAS/mês** (6 445,56 € em 2026) — **implementado agora** (08-jun); confirmar a regra e o valor (depende do IAS, já sinalizado).
- [ ] **Mínimo de 20 €/mês** — confirmar o valor exato 2026 e a condição (o código aplica sempre; a dica diz "se rendimento > IAS"). Esclarecer a regra para rendimentos muito baixos.
- [ ] **Isenção 1.º ano** (Art. 164.º CRCSPSS) — confirmar âmbito/duração (12 meses).
- [ ] **Não modelado** (a decidir se entra): opção de ajuste da base ±25%; acumulação com trabalho dependente (isenção se salário ≥ 4×IAS); contribuição da entidade contratante (>50% do rendimento de um só cliente).

## Fiscal ENI vs Lda (2026) — `src/TaxSimulator.tsx`
- [ ] **Derrama municipal ausente** no lado da Lda (até 1,5% sobre o lucro tributável, varia por município). O Previsa já a modela; o comparador não. Decidir: somar (com taxa do perfil/concelho) ou manter simplificado + nota.
- [ ] **Retenção na fonte ENI serviços = 11,5%** (só informativa, não entra no líquido). Confirmar — muitas profissões do art.151.º retêm 25%.
- [ ] **Comparação Lda não subtrai os 28% de dividendos** no líquido do vencedor (assume lucro retido na empresa; divulgado em nota). Avaliar mostrar as duas hipóteses (retido vs distribuído).
- [ ] **PPC = 25% do IRS** — aproximação; confirmar regra dos pagamentos por conta Cat. B.
- [ ] **Limiar justificação 15% (art.31 n.13) = 27 360 €** (valor 2025 mantido) — confirmar valor 2026.
- [ ] **IRC PME 15%/19%** e **dedução específica Cat A 8,54×IAS** — confirmar (já no bloco IRS).

## Previsa / IRC Modelo 22 (2026) — `src/lib/previsaCalc.ts`
- [ ] **PEC (Pagamento Especial por Conta)**: o art.93.º CIRC foi **revogado** (Lei 12/2022) mas mantém-se em regime transitório. **Confirmar se ainda se aplica em 2026 e qual o limite máximo** — o código usa máx. 70 000 € (fórmula antiga); fontes de 2026 indicam máx. ~1 000 €. Mínimo 850 € parece manter-se. **Não alterar sem confirmação.**
- [ ] **Taxas IRC 2026**: geral **19%** (baixou de 20%), PME **15%** nos primeiros 50k. Regionais: Madeira 13,3%/10,5%, Açores 15,2%/8,75%, interioridade 12,5% (PME), startup 12,5%. Confirmar todas.
- [ ] **Derrama estadual** (art.87-A): 0/3/5/9% nos escalões 1,5M/7,5M/35M; Açores ×0,80. Confirmar.
- [ ] **Pagamentos por Conta (PC)**: 2,5/4,5/8,5% (continental). Confirmar.
- [ ] **Tributações autónomas** (art.88): escalões de viaturas (8/25/32%), elétrico 0% (10% acima de 62 500 €), e taxas de despesas (não documentadas 50/70%, representação 10%, ajudas de custo 5%, lucros distribuídos 23%, offshores/indemnizações/bónus 35%); agravamento ×1,1 com prejuízo. Confirmar.

## IMT + Imposto de Selo (2026) — `src/lib/imt.ts`
- [ ] **Escalões CIMT 2026** (HPP e habitação secundária — limites e deduções; atualizam anualmente). Confirmar a tabela completa.
- [ ] **IMT Jovem** (art.11-A): limite de isenção (330 539 €) e de redução (660 982 €), e a **fórmula da redução parcial** (código: IMT(valor) − IMT(limite isenção)). Confirmar.
- [ ] **Taxas planas**: rústico 5%, urbano outros fins 6,5%. Confirmar.
- [ ] **Imposto de Selo 0,8%** (TGIS 1.1) — confirmar.
- [ ] **Multiplicador regional 1,25** (Madeira/Açores) — confirmar.

## Viaturas (2026) — `src/VehicleSimulator.tsx`
- [ ] **IVA dedutível por motor/atividade** (CIVA art.21): elétrico ≤62,5k 100%; PHEV compliant ≤50k 100%; GPL/GNV ≤37,5k 50% (passageiros); comercial diesel 50%, restantes 100%; combustível gasóleo/GPL/GNV 50%, elétrico 100%, gasolina 0%. Confirmar.
- [ ] **Limites de depreciação fiscal**: 25k / 37,5k / 50k / 62,5k. Confirmar (Portaria).
- [ ] **TA ligeiros de passageiros** (CIRC art.88): 8/25/32% (conv), 2,5/7,5/15% (PHEV), 0% e 10%>62,5k (elétrico); escalões 37,5k/45k. Confirmar. **Não modela o agravamento +10 p.p. com prejuízo.**

## Tickets / Subsídio de refeição (2026) — `src/TicketSimulator.tsx` + `pt2026.ts`
- [ ] **Limites diários** cartão 10,46 € / dinheiro 6,15 € (já no bloco Salário). Confirmar.
- [ ] **Fator de dedutibilidade IRC do subsídio de refeição = 60%** (`TICKET_IRC_FACTOR.restaurante`) — parece subavaliar (é gasto com pessoal, ~100% dedutível). Confirmar.
- [ ] **Majoração IRC 40%** para creches/infância (art.43 n.9). Confirmar.
- [ ] **IVA Ticket Car** 50% (misto) / 100% (comercial). Confirmar.

## Imóveis na Empresa (2026) — `src/ImoveisEmpresa.tsx`
- [ ] **IMT na entrada em espécie usa sempre "urbano outros" (6,5%)**, independente do `tipoUso`. Confirmar se habitação deveria usar os escalões de habitação.
- [ ] Pressupostos (estimativas, não lei): **yield 4%/ano**, **depreciação 2%/ano**, **escritura ~0,7%**. Confirmar se servem como defaults.

## (a preencher à medida que auditamos as outras ferramentas)
- [ ] SS Independente — base de incidência, percentagem, isenções.
- [ ] IMT / Imposto do Selo — escalões e isenções.
- [ ] IRC / Previsa — taxas, derrama, tributações autónomas.
- [ ] Viaturas — tabela do imposto de circulação, tributação autónoma.
- [ ] Tickets — limites do subsídio de refeição (cartão vs dinheiro).
