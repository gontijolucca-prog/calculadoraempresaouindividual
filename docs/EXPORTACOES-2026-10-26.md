# Exportações em 1 folha A4 — estado 26/10/2026

## Já feito e provado
| Item | Estado | Prova |
|---|---|---|
| Motor jsPDF "uma folha" (`src/lib/reportPdf.ts`) | Feito | Reconstrói o documento com escala 1 → 0.55 até caber; trunca com aviso "… mais N registos" em vez de abrir 2.ª página |
| Testes do motor | 6 novos | `paginasFinais() === 1` com 45 linhas, matriz de 120 linhas, relatório curto em escala 1 |
| Mapa/Quadro (Exportar PDF) | 1 folha | `quadro.pdf` 9 382 B, MediaBox A4 paisagem 841,89 × 595,28, 1 página |
| Impressão dos mapas (Imprimir) | 1 folha | provado em 23/10 (`verify-print-map.mjs`) |
| Proposta de Honorários | zoom automático antes de imprimir | `imprimirUmaFolha()` mede a altura e encolhe até 0.45 |
| Minuta de Contrato | idem, piso 0.4 | idem |
| Orbe "A trabalhar em" com pulso | Feito | `verify-orb.mjs` PASS: `orb-pulse` 2 s, gradiente radial, `prefers-reduced-motion` desliga |

## Feito depois do primeiro relatório
| Item | Estado |
|---|---|
| 11 simuladores | **1 página A4 (595,28 × 841,89)** cada, sem "Por preencher" (prova: `scripts/audit-sim-pdfs.mjs`, PDFs em `docs/audit-2026-10-26/pdf/`) |
| Conteúdo dos simuladores | Passaram a levar **Enquadramento da empresa** (tipo, regime, atividade, faturação, funcionários, ano fiscal) e **Escritório** (NIF, cédula/OCC, contactos, morada) |
| Preenchimento automático do teste | `scripts/audit-sim-pdfs.mjs` preenche os formulários (setter nativo do React) e simula cada ferramenta |

## Também já feito
| Item | Estado |
|---|---|
| Proposta de Honorários | 1 página (zoom 0,69; PDF real com 1 página, 98 KB) |
| Minuta de Contrato | 1 página em versão resumida (Partes, Objeto, Serviços, Honorários, Obrigações, Foro, Assinaturas); integral continua em Word |
| 7 documentos Word | 1 página cada (DR, Alterações, Fluxos, Balanço em 0,97; pacote DF em 0,42) |
| Testes | `audit-pkg-pdfs.mjs` PASS · `audit-word-pdfs.mjs` PASS |

## Falta (ordem de execução)
1. ~~11 simuladores~~ feito.
2. ~~Proposta e Minuta~~ feito.
3. ~~7 documentos Word~~ feito.
4. Deck da proposta: passa a ser substituído pela proposta de 7 blocos (3–8 páginas) na fase seguinte.
5. Checkfinal de design/densidade e revisão visual de cada PDF.
2. **Documentos Word (7) e pacote cliente**: hoje passam pelo paged.js, que pagina por desenho; têm de passar pelo mesmo pipeline de escala (ou gerar via jsPDF).
3. **Deck da proposta**: 17 cards → 1 página A4 paisagem resumida (layout novo).
4. **Ficha de diagnóstico** (`#ficha-root`): aplicar o mesmo `imprimirUmaFolha`.
5. **Densidade 70–88% e informação em falta**: checklist por documento (escritório completo, cliente, base legal, contactos) e painel "Falta preencher X".
6. **Auditoria automática dos 21**: `scripts/audit-exports.mjs` (fase 1 pronta; falta o fluxo de cada simulador e dos documentos paginados).

## Como está o motor
- `RelatorioPdf.save()` devolve o fator usado e nunca grava mais de uma página.
- Ao chegar ao piso, tabelas/matrizes resumem o que não coube, com nota visível.
- `imprimirUmaFolha(rootId, { piso })` aplica `zoom` calculado e repõe-no depois.

## Riscos conhecidos
- Escala mínima 0.55 no jsPDF e 0.4–0.45 nos HTML: abaixo disto o texto fica pequeno; a alternativa é a versão condensada (decidir por documento).
- O `paged.js` (terceiros) lança um `TypeError` em `onAtMedia`; não afetou os fluxos testados.

## Verificação automática (27/10)
| Teste | Resultado |
|---|---|
| `audit-sim-pdfs.mjs` | PASS 11/11 (1 página + sem campos em falta) |
| `audit-pkg-pdfs.mjs` | PASS (proposta 1 página; minuta delega no teste próprio) |
| `audit-minuta-resumo.mjs` | PASS (1 página + 7 cláusulas) |
| `audit-word-pdfs.mjs` | PASS 7/7 (1 página cada) |
| `audit-pdf-portability.mjs` | PASS 15/15 (A4, metadados, sem URLs externas, fontes standard/embutidas) |

## Design dos PDFs (27/10)
- Filete dourado `#B06D35` no topo, ponto de secção dourado, título em tinta `#1A1A18`
  e cartão de cliente em bege `#FDFBF7` — alinhado com o site.
- Cabeçalho com logo/360 + nome do escritório; rodapé com aviso legal e contactos.

## Testes com Firebase (emuladores)
```
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
firebase emulators:start --only firestore,auth --project demo-estudo360
VITE_FIREBASE_EMULATORS=1 npm run dev
node scripts/audit-emulator.mjs
```
Resultado: conta criada + email confirmado + gabinete criado + proposta publicada
(slug real) + link público aberto sem login + revogar disponível. PASS.
