# Sinalizações fiscais a confirmar (a confirmar)

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
- [x] **Derrama municipal** — IMPLEMENTADA (08-jun): campo `taxaDerramaMunicipal` (default 0) sobre o lucro. **Confirmar a taxa de cada concelho** (até 1,5%).
- [ ] **Retenção na fonte ENI serviços = 11,5%** (só informativa, não entra no líquido). Confirmar — muitas profissões do art.151.º retêm 25%.
- [x] **Dividendos −28%** — IMPLEMENTADO (08-jun): mostra líquido com lucro retido E distribuído. Confirmar a taxa (28% liberatória art.71).
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
- [ ] **TA ligeiros de passageiros** (CIRC art.88): 8/25/32% (conv), 2,5/7,5/15% (PHEV), 0% e 10%>62,5k (elétrico); escalões 37,5k/45k. Confirmar.
- [x] **Agravamento TA com prejuízo** — IMPLEMENTADO no simulador de Viaturas como **+10 p.p.** (CIRC art.88 n.14). ⚠ **DISCREPÂNCIA**: o Previsa aplica `×1,1` (10% sobre o valor) em vez de +10 p.p. à taxa. Reconciliar com um contabilista qual é o correto e alinhar os dois (não alterei o Previsa, que é o motor validado).

## Tickets / Subsídio de refeição (2026) — `src/TicketSimulator.tsx` + `pt2026.ts`
- [ ] **Limites diários** cartão 10,46 € / dinheiro 6,15 € (já no bloco Salário). Confirmar.
- [ ] **Fator de dedutibilidade IRC do subsídio de refeição = 60%** (`TICKET_IRC_FACTOR.restaurante`) — parece subavaliar (é gasto com pessoal, ~100% dedutível). Confirmar.
- [ ] **Majoração IRC 40%** para creches/infância (art.43 n.9). Confirmar.
- [ ] **IVA Ticket Car** 50% (misto) / 100% (comercial). Confirmar.

## Imóveis na Empresa (2026) — `src/ImoveisEmpresa.tsx`
- [ ] **IMT na entrada em espécie usa sempre "urbano outros" (6,5%)**, independente do `tipoUso`. Confirmar se habitação deveria usar os escalões de habitação.
- [ ] Pressupostos (estimativas, não lei): **yield 4%/ano**, **depreciação 2%/ano**, **escritura ~0,7%**. Confirmar se servem como defaults.

## IRS anexos E/F/G (2026) — IMPLEMENTADOS na Fase 2 — `src/lib/irs.ts`
- [x] **Capitais (E)** 28% liberatória ou englobamento; **Prediais (F)** 28% ou englobamento; **Mais-valias mobiliárias (G)** 28%; **Mais-valias imobiliárias (G)** 50% do ganho englobado. Taxas-base estabelecidas.
- [ ] **Nuances a validar/implementar**: taxas reduzidas dos prediais por duração do contrato (25%/15%/10%); exclusão de mais-valias por reinvestimento na HPP; 50% dos dividendos no englobamento (art.40-A); anexos **C** (contabilidade organizada), **H** (PPR/donativos) e restantes. Confirmar com um contabilista.

## IRS Anexo B / Categoria B (2026) — IMPLEMENTADO 08-jun (valores-base; a um contabilista valida)
Confirmação ferramenta-a-ferramenta do Anexo B (rendimentos empresariais e profissionais). Antes, o simulador só fazia `rendimento × coeficiente`. **Agora o motor (`src/lib/irs.ts`) modela o Anexo B a sério** — com os pontos abaixo implementados com **valores-base estabelecidos** e **casos-teste golden** (irs.test.ts J–N). **As taxas/limiares mudam resultados e continuam a precisar do aval de um contabilista.**

**Perguntas urgentes (valores-base já no motor — confirmar/afinar):**
- [x] **Regra dos 15% (art. 31.º n.13/14 CIRS):** IMPLEMENTADA igual ao motor Fiscal (`fiscal.ts`): para os coeficientes 0,75/0,35 e rendimento bruto > 27 360 €, exige-se justificar 15% do rendimento; justificado = despesas documentadas (`despesasCatB`) + dedução específica automática (4 587,09 €); a parte não justificada **acresce** ao coletável. **Confirmar:** (a) a fórmula exata 2026; (b) o **limiar** (2025 = **27 360 €** — mantém-se?); (c) que despesas contam como justificação.
- [~] **Dedução das contribuições para a SS na Cat. B:** NÃO modelada como dedução separada (em regime simplificado, o coeficiente já presume os custos e a SS só conta para a justificação dos 15%, coerente com `fiscal.ts`). **Confirmar** se em 2026 deve haver dedução autónoma das contribuições e com que limite.
- [x] **IRS Jovem (art. 12.º-B) na Cat. B:** IMPLEMENTADO — a isenção passa a abranger Cat. A **e** Cat. B (limite 55×IAS = 29 542,15 € sobre a soma A+B do sujeito passivo). **Confirmar** que o IRS Jovem se aplica mesmo aos rendimentos da Cat. B.
- [ ] **Caso raro — prejuízo na Cat. B organizada + IRS Jovem em simultâneo:** quando há prejuízo (lucro organizado negativo) e IRS Jovem ao mesmo tempo, o prejuízo reduz o rendimento global E a isenção (calculada sobre a Cat. A) também reduz — podem somar-se e sub-tributar. A isenção é calculada sobre a parte positiva (`max(0, Cat. B)`), o que ignora o prejuízo no cálculo da isenção mas deixa-o reduzir o global. **Confirmar** o tratamento correto da interação prejuízo × IRS Jovem (não modelado de forma especial; só afeta este caso raro).
- [ ] **Mínimo de existência (art. 70.º) no ENI puro:** o motor aplica os 14×SMN = 12 880 € ao rendimento global (inclui Cat. B coletável). **Confirmar** a regra própria do ENI puro (não diferenciada no motor).
- [ ] **Interação mínimo de existência × IRS Jovem (pré-existente, não introduzida pelo Anexo B):** o teste do mínimo usa o rendimento global JÁ líquido da parcela isenta do IRS Jovem. Para rendimentos altos com grande isenção, o global líquido cai abaixo de 12 880 € e o imposto é zerado, mesmo havendo coletável residual. Comporta-se igual na Cat. A e na Cat. B (consistente). **Confirmar** se o mínimo deve usar o rendimento antes ou depois da isenção do IRS Jovem — não alterado por ser regra já validada.

**Perguntas importantes:**
- [x] **Contabilidade organizada (Anexo C):** IMPLEMENTADO — seletor de regime por sujeito passivo (simplificado/organizado); no organizado usa o **lucro tributável** (`lucroCatBOrganizado`) em vez de coeficiente. **Confirmar** o limiar de obrigatoriedade (volume de negócios) e o tratamento de despesas/depreciações/provisões (hoje o utilizador insere o lucro já apurado).
- [x] **Coeficientes:** dropdown alargado para 0,75 / 0,35 / 0,15 / **0,95** / **0,10** / 1,00. **Confirmar** os valores e descrições 2026 (sobretudo 0,95 e 0,10).
- [ ] **Anexo F (prediais) — taxas por duração do contrato:** 25% (2–8 anos) / 15% (8–30) / 10% (>30), em vez dos 28% lineares atuais. AINDA NÃO implementado. **Confirmar** que se mantêm em 2026.

Legenda: [x] implementado com valor-base (a validar) · [~] decisão tomada (não modelar já) · [ ] por fazer.

**Sem fonte confirmada para 2026:** todos os coeficientes e regras acima foram dados pela auditoria como **INCERTOS** (só o Anexo A — trabalho dependente — ficou com fonte confirmada). Não afirmar nenhum como final sem o aval de um contabilista.

## Cobertura por anexo do Modelo 3 (08-jun) — para referência
| Anexo | Estado | Falta (resumo) |
|-------|--------|----------------|
| A (trabalho/pensões) | ✅ | — |
| B (Cat. B simplificado) | ⚠ parcial | regra 15%, SS Cat. B, IRS Jovem Cat. B, mín. existência ENI, coeficientes extra |
| C (contab. organizada) | ❌ | lucro real, toggle de regime |
| D (transparência/heranças) | ❌ | nicho |
| E (capitais) | ⚠ | base 28%/englob. ok; isenções especiais por fazer |
| F (prediais) | ⚠ | falta taxas por duração + despesas dedutíveis |
| G (mais-valias) | ⚠ | base ok; falta isenção >365d mob., reinvestimento HPP, G1 |
| H (deduções/benefícios) | ⚠ | deduções à coleta ok; falta PPR, donativos, juros HPP, limite global |
| I (herança indivisa) | ❌ | nicho |
| J (estrangeiro) | ❌ | crédito de dupla tributação |
| L (RNH/IFICI) | ❌ | nicho |

## (a preencher à medida que auditamos as outras ferramentas)
- [ ] SS Independente — base de incidência, percentagem, isenções.
- [ ] IMT / Imposto do Selo — escalões e isenções.
- [ ] IRC / Previsa — taxas, derrama, tributações autónomas.
- [ ] Viaturas — tabela do imposto de circulação, tributação autónoma.
- [ ] Tickets — limites do subsídio de refeição (cartão vs dinheiro).

## Salário Líquido — tabelas oficiais de retenção na fonte 2026 (11-jun)
Implementadas no simulador (substituem a estimativa anualizada). Para validação da Sandrine:
- [x] **Continente:** tabelas I–VII extraídas do XLSX oficial do Portal das Finanças ("Despacho SEAF, de 05/01/2026"). **Confirmar o número oficial do despacho** na publicação em DR (a fonte do agente que indicou "Despacho n.º 233-A/2026" colide com o despacho do subsídio de alimentação — não usámos).
- [x] **Madeira:** Despacho n.º 19/2026, de 20 de janeiro (JORAM, II Série, n.º 13, 4.º Supl.) — verificado contra o PDF oficial da AT-RAM (76 amostras).
- [ ] **Açores:** tabelas 2026 NÃO localizadas em fonte oficial (Portal AT é SharePoint dinâmico; JO Açores sem resultados). O simulador aplica estimativa = Continente × 0,80, sinalizada na UI como não-oficial. **Pedir à Sandrine a fonte/despacho regional 2026** e substituir em `src/lib/retencaoTabelas.ts`.
- [x] **Arredondamento:** retenção arredondada por defeito à unidade de euro (regra do rodapé das tabelas oficiais). **Confirmar o artigo exato** (99.º-E?).
- [x] **IRS Jovem na retenção (art. 99.º-F):** taxa efetiva da remuneração total aplicada só à parte não isenta, com teto anual 55×IAS rateado. **Confirmar mecânica do teto no processamento mensal.**
- [x] **Duodécimos (art. 99.º-C):** retenção mensal = parte proporcional (2×1/12) da retenção autónoma de cada subsídio. **Confirmar prática de arredondamento por recibo.**
- [ ] **Deficiência:** tabelas IV–VII aplicadas; **parcelas adicionais por dependente com incapacidade ≥60% (+€84,82/+€42,41) NÃO modeladas** — confirmar valores e relevância.
- [x] **Acerto anual estimado:** IRS anual (escalões art. 68.º + dedução específica 8,54×IAS) − retenção anual. Para deficientes a estimativa anual não modela abatimentos próprios (indicativo).
- [x] **Correção de bug anterior:** sem duodécimos, o total anual passou a incluir os 2 subsídios (14 remunerações); subsídio de alimentação anualizado a 11 meses (antes contava 14×).

## Previsa — PPC/PAC do próximo período (11-jun)
- [x] **Correção de bug:** o "PC estimado" antigo aplicava as taxas do PAC (2,5/4,5/8,5%) ao VOLUME DE NEGÓCIOS com escalões errados (500k/5M). Substituído pelo cálculo correto.
- [x] **PPC (art. 105.º CIRC):** próximo período = (c358 − retenções na fonte) × 80% (VN ≤ 500 k€) / 95% (VN > 500 k€), 3 prestações jul/set/15-dez; sem PPC quando a base ≤ 200 €. **Confirmar limiar dos 200 € e datas.**
- [x] **PAC (art. 105.º-A CIRC):** sobre o lucro tributável > 1,5 M€ — escalões 1,5–7,5M / 7,5–35M / >35M às taxas 2,5/4,5/8,5% (continental; Madeira/Açores reduzidas). **Confirmar taxas regionais.**
- [x] Prejuízos fiscais: dedução Q09 já existia (limite 65%/75% c/ limiteMaisPP) — adicionada linha visível "(−) Prejuízos deduzidos" no resumo. **Confirmar regime de reporte sem prazo (pós-OE2023) e limite 65%.**
