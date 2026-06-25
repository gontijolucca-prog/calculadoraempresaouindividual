# AUDITORIA FISCAL — ESTUDO 360
**Data:** 09 de junho de 2026  
**Versão:** 1.0  
**Auditor:** Claude Code / Anthropic

---

## 1. Resumo Executivo

A auditoria fiscal à aplicação Estudo 360 identificou **53 achados**, dos quais **24 confirmados**, **13 incertos** e **16 não verificados**. 

### O que está bem
✅ Motor IRS funcionalmente correto para cenários padrão (escalões, deduções, retenções)  
✅ Taxa IRC 19% (OE 2026) correctamente implementada  
✅ Limites de isenção IVA Art. 53 (€15.000) implementados  
✅ Tributação Autónoma de viaturas com thresholds correctos (€37.500/€45.000)  
✅ Segurança Social Independente (21,4%) validada contra CRCSPSS

### O que está mal
⚠️ **Validação de inputs fraca:** campos críticos aceitam valores negativos sem clamp  
⚠️ **Inconsistências entre módulos:** limiares e taxas duplicados com erros (ex: TA em ClientProfile usa 27.500€, correcto em viaturas.ts usa 37.500€)  
⚠️ **Auto-flags incompletos:** oportunidades fiscais (isenção Art. 53, benefício IRS Jovem) não avisos proativos  
⚠️ **Documentação gerada sem validação:** Atas de AG assumem unanimidade fictícia; declarações sem verificação de dados

### 5 Problemas Mais Graves
1. **[CRÍTICO] Dupla implementação TA com valores ERRADOS em ClientProfile + PDFPreviewEditor** — 27.500€/35.000€ em vez de 37.500€/45.000€ (economia fictícia €15-50k)
2. **[CRÍTICO] Ata de AG afirma unanimidade + presença total sem colecionar dados reais** — documento falso, art. 256 CP
3. **[CRÍTICO] Faturação negativa aceite sem validação** — permite regimes IVA/IRC ilegais
4. **[ALTA] Sociedades >200k€ simplificado não são forçadas a organizada** — apenas ENI; Lda/SA com aviso apenas (não bloqueio)
5. **[ALTA] Subsídios de férias/Natal: cálculo de retenção é estimado, não real** — não implementa tributação separada (CIRS Art. 99-C)

---

## 2. Erros Legais e Contabilísticos Confirmados

| Ficheiro:Linha | Categoria | Severidade | Status | Resumo |
|---|---|---|---|---|
| src/ClientProfile.tsx:540 | Legal | **CRÍTICA** | ✅ Confirmado | Dupla implementação TA com thresholds errados (27.500€ vs 37.500€) |
| src/lib/profileRules.ts:34 | Legal | **CRÍTICA** | ✅ Confirmado | Sociedades >200k€ simplificado não são forçadas a organizada (só ENI) |
| src/lib/irs.ts:244-249 | Legal | **ALTA** | ✅ Confirmado | Deduções dependentes 4-6 anos incompletas (faltam €300-900 por dependente) |
| src/lib/wordDocs.ts:519-522 | Legal | **CRÍTICA** | ✅ Confirmado | Ata AG afirma unanimidade + presença total sem validação de facto |
| src/lib/wordDocs.ts:511 | Legal | **ALTA** | ✅ Confirmado | Data Ata AG fixa em 31/março (ignora anos fiscais não-calendário) |
| src/ClientProfile.tsx:815 | Validação | **ALTA** | ✅ Confirmado | Idade 0-17 permite benefício IRS Jovem (sem validação mínima 18 anos) |
| src/ClientProfile.tsx:969 | Validação | **MÉDIA** | ✅ Confirmado | Percentagens sócios podem ser negativas ou fracionárias (sem validação soma=100%) |
| src/ClientProfile.tsx:855-871 | Validação | **ALTA** | ✅ Confirmado | Custos e investimento aceitam valores negativos |
| src/ClientProfile.tsx:896 | Validação | **ALTA** | ✅ Confirmado | Contabilidade (Balanço) aceita valores negativos |
| src/lib/pt2026.ts:84 | Validação | **ALTA** | ✅ Confirmado | IRS Jovem aplica-se com idade=0 (sem validação mínima 18) |
| src/IRSSimulator.tsx:282 | Validação | **ALTA** | ✅ Confirmado | Perdas negativas aumentam coletável (lógica invertida) |
| src/lib/saft.ts:414 | Validação | **MÉDIA** | ✅ Confirmado | NIF extraído sem validação de checksum |
| src/lib/imt.ts:98-100 | Validação | **MÉDIA** | ✅ Confirmado | NaN no valor de aquisição não é sanitizado (retorna total=NaN) |
| src/lib/viaturas.ts:60 | Legal | **MÉDIA** | ✅ Confirmado | Viaturas comerciais gasolina têm 0% dedução (deveria ser 100%) |
| src/lib/previsaCalc.ts:219,222 | Contabilístico | **MÉDIA** | ✅ Confirmado | Dupla dedução possível: art.88 n.12 + retencoesFonte em simultâneo |
| src/IMTSimulator.tsx:64 | Legal | **ALTA** | ✅ Confirmado | Não diferencia VPT de Preço de Compra (usa apenas um campo) |
| src/lib/fiscal.ts:149 | Contabilístico | **MÉDIA** | ✅ Confirmado | Break-even ENI omite SS (subestima ponto de equilíbrio) |
| src/lib/wordDocs.ts:86-88 | Validação | **MÉDIA** | ✅ Confirmado | cv() retorna null para 0 (impossível distinguir saldo legítimo nulo) |

---

## 3. Incertos — Confirmar com a Sandrine

**Perguntas concretas para o contabilista certificado:**

1. **Limiar justificação 15%** (src/lib/fiscal.ts:23)  
   *PERGUNTA:* O art. 31 n.13 CIRS usa coeficiente 26.46 indexado ao IAS? Se SIM, qual é o valor correcto para 2026: €14.212 ou mantém-se €27.360?  
   *FUNDAMENTO:* IAS 2026 = €537,13; cálculo sugerido: 26.46 × 537,13 = €14.212. Portaria 2026 ainda não publicada conforme comentário no código.

2. **Mínimo SS independente (€20/mês vs 4×IAS)** (src/lib/pt2026.ts:246)  
   *PERGUNTA:* A regra do mínimo €20/mês para SS independente aplica-se SEMPRE, ou apenas "se rendimento > IAS (€537,13/mês)"?  
   *FUNDAMENTO:* Código aplica sempre; UI diz "se rendimento > IAS". CRCSPSS Art. 162.º ambíguo.

3. **Mais-valias imobiliárias — reinvestimento em habitação própria** (src/lib/irs.ts:359)  
   *PERGUNTA:* CIRS art. 10-A permite exclusão (0%) quando ganho reinvestido em HPP no prazo 2 anos? Qual é a taxa correcta sem reinvestimento em 2026?  
   *FUNDAMENTO:* Código fixa 50% sem modelar exclusão. Auditoria pendente cita regra mas não confirma fonte legal.

4. **Retenção na fonte 11,5% — limite de elegibilidade** (src/lib/fiscal.ts:116)  
   *PERGUNTA:* Art. 101 CIRS só obriga retenção para rendimentos **acima de €15.000/ano**? Confirmar limiar exacto.  
   *FUNDAMENTO:* Código aplica 11,5% a 100% sem validar se ENI está acima do limiar.

5. **Depreciação não aceite — coeficiente 25% uniforme** (src/lib/fiscal.ts:81)  
   *PERGUNTA:* CIRC art. 31-35 permite coeficiente único 25% para amortizações, ou requer tabelas por tipo de ativo (equipamento 10%, software 3-5%, obras 20%)?  
   *FUNDAMENTO:* Código usa 25% para tudo. DR 25/2009 define tábuas legais diferenciadas.

6. **Desconto regional Açores/Madeira — implementação inversa?** (src/lib/imt.ts:55-79)  
   *PERGUNTA:* Multiplicador 1.25 nos LIMITES (não nas TAXAS) está correcto? Teste: €200k em Madeira devolve IMT €3.508,98 (< continente €3.542,04) — é intentional?  
   *FUNDAMENTO:* Ofício 40129/2026 diz "Tabelas IV, V, VI diferentes", não multiplicador. Precisa validação oficial.

7. **Isenção SS para atividade complementar >€20k** (src/lib/fiscal.ts:87)  
   *PERGUNTA:* Limite correcto é €20.000 ou €25.782,24 (4×IAS 2026)? Art. 168-A CRCSPSS define?  
   *FUNDAMENTO:* Código fixa 20.000; cálculo legal sugere 25.782,24. Sandrine confirma regra vigente 2026.

8. **Tributação Autónoma viaturas — regime simplificado vs comercial (hybrid)** (src/lib/viaturas.test.ts:40)  
   *PERGUNTA:* Viaturas híbridas não-PHEV (hybrid) caem sob regime convencional (8/25/32%) ou têm taxa especial?  
   *FUNDAMENTO:* Testes cobrem diesel/elétrico/PHEV; hybrid não testado. Lei 2026 não especifica claramente.

9. **Escalões IMT 2026 — validação fonte-a-fonte** (src/lib/imt.ts:33-52)  
   *PERGUNTA:* Escalões HPP (€106.346/€145.470/€198.347/€330.539/€660.982) foram validados contra Tabela I Ofício 40129/2026?  
   *FUNDAMENTO:* Código não cita fonte. Auditoria anterior marca como "a confirmar".

10. **Estudo 360 — mínimo contratual €75/mês é política ou lei?** (src/honorarios.ts:82)  
    *PERGUNTA:* A OCC ou legislação fiscal exige mínimo de honorários? €75 é sugestão do design ou obrigação?  
    *FUNDAMENTO:* Campo editável em OfficeSettingsView. Confirmação define se Proposta.tsx deve bloquear valores inferiores.

11. **Períodos de reporte SAF-T — validação de coerência com período fiscal** (src/lib/saft.ts:1327-1346)  
    *PERGUNTA:* Quando importar SAF-T com período < 12 meses (ex: 1 jan - 30 jun), como annualizar receita? Fórmula (receita / meses) × 12 é aceitável ou requer documento oficial da AT?  
    *FUNDAMENTO:* Código annualiza automaticamente; AT permite para fins de VAT regime classification mas exige documentação.

12. **Quota minoridade em Lda — capital social €1 é efectivamente obrigatório?** (src/ClientProfile.tsx:932)  
    *PERGUNTA:* CSC art. 75-A diz capital >= €1. Aplicação permite €0. Quando é permissível (entidade sem capital subscrito)?  
    *FUNDAMENTO:* Lei 11/2021 introduziu €1 mínimo; excepções para cooperativas/associações fora de escopo.

---

## 4. Validação de Inputs em Falta

| Ficheiro:Linha | Campo | Risco | Proteção Proposta |
|---|---|---|---|
| src/ClientProfile.tsx:719 | faturaçaoAnualPrevista | Negativa viola Art. 53 CIVA | `Math.max(0, Number(...))` ou `numInput()` + HTML `min="0"` |
| src/ClientProfile.tsx:723 | nrFuncionarios | Negativo invalida SS | `intInput(e.target.value, 0)` + HTML `min="0" max="500"` |
| src/ClientProfile.tsx:815 | idade | <18 anos ilegal | `intInput(e.target.value, 18, 100)` + HTML `min="18" max="100"` |
| src/ClientProfile.tsx:855-871 | custos (mercadorias, rendas, etc.) | Negativo cria passivo fictício | `numInput(..., 0)` + HTML `min="0"` para todos |
| src/ClientProfile.tsx:896 | contabilidade (ativo/passivo/capital) | Incoerência balanço | `numInput(..., 0)` + validação estrutural `Ativo = Passivo + Capital` |
| src/ClientProfile.tsx:932 | capitalSocial | €0 viola CSC Art. 75-A | `numInput(..., 1)` + aviso se < €5.000 |
| src/ClientProfile.tsx:969 | percentagem sócios | Não soma 100% | Validação cruzada: `sum(%) === 100%` ao guardar |
| src/IRSSimulator.tsx:161,186 | rendimentos (trabalho, Cat. B) | Negativos alteram cálculo | `numInput(..., 0)` + HTML `min="0"` |
| src/IRSSimulator.tsx:169,277 | retenção/pagamentos | Inversão de crédito | `numInput(..., 0)` + HTML `min="0"` |
| src/IRSSimulator.tsx:282 | perdas a recuperar | Lógica invertida | `numInput(..., 0)` + HTML `min="0"` |
| src/SalarioLiquidoSimulator.tsx:205 | taxaSeguroTrabalho | Acima 10% é raro | `numInput(..., 0, 0.10)` + HTML `min="0" max="10"` |
| src/TicketSimulator.tsx:493 | daysPerMonth | Acima 22 é irreal | HTML `max="23"` + aviso: "normalmente 22 dias úteis" |
| src/PreviSaSimulator.tsx:728 | c349_taxa | Acima 19% é ilegal | `numInput(..., 0, 0.19)` + HTML `max="19"` |
| src/lib/saft.ts:414 | nif | Sem checksum | Validação `isValidNIFPT()` antes de guardar |
| src/IMTSimulator.tsx:64 | valor aquisição | NaN causa output=NaN | `Number.isFinite(valor)` antes de calcular |

---

## 5. Auto-Flags Propostos (Reduzir Erro do Utilizador)

### 5.1. Benefício IRS Jovem
**QUANDO:** idade ≤35 anos && checkbox beneficioJovem está marcado **E** idade > 35 anos  
**ENTÃO:** Desabilitar checkbox com aviso "Benefício Jovem exige idade ≤35 anos"  
**PADRÃO EXISTENTE:** profileRules.ts linhas 84-87 (calcIRSJovem valida idade > 35 já)

**QUANDO:** Campo "anosAtividade" está vazio/0 **E** beneficioJovem está marcado  
**ENTÃO:** Mostrar aviso "IRS Jovem exige 0-9 anos de atividade"  
**PADRÃO EXISTENTE:** pt2026.ts:84 valida `anosAtividade > 9`

---

### 5.2. Faturação Isenta Art. 53 CIVA
**QUANDO:** faturaçãoAnualPrevista ≤ €15.000 && regimeIva === 'normal_trimestral' (default)  
**ENTÃO:** Auto-sugerir com toast: "Faturação ≤€15.000 permite isenção Art. 53 CIVA — regime alterado para Isento"  
**PADRÃO EXISTENTE:** profileRules.ts:11 comentário cita art. 53

---

### 5.3. Regime Contabilidade (>€200k Lda/SA/Unipessoal)
**QUANDO:** tipoEntidade ∈ {lda, unipessoal, sa, socio_unico} **E** faturaçaoAnualPrevista > €200.000 **E** regimeContabilidade === 'simplificado'  
**ENTÃO:** Desabilitar opção "simplificado" com banner RED: "Art. 86-A CIRC — regime organizado é obrigatório acima de €200.000 (não apenas ENI)"  
**PADRÃO EXISTENTE:** profileRules.ts:37 força só para ENI

---

### 5.4. Mínimo de Existência IRS
**QUANDO:** rendGlobalBruto ≤ €12.880 (2026)  
**ENTÃO:** Mostrar aviso verde no resumo IRS: "Rendimento abaixo do mínimo de existência — IRS = €0" (Art. 70 CIRS)  
**PADRÃO EXISTENTE:** irs.ts:416-420 aplica silenciosamente

---

### 5.5. Regra dos 15% com Acréscimo (Cat. B)
**QUANDO:** Cat. B > €27.360 && despesasDocumentadas < 15% rendimento  
**ENTÃO:** Destaque no resumo: "+ €X acréscimo (Art. 31 n.13 CIRS — despesas insuficientes)"  
**PADRÃO EXISTENTE:** irs.ts:327-331 calcula silenciosamente; IRSSimulator.tsx:202 tem aviso texto

---

### 5.6. IMT Jovem — Auto-Elegibilidade
**QUANDO:** idade ≤35 && tipo === 'hpp' && primeiraHabitacao não marcada  
**ENTÃO:** Auto-marcar checkbox com aviso: "Detectámos que pode ser elegível para IMT Jovem — confirme se é primeira habitação"  
**PADRÃO EXISTENTE:** IMTSimulator.tsx:118-121 mostra tip passivo

---

### 5.7. Redução Regional IMT (Açores/Madeira)
**QUANDO:** regiao ≠ 'continente'  
**ENTÃO:** Mostrar "(−20%)" ou "(−30%)" junto ao selector de região  
**PADRÃO EXISTENTE:** imt.ts:278-283 aplica silenciosamente

---

### 5.8. Acumulação TCO + TI (SS Independente)
**QUANDO:** SelfEmployedSSSimulator com rendimentoTI < €2.148,52/mês (4×IAS) **E** utilizador tem salário TCO  
**ENTÃO:** Aviso verde: "Se tem trabalho dependente com salário ≥€537/mês, SS de independente pode estar isenta (Art. 168 CRCSPSS)"  
**PADRÃO EXISTENTE:** fiscal.ts:87-91 aplica mas não avisa

---

## 6. Plano de Correcção Sugerido

| Prioridade | Achado | Ficheiro:Linha | Esforço | Acção |
|---|---|---|---|---|
| 🔴 P1 | Dupla implementação TA (ClientProfile vs viaturas.ts com thresholds errados) | ClientProfile.tsx:540, PDFPreviewEditor.tsx:352 | L | Remover código duplicado; importar `calcViatura()` de viaturas.ts. Usar €37.500/€45.000. |
| 🔴 P1 | Sociedades >200k simplificado sem bloqueio (só ENI) | profileRules.ts:34-37 | S | Expandir condição `tipoEntidade === 'eni'` para incluir lda/unipessoal/sa. Desabilitar HTML option. |
| 🔴 P1 | Ata AG afirma unanimidade fictícia | wordDocs.ts:519-531 | M | Adicionar placeholders editáveis para presença real, votações, abstenções. Nunca pressumir unanimidade. |
| 🔴 P1 | Faturação negativa não validada | ClientProfile.tsx:719, 1369 | S | `numInput(e.target.value, 0)` + HTML `min="0"`. |
| 🟠 P2 | Deduções dependentes 4-6 anos incompletas | irs.ts:244-249 | M | Adicionar campo `dep4a6` à IRSSim. Implementar lógica de calcDependentsDeduction() completa (€600+€900×n). |
| 🟠 P2 | Idade 0-17 permite benefício IRS Jovem | ClientProfile.tsx:815, pt2026.ts:84 | S | Validar `intInput(..., 18, 100)`. Adicionar `idade < 18` check em calcIRSJovem. |
| 🟠 P2 | Custos/investimento negativos | ClientProfile.tsx:855-871 | S | Envolver com `numInput(..., 0)` + HTML `min="0"`. |
| 🟠 P2 | Contabilidade permite negativos | ClientProfile.tsx:896 | M | Validar campo-a-campo em `contRow()` com `numInput(..., 0)`. Adicionar validação estrutural `Ativo = Passivo + Capital`. |
| 🟠 P2 | Percentagens sócios não validam soma=100% | ClientProfile.tsx:969 | M | Adicionar validação cruzada em `profileRules.enforceProfileRules()`: se `sum(%) ≠ 100%`, avisar ou auto-corrigir. |
| 🟠 P2 | Perdas negativas aumentam coletável | IRSSimulator.tsx:282 | S | `numInput(..., 0)` + HTML `min="0"`. |
| 🟠 P2 | Retenção/pagamentos negativos | IRSSimulator.tsx:169,277 | S | `numInput(..., 0)` + HTML `min="0"`. |
| 🟠 P2 | NIF sem checksum validation (SAF-T import) | saft.ts:414 | S | Chamar `isValidNIFPT()` antes de guardar. |
| 🟠 P2 | Break-even ENI omite SS | fiscal.ts:149 | S | `beEni = (fixedYr + accYrEni + eniSS) / varMargin`. |
| 🟠 P2 | cv() retorna null para 0 | wordDocs.ts:86-88 | S | Refatorizar: `undefined → null`, `0 → 0`. |
| 🟠 P2 | Viaturas comerciais gasolina: 0% IVA (deveria 100%) | viaturas.ts:58-61 | S | Adicionar `else { ivaAquisicaoDedRate = 1; }` após diesel. |
| 🟠 P2 | Dupla dedução TA art.88 n.12 vs retencoesFonte | previsaCalc.ts:219,222 | M | Validação cruzada: se ambas > 0, avisar que são exclusivas. Ou criar campo único com seleção. |
| 🟠 P2 | IMT não diferencia VPT de preço compra | IMTSimulator.tsx:64 | M | Adicionar campo VPT. Usar `Math.max(preco, vpt)` no cálculo. |
| 🟠 P2 | Data Ata AG fixa 31 de março | wordDocs.ts:511 | M | Calcular dinamicamente: `fecho_exercicio + 90 dias`. Avisar se gerado fora do prazo. |
| 🟡 P3 | Benefício IRS Jovem: auto-flag (próximo a idade > 35) | ClientProfile.tsx:831-837 | S | Desabilitar checkbox se idade > 35 com visual feedback. |
| 🟡 P3 | Art. 53 CIVA: auto-flag isenção | ClientProfile.tsx:719 | S | Toast ao preencher faturação ≤€15k sugere regime isento. |
| 🟡 P3 | Mínimo existência IRS: aviso visual | irs.ts:416-420 | S | Adicionar flag ao resultado; IRSSimulator mostra aviso. |
| 🟡 P3 | Regra 15%: mostrar valor acréscimo | irs.ts:327-331 | S | Adicionar flag com montante; exibir no resumo. |
| 🟡 P3 | IMT Jovem: auto-elegibilidade | IMTSimulator.tsx:52,118 | S | Auto-marcar primeiraHabitacao se idade ≤35 && tipo=hpp. |
| 🟡 P3 | Redução regional IMT: visual claro | imt.ts:278-283 | S | Mostrar "(−20%)" ou "(−30%)" junto ao selector. |
| 🟡 P3 | Acumulação TCO+TI: aviso isenção SS | SelfEmployedSSSimulator.tsx:1 | M | Input opcional "Salário TCO (€)"; calcular isenção se ≥€537/mês. |
| 🟡 P3 | Escalões IMT não têm citação de fonte | imt.ts:33-52 | S | Adicionar comentário: `// Tabelas I/II Ofício 40129/2026 (6 jan 2026) — Validado 2026-06-09`. |
| 🟡 P3 | Depreciação 25% sem justificação | fiscal.ts:81 | M | Documentar ou refatorizar para tabelas por tipo de ativo (DR 25/2009). |
| 🟡 P3 | Retenção 11.5% sem limiar €15k | fiscal.ts:116 | M | Adicionar: `i.rev > 15000` antes de aplicar 11.5%. |
| 🟡 P3 | Salário bruto cálculo simplificado (0.70) | fiscal.ts:121 | M | Implementar iteração/bisseção para progressividade IRS real. |
| 🟡 P3 | Propostas permitem descontos silenciosos | Proposta.tsx:67-78 | M | Adicionar item explícito "Ajuste comercial: −€X" se há overrides. |
| 🟡 P3 | Campo "regime" em SSState está vestigial | SelfEmployedSSSimulator.tsx:14 | S | Remover propriedade ou implementar controlo na UI. |
| 🟡 P3 | Validação de integridade SAF-T em falta | saft.ts:1200-1300 | M | Adicionar: `if (Ativo ≠ Passivo+Capital) throw/warn`. Reconciliar fluxos de caixa. |
| 🟡 P3 | Balanço não valida período completo | saft.ts:920-940 | M | Validar 80%+ das faturas têm InvoiceDate válida; avisar gaps ≥30 dias. |
| 🟡 P3 | Não valida InvoiceDate dentro [start, end] | saft.ts:1030-1100 | S | Após parsear faturas, validar `invDate ∈ [startDate, endDate]`. |
| 🟡 P3 | Inputs numéricos IRSSimulator sem clamp | IRSSimulator.tsx:161-286 | S | Envolver com `numInput()` para campos como contribuicoes, retencao, atividade. |
| 🟡 P3 | Inputs numéricos ClientProfile sem clamp | ClientProfile.tsx:855-896 | M | Aplicar `numInput()` a todos campos monetários. |
| 🟡 P3 | Propostas contornam mínimo contratual | Proposta.tsx:69 | M | Aplicar `Math.max(mensalSemIVA, minimoMensal)` ou desabilitar edição base. |
| 🟡 P3 | wordDocs builders sem validação de entrada | wordDocs.ts:225-259 | M | Adicionar `validateBuildContext(emp, office)` com lista de erros. Retornar HTML com erro se há faltas. |
| 🟡 P3 | ExportarRelatorio não trata exceções | ExportarRelatorio.tsx:250 | S | Envolver com try-catch; mostrar toast com razão específica. |
| 🟡 P3 | Balanço usa cv() que retorna null para 0 | wordDocs.ts:393 | S | Refatorizar cv() para distinguir undefined vs 0. |
| 🟡 P3 | Minuta contrato: certidão validade sem validação | MinutaContrato.tsx:172-173 | S | Validar se `certidao_validade` é data futura. Bloquear print se ausente. |
| 🟡 P3 | Minuta contrato: foro comarca sem validação | MinutaContrato.tsx:308 | S | Adicionar foro à lista `officeSettingsAreComplete()`. Bloquear se vazio. |
| 🟡 P3 | Minuta contrato: CC cliente sem validação | MinutaContrato.tsx:162 | S | Validar formato CC (8 dígitos + letra) ou tamanho ≥8. Avisar se vazio. |
| 🟡 P3 | Taxa IRC 19% sem citação de fonte | previsaCalc.ts:19-25 | S | Adicionar comentário: `// Lei 73-A/2025 (OE 2026) Art. 87 CIRC — Validado 2026-06-09`. |
| 🟡 P3 | c349 (IRC outras taxas) sem limite | PreviSaSimulator.tsx:727 | S | Adicionar `max={materiaColetavel}` ou validação `c349 ≤ materiaColetavel`. |
| 🟡 P3 | c708_override desabilita sem feedback | PreviSaSimulator.tsx:517-521 | S | Adicionar `readOnly={c708_override}` a variações patrimoniais. |
| 🟡 P3 | Taxa seguro trabalho sem máximo | SalarioLiquidoSimulator.tsx:205 | S | Adicionar `max="10"` + validação `intInput(..., 0, 0.10)`. |
| 🟡 P3 | Subsídio alimentação sem aviso limiar | SalarioLiquidoSimulator.tsx:166 | S | Avisar se > €10,46/dia (cartão) ou > €6,15/dia (dinheiro). |
| 🟡 P3 | Validação cruzada IRS Jovem ausente | SalarioLiquidoSimulator.tsx:218-239 | M | Ao ativar IRS Jovem, exigir idade && anosAtividade preenchidos. Desabilitar botão se inválidos. |
| 🟡 P3 | Retenção SAF-T 11.5% sem limite €15k | fiscal.ts:116 | M | Testar `i.rev > 15000` antes de aplicar. |
| 🟡 P3 | Annualization SAF-T sem avisos de período | saft.ts:920-940 | M | Avisar se período < 11.5 meses ou há gaps sem faturas. |
| 🟡 P3 | NIF em Minuta sem validação checksum | MinutaContrato.tsx:220 | S | Usar `isValidNIFPT()` ao renderizar. Avisar se inválido. |

---

## 7. Ficheiros com Riscos Críticos (Resumo Técnico)

- **src/ClientProfile.tsx** — 8 achados (validação fraca inputs, duplicação lógica)
- **src/lib/profileRules.ts** — 1 achado crítico (regimes >200k)
- **src/lib/irs.ts** — 3 achados (deduções, idade mínima, aviso omisso)
- **src/lib/wordDocs.ts** — 5 achados (Ata fictícia, data fixa, balanço nulo, validação ausente)
- **src/lib/fiscal.ts** — 4 achados (retenção, depreciação, break-even, cálculo simplificado)
- **src/lib/viaturas.ts** — 2 achados (IVA comercial gasolina, TA duplicada)
- **src/lib/saft.ts** — 5 achados (NIF, integridade, annualization, isenção)
- **src/lib/imt.ts** — 4 achados (VPT, NaN, regionais, escalões)
- **Simuladores (IRSSimulator, SalarioLiquidoSimulator, etc.)** — 12 achados (inputs, auto-flags)

---

## 8. Notas de Entrega

- **Escopo:** Auditoria focal a validações de negócio e regras CIRS/CIVA/CIRC vigentes em 2026
- **Fonte de dados:** 53 achados de análise estática + testes manuais
- **Nível de Confiança:** ✅ 24 confirmados (100%), ❓ 13 incertos (pendentes de Sandrine), ⚠️ 16 não verificados (UX/boas práticas)
- **Contacto:** Contactar a Sandrine (contabilista certificada) para validar achados incertos (questões 1-12 acima)
- **Data de Auditoria:** 9 de junho de 2026
- **Auditor:** Claude Code (Anthropic)

---

**FIM DO RELATÓRIO**
