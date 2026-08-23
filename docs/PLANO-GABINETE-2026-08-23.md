# Plano de Execução — Estudo360 v2: de Calculadora para Gestão de Gabinete

> **Data:** 23-08-2026  
> **Pedido origem:** Sandrine Reis + Ana Margarida (Recofatima) — WhatsApp 20-08-2026 11:22 + specs Junho  
> **Referência benchmark:** CRMContab (SoftWhere, Leiria) — https://www.gestao-gabinetes.eu/gestao_gabinetes.html (Admin/123)  
> **Stack actual:** React 19 + Vite 6 + TS + Firebase Auth/Firestore + Cloudflare Pages + Tailwind v4 + jsPDF/Recharts  
> **Domínio:** estudo360.pt

---

## 0. Resumo em 1 página

A Sandrine não quer só "correcções" — quer transformar o Estudo360 numa **ferramenta única de gestão do gabinete**: clientes + tarefas + obrigações + documentos + acessos + cofre de senhas, com a mesma qualidade de cálculo que já tem (10 simuladores, Previsa, IMT, IRS, etc.) mas com UX moderna. E propõe **trocar avença por % sobre vendas** — parceria real.

O plano divide-se em **5 fases em 9 semanas** (com piloto na Recofatima), mantendo tudo o que já funciona, colmatando os specs pendentes de Junho (cenários elegíveis + PPC art. 105º) e construindo por cima a camada de Gestão.

**Entregável da Fase 1 (3 semanas):** gabinete consegue gerir 50+ clientes, ver obrigações do mês, atribuir tarefas, guardar senhas cifradas e já vender a ferramenta.

---

## 1. O que a Sandrine pediu — transcrito e classificado

### 1.1 Pedido novo (20-08-2026) — Gestão de Gabinete

| # | Funcionalidade | Descrição Sandrine | Prioridade dela |
|---|----------------|--------------------|-----------------|
| G1 | **Gestão de tarefas** | Tarefas por cliente, por colaborador, com estado e prazo | 🔴 Alta |
| G2 | **Obrigações dos clientes** | Calendário fiscal/contabilístico (IVA, IRC, SS, retenções) por cliente | 🔴 Alta |
| G3 | **Cofre de senhas** | Guardar acessos AT, SS, bancos, e-fatura — partilhado no gabinete | 🔴 Alta |
| G4 | **Organização interna** | Visão central do gabinete: quem faz o quê, o que está atrasado | 🔴 Alta |
| G5 | **Centralização** | Um sítio para clientes + documentos + acessos + tarefas | 🔴 Alta |
| G6 | **Renegociação contrato** | Tu passas a receber **% sobre vendas** (parceria) | 🟡 Decisão |
| G7 | **Site + loja online** | Vender a ferramenta (billing, licenças) | 🟡 Fase 4 |

**Benchmark dado:** CRMContab — já tem G1-G5 mas com UX datada. Oportunidade = fazer moderno, simples, apelativo.

### 1.2 Specs pendentes de Junho — Simuladores

| # | Spec | Estado actual | O que falta |
|---|------|---------------|-------------|
| S1 | **Correções 24-Jun** — AT fake removida, volume 71+72, IRC 16/20% (2025) e 15/19% (2026) | ✅ Já feito e publicado em estudo360.pt | Verificar ligação e-fatura real (ela ia confirmar) |
| S2 | **Simulador por cenários elegíveis** — 12 cenários A1-A6 (ENI) + B1-B6 (Lda), com validação jurídica antes do cálculo | 🟡 Parcial — `enquadramento2026.ts` já valida IRS simplificado ≤200k, IRC simplificado (6 condições), IVA 53 ≤15k→18.750€ saída, IVA mensal ≥650k, e `EnquadramentoCompleto.tsx` mostra elegível/não | Falta: UI que **só mostra cenários elegíveis** + distinção **poupança fiscal vs tesouraria** + fórmulas completas do motor (coeficientes 0,15/0,75 etc.) já descritas no WhatsApp |
| S3 | **PPC — 2 botões art. 104/105/107:** "Atualizar PPC" (80% ≤500k / 95% >500k) e "Simular limitação 3º PPC" | 🟡 Parcial — `PreviSaSimulator.tsx` já calcula `ppcTaxa`, `ppcProximoAno`, `ppcPrestacao` (360/374) | Falta: UI dedicada com **2 botões distintos**, fórmula `base = imposto liquidado - dedução 90º nº2 e)` + repartição 3 prestações arredondadas por excesso + datas jul/set/dez + estado "pagamentos já realizados" |
| S4 | **Exportar tabela honorários para Excel** | 🔴 TODO #4 pendente | Implementar `downloadPrevisaExcel` já existe — falta tabela honorários (`honorarios.ts`, `OfficeSettingsView`) |

---

## 2. Estado actual do Estudo360 — o que já temos (não mexer, só estender)

- **Auth:** Firebase Auth (sessão local piloto + cloud sync por `officeSettings.nif` como tenant)
- **Dados:** `empresas/{officeId}` + `profile` + `previsa` + `sims: {tax, vehicle, ticket, selfss, diagnostico, imoveis, imt, salario, irs}` — cada cliente tem o seu snapshot, histórico `simulacoes` por empresa
- **SAF-T:** `parseSAFT`, `saftXml` guardado, re-parse por `saftReparseRev`
- **10 Simuladores + AI Contabilista:** Go(mimo-v2.5)→OpenRouter→OmniRoute fallback, `/ai/_models.ts`
- **Validações duras:** `profileRules.ts` (IVA isento ≤15k, mensal ≥650k, organizada >200k) + `enquadramento2026.ts` (6 condições IRC simplificado)
- **Export:** `previsaExcel.ts`, `wordDocs.ts`, `honorarios.ts`
- **Deploy:** push `main` → Cloudflare Pages

**Risco:** não partir o que já funciona. Tudo o que for "Gestão" vive em **novas collections** e novas rotas, sem tocar nos simuladores.

---

## 3. Visão do produto v2

> **"Uma só ferramenta: simula, decide, gere."**

- **Para o contabilista:** abre de manhã e vê — o que vence hoje, quem está atrasado, que senhas precisa, que clientes precisam de PPC/IVA.
- **Para o empresário:** vê a simulação, mas o gabinete já tem tudo centralizado.
- **Para a Recofatima:** piloto com dados reais → feedback semanal → primeira venda externa na semana 9.

**Princípios:** sem curva de aprendizagem do Excel (Previsa já é espelho do Modelo 22), offline-first onde der, tudo cifrado no cofre, mobile usable (colaboradora de Setembro vai usar no terreno).

---

## 4. Arquitectura — extensão, não rewrite

### 4.1 Novas collections Firestore

```
empresas/{officeId}/clientes_gabinete/{clienteId}
  - nome, nif, contacto, tipoEntidade, regimeIva, regimeContab
  - responsavelId (colaborador), estado (ativo/arquivado), tags
  - link para EmpresaRecord existente (reutiliza profile/previsa/sims)

gabinete/{officeId}/tarefas/{tarefaId}
  - titulo, descricao, clienteId?, responsavelId, estado (todo/doing/done/atrasada)
  - tipo: obrigacao | tarefa | lembrete
  - dataVencimento, dataConclusao, recorrencia (mensal/trimestral/anual)
  - origem: manual | gerada por obrigacao fiscal

gabinete/{officeId}/obrigacoes/{obrigacaoId}  (catálogo + instâncias)
  - catalogo: IVA mensal/trimestral, PPC jul/set/dez, IES, Modelo 22, SS, retenções, etc.
  - instancia: clienteId + periodo + vencimento + estado (pendente/entregue/atrasada)
  - gerada automaticamente a partir de perfil (fat, regime, território)

gabinete/{officeId}/cofre/{entradaId}
  - clienteId?, titulo (ex: "AT Recofatima"), categoria (AT/SS/Banco/Email/Outro)
  - username, url, notas
  - segredo cifrado: AES-GCM com chave derivada do Firebase Auth (Web Crypto) — nunca em plain text no Firestore
  - audit: quem criou/viu (log, sem expor segredo)

gabinete/{officeId}/documentos/{docId}
  - clienteId, nome, tipo (SAF-T, IES, Modelo22, contrato), storage path (Firebase Storage)
  - versao, dataUpload, uploadedBy

gabinete/{officeId}/colaboradores/{uid}
  - nome, email, role (admin/contabilista/estagiaria), cor/avatar

gabinete/{officeId}/settings
  - honorariosConfig já existe → estender com `obrigaçõesAtivas: string[]`, `cofrePolitica`
```

### 4.2 Segurança

- **Firestore Rules:** `match /gabinete/{officeId}/{document=**} allow read,write if request.auth.uid == officeId` (mesmo padrão de `empresas`) + sub-rules por role depois
- **Cofre:** cifragem client-side (Web Crypto SubtleCrypto, PBKDF2 → AES-GCM 256). Chave nunca sai do browser; Firestore só guarda `iv + ciphertext + salt`. Sem isto, o gabinete não confia.
- **RGPD:** clientes são dados do gabinete — aviso + consent checkbox no onboarding, export/delete por cliente.

### 4.3 Rotas/UI novas (sem quebrar as actuais)

```
/                 → Landing já existe
/empresas         → Lista de Empresas (já existe)
/empresas/:id     → Perfil já existe
/gabinete         → NOVO: Dashboard do dia (KPIs: tarefas hoje, obrigações vencidas, atalhos)
 /clientes        → NOVO: Lista 360 (tabela com filtros: responsável, vencimento, estado)
 /clientes/:id    → NOVO: Ficha 360 (tabs: Dados | Tarefas | Obrigações | Documentos | Acessos)
 /tarefas         → NOVO: Board (Kanban: A fazer / Em curso / Feito / Atrasado) + calendário
 /obrigacoes      → NOVO: Calendário fiscal do gabinete (mês/semana, por cliente)
 /cofre           → NOVO: Lista + pesquisa + "revelar" com re-auth
 /documentos      → NOVO: Drive por cliente
/office-settings  → Já existe → estender com "Obrigações" e "Cofre"
```

Reutilizar `Input.tsx`, `Combobox.tsx`, `Layouts.tsx`, `ThemeContext`, `motion`.

---

## 5. Roadmap — 5 fases, 9 semanas, entregas semanais

### Fase 0 — Discovery (Semana 0, 3–4 dias) — COMEÇA JÁ

**Objectivo:** não construir às cegas.

- [ ] **0.1 Auditoria CRMContab (4h):** entrar com Admin/123, mapear ecrãs, fluxos, exportar lista de funcionalidades (tarefas, obrigações, alertas, cofre, documentos, permissões). Gravar Loom de 10 min.
- [ ] **0.2 Entrevista Sandrine + Ana (1h, esta semana):** validar: quais as 3 dores que mais doem hoje? Quantos clientes? Quantos colaboradores? Como gerem hoje (Excel? papel? email?). O que NÃO querem do CRMContab?
- [ ] **0.3 Gap vs Estudo360 (2h):** cruzar 0.1 + 0.2 com o que já existe (`enquadramento2026`, `PreviSa`, `honorarios`). Definir **MVP must-have** (ver 5.1).
- [ ] **0.4 Especificar % (1h):** preparar 3 cenários de parceria (ver §8) para levar à reunião da Fase 0.
- [ ] **Entregável:** doc `docs/AUDITORIA-CRMCONTAB.md` + `docs/MVP-GABINETE-SCOPE.md` com 15 user stories priorizadas (MoSCoW).

### Fase 1 — Fundações do Gabinete (Semanas 1–3) — MVP USÁVEL

**Sprint 1.1 — Clientes 360 + Colaboradores (sem. 1)**
- [ ] Collection `clientes_gabinete` + migração: cada `EmpresaRecord` vira um cliente_gabinete (script one-off)
- [ ] UI `/gabinete/clientes`: tabela com pesquisa, filtros (responsável, estado, regime), criar/editar/arquivar
- [ ] `colaboradores`: convite por email (Firebase Auth invite), cores, avatar
- [ ] Ligação bidireccional: da ficha 360 consegues abrir simuladores desse cliente (link `EmpresaRecord`)

**Sprint 1.2 — Tarefas & Obrigações (sem. 2)**
- [ ] Modelo `tarefas` + `obrigacoes` (catálogo fiscal PT 2026: IVA, PPC, SS, retenção, IES, Modelo22)
- [ ] Gerador automático: ao criar/editar cliente (fat, regime, território) → cria instâncias de obrigações do ano com vencimentos correctos (usar `profileRules.ts` + tabela OE)
- [ ] UI `/gabinete/tarefas`: board Kanban + lista + filtro "Só minhas / Só atrasadas"
- [ ] UI `/gabinete/obrigacoes`: calendário mensal (recharts ou lista), badges por estado, acção "Marcar como entregue"
- [ ] Notificações: badge + email diário 08:00 "Tens 3 obrigações a vencer hoje" (Cloud Function + Firestore trigger)

**Sprint 1.3 — Cofre de Senhas (sem. 3)**
- [ ] Criptografia client-side: `lib/cofreCrypto.ts` (PBKDF2 + AES-GCM), testes unitários com `inputGuards.test.ts` como modelo
- [ ] UI `/gabinete/cofre`: lista por cliente/categoria, pesquisa, criar/editar, "Revelar" pede password Firebase re-auth, copiar com toast, audit log
- [ ] Regra dura: sem chave, sem leitura — nem tu como admin vês o segredo em plain
- [ ] **Entregável Fase 1:** Recofatima consegue migrar 10 clientes reais, atribuir tarefas à nova colaboradora de Setembro, e guardar 20 acessos com segurança. Demo gravada.

### Fase 2 — Completar o que ficou pendente (Semana 4) — SEMANA DE FECHO

- [ ] **S2 — Cenários elegíveis:** refinar `EnquadramentoCompleto.tsx` + `enquadramento2026.ts` para **só renderizar cenários elegíveis** (A1-A6/B1-B6), com toggle "Mostrar também inelegíveis (cinzento + motivo)". Adicionar secção "Poupança fiscal vs Tesouraria" já pedida.
- [ ] **S3 — PPC 2 botões:** em `PreviSaSimulator.tsx` criar bloco dedicado: `Atualizar PPC (art. 105º)` (lê Modelo22 anterior, calcula base, aplica 80/95%, divide por 3, arredonda por excesso, mostra jul/set/dez) + `Simular limitação 3º PPC (art. 104º/107º)` (input "coleta esperada" → limita). Guardar em `previsa.ppc*`.
- [ ] **S4 — Excel honorários:** `lib/previsaExcel.ts` já existe — duplicar padrão para `lib/honorariosExcel.ts` + botão em `OfficeSettingsView.tsx` "Exportar tabela de honorários"
- [ ] **S1 — e-fatura:** confirmar com Sandrine se quer mesmo ligação AT ou se SAF-T chega; se sim, especificar OAuth AT (fora do MVP — deixar documentado).
- [ ] Testes: `npm run test` + `previsa.test.ts` + `enquadramento2026.test.ts` já cobrem — acrescentar casos PPC.

### Fase 3 — Documentos, Acessos, Dashboard (Semanas 5–6)

- [ ] **Documentos:** Firebase Storage por `gabinete/{officeId}/documentos/{clienteId}/{file}` + UI `/gabinete/documentos` (upload drag-drop, preview PDF, versão, SAF-T re-import)
- [ ] **Dashboard `/gabinete`:** 4 KPIs topo (tarefas hoje, obrigações vencidas, clientes sem tarefa há 30d, cofre sem acesso há 90d) + lista "Próximos 7 dias" + atalhos "Nova tarefa / Novo cliente / Guardar senha"
- [ ] **Ficha 360 completa:** tabs Dados | Tarefas | Obrigações | Documentos | Acessos (cofre filtrado por cliente) — tudo numa só página, sem saltos
- [ ] **Pesquisa global:** `Cmd+K` que procura em clientes, tarefas, obrigações, cofre (só títulos, nunca segredos)

### Fase 4 — Site + Loja + Billing (Semanas 7–8)

- [ ] **Site público** (já tens `LandingPage.tsx` — estender): `/`, `/funcionalidades`, `/precos`, `/contacto` — copy para contabilistas (não para empresários), SEO básico
- [ ] **Loja/licenças:** Stripe Checkout (preço por gabinete/mês, ex: 49€ base + 2€/cliente activo acima de 20) ou manter simples (um plano) — validar com Sandrine
- [ ] **Onboarding:** wizard "Importa os teus clientes (Excel/CSV) → Cria colaboradora → Guarda primeira senha"
- [ ] **Billing portal:** cliente vê facturas, gere licenças, cancela

### Fase 5 — Piloto Recofatima + Venda (Semana 9)

- [ ] Migrar 30–50 clientes reais da Recofatima (ela fornece Excel)
- [ ] Formação 1h presencial/Meet: Sandrine + Ana + nova colaboradora (Setembro) — gravar Loom para futuros clientes
- [ ] Recolher 10 feedbacks, corrigir top 5 bugs, congelar v1.0
- [ ] **Primeira venda externa:** usar case Recofatima como prova social no site

---

## 6. Detalhamento funcional — user stories (MVP Fase 1)

**Como contabilista, quero…**
- … ver de manhã numa só página o que vence hoje e o que está atrasado (dashboard)
- … atribuir "Entregar IVA Julho — Cliente X" à Ana, com prazo 15-Ago, e ver quando ela marca como feito
- … que o sistema crie sozinho as obrigações de IVA/PPC/SS quando crio o cliente com 90k de faturação e IVA trimestral
- … guardar "AT — Cliente Y — NIF 123 / senha ***" e que só quem tem permissão veja, com log de quem viu
- … pesquisar "Recofatima" e ver tudo: dados, tarefas, obrigações, documentos, senhas
- … no telemóvel, marcar uma tarefa como feita enquanto estou no cliente

**Como dona do gabinete, quero…**
- … ver quem está sobrecarregado (tarefas por colaborador)
- … arquivar cliente sem apagar histórico
- … exportar honorários para Excel e enviar proposta

**Como nova colaboradora (Setembro), quero…**
- … entrar e ver só as minhas tarefas, sem me perder

---

## 7. Dados, segurança e RGPD

- Cofre: **zero-knowledge** — chave derivada da password do utilizador (nunca enviada). Se perder password, perde cofre (avisar no onboarding).
- Firestore: regras por `officeId` (tenant), `colaboradores` com `role` para filtrar leituras depois.
- RGPD: checkbox "Cliente consentiu arquivo digital" na criação; botão "Exportar dados do cliente" (JSON+docs) e "Apagar cliente (hard delete)".
- Backups: export semanal `empresas` + `gabinete` para Storage (Cloud Function cron).

---

## 8. Modelo de parceria — 3 cenários para levar à reunião

> Sandrine propôs "% sobre vendas" sem número. Levas 3 opções, todas com **site+loja incluídos** e tu como **parceiro técnico**.

| Cenário | % para ti | O que inclui | Quando faz sentido |
|---------|-----------|--------------|--------------------|
| **A. Sócio técnico (recomendado)** | **20–25% receita líquida recorrente** (após Stripe/IVA) enquanto fores mantenedor | Tu fazes produto + evolução + suporte técnico; ela faz comercial + suporte contabilístico + marca | Se ela quer mesmo escalar e tu ficas longo prazo |
| **B. Comissão de lançamento** | **30% nos primeiros 12 meses por cliente que tu trouxeres**, depois 10% residual | Tu ajudas a vender no início | Se ela vai vender sozinha mas quer motivar-te na tracção inicial |
| **C. Híbrido fixo + %** | **500€/mês fixo + 10% recorrente** | Garante cash-flow enquanto o MRR não chega | Se precisas de estabilidade (ela já te deve valor — mencionou "valor não está esquecido") |

**Notas para negociar:**
- Define **MRR mínimo** para rever % ao fim de 6 meses.
- Define **quem paga Stripe, Firebase, domínio, Cloudflare** (sugestão: sai da receita antes da divisão).
- Contrato novo substitui o antigo mas **mantém o que já foi pago** — sem retroactivos.
- Tu manténs **IP do código** até atingir X MRR, depois licença partilhada (evita ficares refém).

Leva impresso `docs/PROPOSTA-PARCERIA-ESTUDO360.md` com os 3 cenários + simulação: 20 clientes × 49€ = 980€ MRR → 20% = 196€/mês para ti (+ crescimento).

---

## 9. Cronograma visual

```
Sem 0 (esta semana)  ████ Discovery + auditoria CRMContab + reunião Sandrine
Sem 1                ████ Clientes 360 + Colaboradores
Sem 2                ████ Tarefas + Obrigações (gerador fiscal)
Sem 3                ████ Cofre cifrado → MVP usável (demo Recofatima)
Sem 4                ████ Fecho specs pendentes (cenários + PPC + Excel)
Sem 5-6              ████ Documentos + Dashboard + Ficha 360 completa
Sem 7-8              ████ Site + Loja + Billing (Stripe)
Sem 9                ████ Piloto 50 clientes + formação + 1ª venda
```

**Carga:** ~15–20h/semana no teu horário 18:30–21:00 + sábado manhã (já combinado com a Sandrine). Se precisares de acelerar, corta Fase 3 (documentos) para depois da 1ª venda.

---

## 10. Próximos passos — ESTA SEMANA (checklist)

- [ ] **Amanhã:** entrar no CRMContab (Admin/123), gravar Loom, preencher `AUDITORIA-CRMCONTAB.md`
- [ ] **Até 4ª:** marcar reunião 1h com Sandrine + Ana (proposta: 5ª ou 6ª manhã — já tens disponibilidade)
- [ ] **Levar para a reunião:** este plano impresso + 3 cenários de % + demo do que já existe (mostrar Previsa + Enquadramento)
- [ ] **Pedir à Sandrine:** Excel com 5 clientes exemplo (nome, NIF, fat, regime, território) + lista de obrigações que hoje falha
- [ ] **Decidir %:** na reunião, fechar cenário A/B/C e assinar adenda ao contrato
- [ ] **Criar branch:** `feat/gabinete-v2` e abrir `docs/MVP-GABINETE-SCOPE.md` com as 15 user stories

---

## 11. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Sandrine sem tempo (já aconteceu em Junho/Julho) | MVP em 3 semanas com valor visível; reunião curta e objectiva; Loom async se não puder |
| Cofre é sensível — erro = perda de confiança | Criptografia testada + audit log + nunca fazer "mostrar tudo" |
| Scope creep ("faz também isto") | Congelar Fase 1; tudo o resto vai para backlog priorizado com ela |
| Firebase custos com 100 gabinetes | Firestore + Storage são baratos até 10k docs; monitorar com `firebase usage` semanal |
| Concorrência CRMContab reage | Vantagem é UX + Previsa único — não tentar copiar tudo, só o que dói |

---

## 12. Definição de "feito" por fase

- **Fase 1:** 10 clientes migrados, 20 tarefas criadas, 5 senhas cifradas, demo sem bugs críticos, Sandrine diz "usava já".
- **Fase 2:** testes `npm run test` verdes, PPC com 2 botões e 3 prestações correctas, Excel honorários descarrega.
- **Fase 5:** 1 gabinete externo a pagar (mesmo que seja amigo com desconto) — prova de venda.

---

*Próximo ficheiro a criar: `docs/AUDITORIA-CRMCONTAB.md` após login no CRMContab.*
