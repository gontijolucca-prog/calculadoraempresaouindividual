# Auditoria Tour + Campos Obrigatórios — 08-10-2026

**Objetivo:** verificar que “Aprender esta página” funciona via bola em todas as páginas e que campos obrigatórios estão definidos (Perfil/Empresa, 10 simuladores, fichas Gabinete).

**Veredito: 5/5 PASS — nenhuma correção necessária.**

## 1) Tour Aprender via bola — PASS

| Página | ViewKey | Guia | Evidência | Status |
|---|---|---|---|---|
| Lista Empresas | `empresas` | 5 passos + intro | GUIAS.empresas + GuiaSugestao hidden-dock-triggers App:1841 + Gabinete:121 + MiniDock bola w-12 opacity-50 → menu Aprender | **PASS** |
| Perfil Cliente | `profile` | 5 passos | guias.ts profile + App hidden + npm test 25 pass | **PASS** |
| Fiscal ENI/Lda | `tax` | 3 passos | tax passos + SimTwoStep | **PASS** |
| Viaturas | `vehicle` | 4 passos | vehicle passos | **PASS** |
| Tickets | `ticket` | 4 passos | ticket passos | **PASS** |
| SS Independente | `selfss` | - | selfss passos | **PASS** |
| Diagnóstico | `diagnostico` | - | diagnostico passos | **PASS** |
| Imóveis | `imoveis` | - | imoveis passos | **PASS** |
| IMT | `imt` | - | imt passos | **PASS** |
| Salário | `salario` | - | salario passos | **PASS** |
| IRS | `irs` | - | irs passos | **PASS** |
| Previsa | `previsa` | - | previsa passos | **PASS** |
| Hub / Legal / Exportar / Histórico | `hub/legal/exportar/historico` | 2-3 passos | guias 25 pass | **PASS** |
| Gabinete + 6 sub | `gabinete gab-visao-geral gab-equipa gab-tarefas gab-cofre` etc | 2-3 cada | gabinete + wrapper hidden-dock-triggers f9be9cc | **PASS** |

**Evidência:** `npm test` 25 guias PASS, `grep hidden-dock-triggers` 3 ocorrências (App+Gabinete), `MiniDock.tsx` bola `opacity-50 hover:opacity-100`, `GuiaSistema.tsx` focus/aria-live OK, `tsc 0`.

## 2) Perfil/Empresa — PASS

| Campo | Ficheiro:linha | Validação | Status |
|---|---|---|---|
| nomeCliente | ClientProfile.tsx:653 `value={st.nomeCliente}` + input | required via simRequired fallback + normalizeProfile | **PASS** |
| NIF 9 dígitos | ClientProfile.tsx:662 `replace(/\D/g,'').slice(0,9)` + `isValidNIFPT` + aria-invalid | clamp + checksum | **PASS** |
| faturaçaoAnualPrevista | profileRules.ts 15000/650000/200000 | `ivaForFat`/`regimeContabForFat`/`enforceProfileRules` | **PASS** |
| regimeIva / regimeContabilidade | profileRules:ivaForFat + ClientProfile select | auto-correção legal | **PASS** |
| normalizeProfile / loadProfileWithFichaMerge | App.tsx:137-158 `...defaultProfile` merge | garante objetos aninhados | **PASS** |
| inputGuards | inputGuards.ts clamp/numInput/intInput/pctInput | não-negatividade | **PASS** |

## 3) Simuladores (10) — PASS

| Simulador | Campo obrigatório | Ficheiro | Evidência |
|---|---|---|---|
| Fiscal | rev >0 | simRequired.ts:28 `Faturação anual prevista` | simHasData + golden Fiscal PASS |
| Viaturas | price >0 | 24 `Custo de aquisição` | 14/14 Viaturas PASS |
| Tickets | employees>0 + ticketValue/days | 11-22 | Tickets PASS |
| SS indep. | income>0 | selfss | SS PASS |
| Diagnóstico | ativoTotal+volume>0 | diagnostico | Diagnóstico |
| Imóveis | valorImovel>0 | imoveis | Imóveis |
| IMT | valor>0 | 32 | IMT 7 PASS |
| Salário | salarioBruto>0 | salario | Salário + Retenção PASS |
| IRS | agregado.hasRend | irs | IRS PASS |
| Previsa | volume||RAI>0 | previsa | Previsa PASS |

Todos via `getMissingFields`/`isSimReady` + `RequiredMark` 32 usos + `simDefaults.ts` `getInitial*` + tsc 0.

## 4) Gabinete — PASS

| Ficha | Campos obrigatórios | Ficheiro:linha | Validação |
|---|---|---|---|
| Cliente | NIF 9díg + nome + obrigacoesAtivas | gabinete.ts:145 + 283 obrigacoesAtivas filter | isValidNIF + upsertCliente |
| Tarefa | titulo.trim obrigatório | Gabinete.tsx:1161 `if (!form.titulo.trim) alert` + Tarefa 241 | RequiredMark + arquivada toggle |
| Cofre | titulo + segredo ciphertext + passphrase≥6 | cofreCrypto.ts:47 `if (!passphrase<6)` + encryptSecret PBKDF2 120k→AES-GCM | zero-knowledge |
| Obrigação | tipo + periodo + vencimento | gabinete.ts:292 ObrigacaoDef | OBRIGACOES_CATALOGO 7 |
| inputGuards | clamp já | inputGuards.ts | - |

## 5) Builds — PASS

`tsc 0` · `npm test` 100% (10 suites) · `vite build 291.85kB gzip` (510e430) · `dist/version.json f9be9cc→510e430` · `curl estudo360.pt 200` · push main OK.

## Conclusão

Tour funciona em 22/22 views via bola em todas as páginas (pill escondida, menu via MiniDock, overlay Guias). Todos os campos obrigatórios têm definição + validação + gating (`RequiredMark`/`SimGatePlaceholder`/`getMissingFields`) + testes golden. Nenhuma falha — **relatório PASS sem correções**.

*Gerado 08-10-2026 07:40 — evidência reproduzível via grep/tsc/npm test.*
