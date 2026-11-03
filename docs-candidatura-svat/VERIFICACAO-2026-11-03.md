# Verificação do dossier SVAT - 03/11/2026

## Factos confirmados

- A Portaria n.º 293/2017 cria o SVAT para programas de contabilidade quanto à
  produção do ficheiro SAF-T (PT).
- O artigo 3.º contém nove funcionalidades, de a) a i).
- Os requisitos h) e i) exigem exportação correta e conteúdo integral do SAF-T
  de contabilidade.
- A AT dispõe de 30 dias, após o pedido, para notificar os elementos necessários
  aos testes.
- O selo atribuído tem validade de 24 meses.
- O percurso oficial indicado pela AT é e-balcão → Outras Obrigações → SVAT →
  Submissão.

## Estado do Estudo360

- Importa e conserva XML SAF-T.
- Extrai dados para perfil, contabilidade e simuladores.
- Permite consultar os dados importados por cliente.
- Não mantém diário, razão, balancete nem lançamentos contabilísticos.
- Não gera nem exporta SAF-T de contabilidade.

## Resultado

| Requisitos | Estado |
|---|---|
| a) a g) | Cobertura parcial, com um requisito documental implementado |
| h) | Não implementado |
| i) | Não implementado |

## Validação técnica dos PDFs

O gerador `scripts/gerar-pacote-svat.py` produz 12 PDFs. A verificação exige:

- exatamente uma página A4 por documento;
- texto extraível e suficiente;
- ausência de alegações proibidas;
- renderização PNG para inspeção visual.

## Ações humanas pendentes

- Confirmar representante legal, assinante, morada e contactos.
- Confirmar a versão final a indicar à AT.
- Submeter o pedido de classificação e guardar o comprovativo.
- Decidir os próximos passos apenas depois da resposta oficial.
