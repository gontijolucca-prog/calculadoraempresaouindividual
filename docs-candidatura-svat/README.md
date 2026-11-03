# Candidatura SVAT - Estudo360

**Revisão:** 03/11/2026

## Estado

Não existe candidatura submetida, selo atribuído, aprovação da AT nem parecer
de conformidade. O primeiro passo é pedir à Autoridade Tributária a
classificação do Estudo360.

A Portaria n.º 293/2017 aplica o SVAT a programas de contabilidade quanto à
produção do SAF-T (PT). O Estudo360 importa e conserva SAF-T, mas não mantém
escrituração nem exporta o SAF-T de contabilidade. Por isso, os requisitos h)
e i) estão marcados como **não implementados**.

## Documentos

| # | Ficheiro | Finalidade |
|---|---|---|
| 00 | `00-CAPA.pdf` | Identificação do dossier |
| 00 | `00-INDICE.pdf` | Ordem dos documentos |
| 00 | `00-LEIA-PRIMEIRO.pdf` | Estado e próxima ação |
| 01 | `01-Memoria-Descritiva.pdf` | Âmbito real do produto |
| 02 | `02-Matriz-Conformidade.pdf` | Requisitos a) a i), sem inflação |
| 03 | `03-Dicionario-Dados.pdf` | Coleções, campos e acessos |
| 04 | `04-Checklist-Submissao.pdf` | Pronto / pendente |
| 05 | `05-Guia-E-balcao-Passo-a-Passo.pdf` | Percurso oficial |
| 06 | `06-Texto-Pronto-para-colar.pdf` | Pedido de classificação |
| 07 | `07-Declaracao-Produtor.pdf` | Minuta condicionada, por preencher |
| 08 | `08-Identidade-e-Uso.pdf` | Regras de comunicação |
| 09 | `09-Anexos-Tecnicos.pdf` | Controlos e limitações |

## Próxima ação

1. Confirmar representante legal, assinante, endereço e contactos oficiais.
2. Entrar no Portal das Finanças.
3. Abrir **e-balcão → Outras Obrigações → SVAT → Submissão**.
4. Adaptar o texto de `06-Texto-Pronto-para-colar.txt`.
5. Anexar os documentos 01, 02, 03, 06 e 09.
6. Guardar o comprovativo e registar a resposta da AT.

Não apresentar o Mod. 334 como candidatura enquanto o enquadramento não estiver
confirmado. Não usar o logótipo, nome ou selo da AT antes de uma atribuição
oficial.

## Fontes

- [Selo de Validação AT (SVAT)](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Negocios/Faturacao/SAF_T_PT/SVAT/Paginas/default.aspx)
- Portaria n.º 293/2017, de 2 de outubro
- Mod. 334.1 e respetivas instruções de preenchimento

## Regeneração

Os PDFs são produzidos por `scripts/gerar-pacote-svat.py` com ReportLab e
validados com PyMuPDF: uma página A4 por documento, texto extraível e render
visual. A cópia pública é sincronizada para `public/docs-candidatura-svat`.
