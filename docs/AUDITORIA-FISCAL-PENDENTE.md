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

## (a preencher à medida que auditamos as outras ferramentas)
- [ ] Salário Líquido — taxas SS, retenção na fonte, subsídio de refeição.
- [ ] SS Independente — base de incidência, percentagem, isenções.
- [ ] IMT / Imposto do Selo — escalões e isenções.
- [ ] IRC / Previsa — taxas, derrama, tributações autónomas.
- [ ] Viaturas — tabela do imposto de circulação, tributação autónoma.
- [ ] Tickets — limites do subsídio de refeição (cartão vs dinheiro).
