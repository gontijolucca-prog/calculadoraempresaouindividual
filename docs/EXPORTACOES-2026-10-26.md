# Exportações em uma folha A4

Estado revisto em 03/11/2026. Este documento substitui o relatório intermédio
de 26/10.

Revisão visual e funcional: os 26 PDFs exportáveis estão reunidos em
`public/exemplos-exportacoes-2026-11-03/index.html`. O catálogo técnico em
`catalogo.json` confirma, para cada ficheiro, uma página, formato A4, tamanho e
hash.

## Regra do produto

Todos os documentos exportáveis pelo Estudo360 devem:

- ocupar uma única folha A4;
- incluir identificação do escritório e do cliente quando aplicável;
- mostrar os dados calculados, o enquadramento fiscal e a base legal;
- indicar valores em falta sem inventar dados;
- manter hierarquia, contraste e legibilidade no PDF;
- preservar metadados e não depender de uma segunda página.

Quando o conteúdo exceder a folha, o documento é condensado ou resume linhas
secundárias com uma nota explícita. Nunca deve truncar informação sem aviso.

## Cobertura

| Grupo | Estado |
|---|---|
| 11 relatórios de simulação | 1 página A4 por relatório |
| Ficha de simulação e Ficha 360 do gabinete | 1 página A4 cada |
| Quadro de obrigações, Mapa de Controlo e Mapa RH | 1 página A4 cada |
| Proposta de honorários, minuta resumida e proposta comercial | 1 página A4 cada |
| DR, Balanço, Fluxos e Alterações no Capital Próprio | 1 página A4 cada |
| Demonstrações Financeiras — Síntese | 1 página A4 |
| Ata e Declaração de Responsabilidade | 1 página A4 cada |

## Verificação obrigatória

- `scripts/audit-sim-pdfs.mjs`
- `scripts/audit-pkg-pdfs.mjs`
- `node --import tsx scripts/audit-minuta-resumo.mjs`
- `scripts/audit-word-pdfs.mjs`
- `scripts/audit-pdf-portability.mjs`
- `node scripts/audit-exportacoes-extra.mjs`
- `node scripts/montar-exemplos-exportacoes.mjs`
- inspeção visual do PDF final em desktop e telemóvel

Os testes exigem `paginasFinais() === 1`, MediaBox A4, texto extraível e ausência
de campos por preencher quando o documento já tem dados suficientes.

## Limites

- Escalas demasiado pequenas não são aceitáveis: a alternativa é condensar o
  documento, não reduzir texto até ficar ilegível.
- Um documento não pode declarar que está completo se faltarem dados essenciais;
  deve identificar objetivamente o que falta.
- O dossier SVAT é uma coleção documental própria e está documentado em
  `docs-candidatura-svat/README.md`.
