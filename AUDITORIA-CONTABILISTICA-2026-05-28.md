# Auditoria contabilística Estudo 360 — 2026-05-28

**Estado: COMPLETA** — todos os 9 findings tratados nesta sessão.

**Âmbito:** review aprofundada dos motores fiscais e simuladores à luz do OE 2026 (Lei 73-A/2025) e legislação vigente a 28-mai-2026.

**Fontes oficiais cruzadas:** Lei 73-A/2025, Portaria 480-A/2025 (IAS), DL 139/2025 (RMMG), Portaria 51-B/2026/1 (subsídio refeição), Despacho 1179/2026 (IRS Açores), DL Regional 8/2025/M (Madeira), CIRC art. 87.º + 88.º, CRCSPSS art. 168.º, OCC Análise OE 2026, PwC Guia Fiscal 2026, AT Portal das Finanças.

---

## 1. Fixes aplicados nesta sessão

### Commit `c3396ff7` — Motor IRS migrado para OE 2026

| Valor | Antes (2025) | Agora (OE 2026) |
|---|---|---|
| IAS | €522,50 | €537,13 |
| Escalões IRS | 8059/12160/… | 8342/12587/17838/23089/29397/43090/46566/86634/∞ |
| Dedução específica Cat A | €4.462,15 | €4.587,09 (8,54 × IAS) |
| Limite IRS Jovem | €28.737,50 | €29.542,15 (55 × IAS) |
| Mínimo de existência | declarado, **não aplicado** | 14×SMN = €12.880, **aplicado ao impostoFinal** |
| Dep ≤3a (1.º filho) | +€150 (legacy) | +€726 |
| Dep ≤3a (2.º+) | +€150 (legacy) | +€900/dep |
| Dedução específica salário (€) | €4.104 hardcoded | €4.587,09 (calc. IAS) |
| Dependentes Art. 78º-A | regra ≤3 só | estendida a ≤6 anos para 2.º+ filho |

### Commit `a0b453e4` — Tetos OE 2026, multiplicadores regionais e SAFT

- **Habitação dedução à coleta**: teto €700 → **€900** (Lei 73-A/2025)
- **Gerais e familiares**: 35% sem teto → 35% com teto **€250/SP** (€500 conjunto), 45%/**€335** monoparental
- **Multiplicadores regionais IRS** — estavam invertidos e desatualizados:
  - Madeira: 0,765 → **0,70** (redução 30%, DL Regional 8/2025/M)
  - Açores: 0,70 → **0,80** (redução 20%, Despacho 1179/2026)
- **SAFT**: 26 substituições para preservar 2 casas decimais nos line items RAI/TA (eram truncados ao €1)

### Commit `cf266a64` — IRC OE 2026 + derrama + bugs PreviSa

- **Taxa IRC geral**: 20% → **19%** (OE 2026; baixa progressiva até 17% em 2028)
- **Taxa PME** (≤€50k): 16% → **15%**
- **Madeira IRC**: 14% → 13,3% geral, 8,75% → 10,5% PME
- **Açores IRC**: 14% → 15,2% geral, mantém 8,75% PME
- **Bug grave derrama estadual**: aplicava 3% desde €0; agora isenta primeiros €1,5M
- **Açores derrama**: ajustado para redução 20%
- **TaxSimulator**: SS independente passa a usar `calcSelfSSContribution` central; SS_RATE_EMPLOYER/EMPLOYEE em vez de magic numbers; dedução específica €4.104 → €4.587,09

### Commit `8dd235ba` — Coeficiente CAE ENI

- Antes binário (`servicos`/`bens`); agora 4 opções oficiais do art. 31º CIRS:
  - Vendas/restauração/hotelaria (15%)
  - Outros serviços (35%)
  - Profissionais art. 151º (75%)
  - Mining cripto (95%)
- TaxSimulator + ClientProfile preview usam o novo coeficiente
- Regra de justificação dos 15% (art. 31º n.º 13) agora aplica-se só a coef. 0,75 e 0,35 (não 0,15 nem 0,95)

---

## 2. Estado dos motores — todos validados OE 2026

| Constante | Valor | Status |
|---|---|---|
| IAS 2026 | €537,13 | ✅ |
| SMN 2026 | €920 | ✅ |
| Escalões IRS | 9 escalões Lei 73-A/2025 | ✅ |
| Dedução específica Cat A | €4.587,09 | ✅ |
| Limite IRS Jovem | €29.542,15 | ✅ |
| Mínimo existência | €12.880 (aplicado) | ✅ |
| Saúde | 15% / €1.000 | ✅ |
| Educação | 30% / €800 | ✅ |
| Habitação rendas | 15% / **€900** | ✅ |
| Lares | 25% / €403,75 | ✅ |
| Pensões | 20% / €419,22 | ✅ |
| Gerais/familiares | 35% / €250/SP (conj. €500), 45%/€335 monoparental | ✅ |
| Mult. Madeira IRS | 0,70 (-30%) | ✅ |
| Mult. Açores IRS | 0,80 (-20%) | ✅ |
| IRC geral | 19% | ✅ |
| IRC PME ≤€50k | 15% | ✅ |
| IRC Madeira | 13,3% / 10,5% PME | ✅ |
| IRC Açores | 15,2% / 8,75% PME | ✅ |
| IRC Interior | 19% / 12,5% PME | ✅ |
| IRC Startup | 12,5% (IFICI) | ✅ |
| Derrama estadual | 0% até €1,5M, 3%/5%/9% | ✅ |
| TA viaturas combustão | 8%/25%/32% (37,5k/45k) | ✅ |
| TA viaturas PHEV | 2,5%/7,5%/15% | ✅ |
| TA viaturas EV | 0% até €62,5k, 10% acima | ✅ |
| Limite depreciação fiscal | €25k/€37,5k/€50k/€62,5k | ✅ |
| Subsídio refeição cartão | €10,46 | ✅ |
| Subsídio refeição dinheiro | €6,15 | ✅ |
| SS empregador | 23,75% | ✅ |
| SS trabalhador (TCO) | 11% | ✅ |
| SS independente | 21,4% × 70%/20% base, min €20/mês | ✅ |
| Coeficientes art. 31º CIRS | 0,15/0,35/0,75/0,95 | ✅ |
| IMT HPP isenção | €106.346 (+2%) | ✅ |
| IMT Jovem isenção | €330.539 | ✅ |
| IMT Jovem redução parcial | até €660.982 | ✅ |
| IMT mult. Madeira/Açores | 1,25 | ✅ |
| Adicional solidariedade IRS | 2,5% (>€80k) / 5% (>€250k) | ✅ |
| SAFT precisão | 2 casas decimais | ✅ |

---

## 3. Notas operacionais

- **MUNICIPIOS_BM**: foi atualizado para Lisboa/Porto/Cascais/Oeiras com valores 2026; restantes municípios mantidos com dados de 2024-25 (cada câmara decide anualmente — recomendado: verificar localmente em [Portal das Finanças](https://www.portaldasfinancas.gov.pt/pt/consultarTaxasIRSMunicipiosForm.action)).
- **Limiar de justificação (15%)**: €27.360 mantido (mesmo valor de 2025). Rever quando AT publicar Portaria de atualização para 2026.
- **Atividade legacy "servicos"/"bens"**: aceite no perfil por retro-compatibilidade — mapeiam para 0,75 e 0,15 respetivamente.

---

## 4. Commits desta sessão (cronológico)

| SHA | Descrição |
|---|---|
| `e46477f0` | rebrand v2 + CRM lista de empresas |
| `e36b270d` | logo SVG + modal nova empresa + remove honorários base legal |
| `c3396ff7` | motor IRS Modelo 3 migrado para OE 2026 |
| `a0b453e4` | tetos deduções, multiplicadores regionais, SAFT preserva cêntimos |
| `cf266a64` | IRC OE 2026, derrama, TaxSimulator central |
| `8dd235ba` | coeficiente CAE ENI (art. 31º CIRS) |

---

*Sessão concluída 2026-05-28 13:13 — 6 commits aplicados, 9 findings de auditoria fechados, todos os motores validados contra OE 2026.*
