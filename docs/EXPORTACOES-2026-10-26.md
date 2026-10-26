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

## Falta (ordem de execução)
1. **11 simuladores**: cada um tem um formulário em 2 passos; o PDF só existe depois de preencher e calcular. É preciso um guião por ferramenta (valores de teste → "Continuar" → "Descarregar PDF") e confirmar 1 folha.
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
