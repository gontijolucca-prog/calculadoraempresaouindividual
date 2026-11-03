# Exportações em uma folha A4

Estado revisto em 03/11/2026. Este documento substitui o relatório intermédio
de 26/10.

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
| Proposta de honorários | 1 página A4 |
| Minuta resumida de contrato | 1 página A4; versão integral em Word |
| Mapas de Controlo e RH | 1 página A4 horizontal |
| DR, Balanço, Fluxos, Alterações e pacote de DF | 1 página A4 por documento |
| Ata, declaração e documentos de fecho | 1 página A4 por documento |

## Verificação obrigatória

- `scripts/audit-sim-pdfs.mjs`
- `scripts/audit-pkg-pdfs.mjs`
- `node --import tsx scripts/audit-minuta-resumo.mjs`
- `scripts/audit-word-pdfs.mjs`
- `scripts/audit-pdf-portability.mjs`
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
