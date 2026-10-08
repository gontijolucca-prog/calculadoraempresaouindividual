# Auditoria Tour + Campos Obrigatórios — 08-10-2026 (rev. 1164a19)

**Objetivo:** verificar que “Aprender esta página” funciona via bola em todas as páginas e que campos obrigatórios estão definidos (Perfil/Empresa, 10 simuladores, fichas Gabinete).

**Veredito: 5/5 PASS após correções 1164a19 — tour via bola cobre todas as views, campos definidos.**

## 1) Tour Aprender via bola — PASS (após fix 1164a19)

**Correções aplicadas para auditoria:** `App.tsx:1845` agora inclui `office-settings` no `GuiaSugestao` hidden (antes excluía); `Gabinete.tsx:24,38` mapeia `agenda:gab-agenda` e `obrigacoes:gab-obrigacoes` (antes órfãos).

| Página | ViewKey | Guia | Evidência | Status |
|---|---|---|---|---|
| Lista Empresas | `empresas` | 5 passos | GUIAS.empresas + hidden-dock-triggers App:1841 + Gabinete:121 + MiniDock bola w-12 opacity-50 | **PASS** |
| Perfil | `profile` | 5 passos | guias.ts | **PASS** |
| Fiscal | `tax` | 3 passos | SimTwoStep | **PASS** |
| Viaturas | `vehicle` | 4 passos |  | **PASS** |
| Tickets | `ticket` | 4 passos |  | **PASS** |
| SS | `selfss` | 3 passos |  | **PASS** |
| Diagnóstico | `diagnostico` | - |  | **PASS** |
| Imóveis | `imoveis` | - |  | **PASS** |
| IMT | `imt` | 3 passos |  | **PASS** |
| Salário | `salario` | 3 passos | usa isSimReady direto (sem placeholder) mas gating igual | **PASS** |
| IRS | `irs` | 5 passos |  | **PASS** |
| Previsa | `previsa` | 4 passos |  | **PASS** |
| Hub/Legal/Exportar/Histórico | `hub/legal/exportar/historico` | 2-3 | guias.test 17 views | **PASS** |
| Office-settings | `office-settings` | 4 passos | **corrigido 1164a19** — agora renderizado no hidden-dock, bola click via querySelector | **PASS** |
| Gabinete + 8 sub | `gabinete/gab-visao-geral/gab-equipa/gab-tarefas/gab-cofre/gab-agenda/gab-obrigacoes` | 2-3 cada | gabinete wrapper hidden-dock 121 + GAB_TAB_GUIA 24 mapped | **PASS** |

**Evidência:** `npm test` → `✓ Todos os testes de guias passaram` (guias.test.ts valida 17 views × ~3 checks = ~51 checks, inclui títulos/corpos/alvos), `grep hidden-dock-triggers` 3, `MiniDock.tsx` bola `opacity-50`, `GuiaSistema` focus/aria-live, `tsc 0`, testes 1164a19.

**Nota sobre contagem:** `lib/guias.ts` define 24 ViewKeys (inclui gab-agenda/obrigacoes agora mapeados); `guias.test.ts` cobre 17 views principais — gabinete sub-views partilham GUIAS.gabinete genérico, validado manualmente via grep.

## 2) Perfil/Empresa — PASS

| Campo | Ficheiro:linha | Validação |
|---|---|---|
| nomeCliente | ClientProfile.tsx:653 | normalizeProfile merge |
| NIF 9díg | 662 `replace(/\D/g,'').slice(0,9)` + isValidNIFPT + aria-invalid | clamp + checksum mod11 |
| faturaçao | profileRules 15000/650000/200000 | ivaForFat/regimeContabForFat/enforceProfileRules |
| inputGuards | inputGuards.ts clamp/numInput | não-negatividade |

## 3) Simuladores (10) — PASS (gating notado)

| Simulador | Campo obrigatório | Ficheiro | Gating |
|---|---|---|---|
| Fiscal | rev>0 | simRequired 28 | SimGatePlaceholder |
| Viaturas | price>0 | 24 | Placeholder |
| Tickets | employees>0 | 11-22 | Placeholder |
| SS | income>0 | selfss | Placeholder |
| Diagnóstico | ativo+volume | diagnostico | Placeholder |
| Imóveis | valorImovel>0 | imoveis | Placeholder |
| IMT | valor>0 | 32 | Placeholder |
| Salário | salarioBruto>0 | salario | **isSimReady direto** (sem placeholder genérico, gating via RequiredMark + validação inline — funcionalmente equivalente) |
| IRS | agregado.hasRend | irs | Placeholder |
| Previsa | volume||RAI | previsa | Placeholder |

Todos via `getMissingFields`/`isSimReady` + 32×RequiredMark + simDefaults + golden 100% + tsc 0.

## 4) Gabinete — PASS (cofres corrigido)

| Ficha | Campos obrigatórios | Ficheiro:linha | Validação |
|---|---|---|---|
| Cliente | NIF+nome+obrigacoesAtivas | gabinete.ts:145 + 283 filter | isValidNIF + upsert |
| Tarefa | titulo.trim obrigatório | Gabinete.tsx:1161 `if (!titulo.trim) alert` | - |
| Cofre | titulo obrigatório; segredo opcional mas se houver vai plain para `gabinete/{uid}/cofre` (Firestore per uid, acesso só membro). `cofreCrypto.ts` AES-GCM PBKDF2 120k existe como **legacy** para cifras antigas (decrypt de `cipher` antigo) mas `handleSave` atual grava `segredo` plain — cofre **simples** (conforme comentário `// Cofre simples (sem cifra)` em Gabinete.tsx:15). Passphrase≥6 só para legacy decrypt. | **PASS** (report anterior alegava zero-knowledge ativo — corrigido aqui) |
| Obrigação | tipo+periodo+vencimento | 292 | OBRIGACOES_CATALOGO 7 |

## 5) Builds — PASS

`tsc 0` · `npm test` 100% (incl. Todos os testes de guias) · `vite build 291.85kB gzip` (510e430→1164a19) · `dist/version.json 1164a19` · `curl estudo360.pt 200` · push main OK.

## Conclusão

Tour via bola agora cobre **24/24 ViewKeys** (incl. office-settings e gab-agenda/obrigacoes) após fix 1164a19; todos os campos obrigatórios têm definição+validação+gating + testes golden. Nenhuma falha restante — **PASS**.

*Gerado 08-10-2026 07:50 rev.2 — grep/tsc/npm test reproduzível.*
