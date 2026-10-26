# Plano consolidado — Propostas (Estudo360 + Gamma) e Exportações

Decisões fechadas com o Lucca em 26/10/2026 (Ask-User, 3 rondas).

## 1. Propostas: dois caminhos, escolha obrigatória
- Ao clicar em **Nova proposta** abre um **ecrã de escolha** com dois cartões:
  1. **Gerar no Estudo360** (editor + link público + PDF)
  2. **Levar para o Gamma** (texto pronto para colar)
- Não há caminho por omissão: uma escolha tem de ser feita.
- Ambos usam **a mesma estrutura e as mesmas 4 perguntas** — uma só verdade, duas saídas.

## 2. Personalização (tailored)
Inputs, por esta ordem:
1. **Perfil do cliente** (tipo de entidade, regime de IVA, atividade, faturação, funcionários).
2. **Serviços contratados/pretendidos** (tabela de honorários).
3. **4 perguntas**, pré-preenchidas com o que já existe e editáveis:
   - **Setor** (ex.: restauração, construção, clínica)
   - **Dimensão** (nº de pessoas)
   - **Faturação anual**
   - **Objetivo** a 12 meses (o que quer resolver primeiro)
4. Tom: formal por "você" (regra do site).

## 3. Estrutura da proposta (4–6 páginas)
1. Capa (escritório, cliente, data, referência)
2. **Diagnóstico do cliente** (setor, dimensão, enquadramento, riscos)
3. **Âmbito por serviço** (o que está incluído, o que não está)
4. **Equipa e prova** (quem acompanha, experiência, testemunhos)
5. **Investimento** (preço do motor de honorários + IVA + condições)
6. **Plano de arranque** (primeiros 30/60/90 dias)
7. Próximo passo + contactos

## 4. Preço
- Sempre de `calcularProposta()` (tabela do escritório).
- Pode haver **ajuste manual** (desconto/acréscimo) com **registo de auditoria**:
  quem alterou, quando, valor anterior e novo, motivo.
- A AI nunca escreve preços.

## 5. Formato
- Proposta comercial: **3–8 páginas** (exceção assumida à regra de 1 folha).
- Documentos internos (relatórios, mapas, pacote, Word, ficha): **1 folha A4**.

## 6. Gamma
- Mesmas 4 perguntas e mesma estrutura (não a cópia Ativiwise de 10 páginas).
- Botão gera o texto com os blocos acima e abre `gamma.app` para colar.
- Sem API/chave: custo zero.

## 7. Ordem de execução acordada
1. **Acabar exportações** (11 simuladores, Word/pacote, deck, ficha, auditoria dos 21 documentos).
2. **Depois** implementar os dois caminhos de proposta.

## 8. Critérios de aceitação (propostas)
- Escolha obrigatória aparece e não deixa avançar sem selecionar.
- As 4 respostas ficam guardadas por cliente e são reutilizadas.
- Proposta gerada tem 4–6 páginas, com os 7 blocos e o preço real.
- Ajuste de preço fica registado (auditoria) e visível no documento.
- Gamma: o texto contém os mesmos blocos, preço real e respostas do cliente.
- Nenhum preço inventado pela AI (teste automático).

## 9. Estado das exportações (26/10)
Feito e provado: motor jsPDF de 1 folha (escala 1→0.55, trunca com aviso), quadro/mapa a 1 página, zoom de 1 folha na Proposta e Minuta, orbe pulsante.
Falta: PDFs dos 11 simuladores (cada um exige preencher o formulário — guião por ferramenta), documentos Word/pacote (paged.js), deck numa página resumida, ficha de diagnóstico, densidade 70–88% e checklist de informação em falta.
