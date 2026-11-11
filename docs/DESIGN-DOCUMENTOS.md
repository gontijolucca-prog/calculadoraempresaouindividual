# Desenho dos documentos — referências e regras (11/11/2026)

> O cliente pediu documentos redesenhados com base em exemplos reais, não em
> imaginação. Estas são as referências escolhidas, o que foi retirado de cada
> uma e o que já está aplicado nos 26 PDFs.

## Referências

| # | Referência | O que foi retirado |
|---|---|---|
| 1 | **Sameer Africa Annual Report 2024** — The Baobab Collective (relatório anual de empresa cotada, com demonstrações financeiras densas) | Tipografia de tabelas financeiras: altura de linha constante, números alinhados à direita, totais destacados e legíveis por quem audita |
| 2 | **GFH Annual Report 2025** — Unisono | Grelha assimétrica a duas colunas (narrativa à esquerda, números à direita), micro-rótulos com tracking, filetes alinhados à base do texto |
| 3 | **pdfs.build — Swiss Grid / Ledger Rail / Quiet Slip** (documentos de consultoria compilados, não mockups) | Móveis de página fixos (cabeçalho e rodapé que nunca mudam), numeração de secções, hierarquia type-led sem caixas nem sombras |
| 4 | **ACCA Integrated Report** — Everyone; identidade **Mazars** (Halyard) | Rigor de contabilidade: uma cor de acento, tipografia grotesca, zero decoração — o documento parece um documento, não um dashboard |

## Regras aplicadas (`src/lib/reportPdf.ts`, `src/lib/pdfTheme.ts`)

1. **Grelha**: A4, margem 16 mm; zona de rótulos à esquerda e valores à direita; sem caixas flutuantes.
2. **Secções numeradas**: `01`, `02`, … em acento, título em maiúsculas com tracking, filete de 0,35 pt a partir do número.
3. **Escala tipográfica**: título 21 pt → corpo 8,8–10 pt → rótulos 6,2 pt (saltos de ~3×, nunca 1,5×).
4. **Tabelas**: linhas alternadas em `#F7FBFF`; linha de total com **regra dupla** e negrito; valores sempre à direita.
5. **Bloco do cliente**: rótulo pequeno + valor grande, separado por filete — deixou de ser uma caixa arredondada.
6. **Rodapé fixo**: nota legal à esquerda; escritório e `página / total` à direita (a página atual em acento).
7. **Paleta**: azul `#0677FF` como único acento, tinta `#003B8F`, restantes tons claros derivados de branco. Zero verdes/vermelhos/laranjas.

## Prova

- `npm run audit:pdf-palette` → **0 falhas em 26 PDFs**.
- Amostra gerada fora do browser: 1 página A4, 3 secções numeradas, totais com regra dupla.

## Também entregue

- **Capa do «Pacote cliente»** (`src/PacoteCapa.tsx`): espinha de acento, título grande, cliente, NIF/ano, conteúdo e rodapé. Documento próprio no menu do pacote.
- **Mini-gráficos de barras** (`barras()` em `src/lib/wordDocs.ts`): Resultados (vendas, gastos, líquido) e Fluxos (operacional, investimento, financiamento). Uma cor, sem eixos, valores à direita.
