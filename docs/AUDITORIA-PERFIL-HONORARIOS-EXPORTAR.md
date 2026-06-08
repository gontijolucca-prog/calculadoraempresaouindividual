# Auditoria — Perfil do Cliente · Honorários · Exportar

Data: 2026-06-08 · Estado: Fase 1. Honorários com testes golden; Perfil/Exportar sem cálculo fiscal.

## Perfil do Cliente
Fonte de dados que alimenta todos os simuladores (6 passos). **Não tem cálculo fiscal** — é entrada de dados com validação.
- **Eixo 4 (o mais importante):** o Perfil é a chave do minimalismo de TODAS as ferramentas. A oportunidade transversal (Fase 2) é **pré-preencher os simuladores a partir do Perfil** (idade, dependentes, estado civil, região, atividade/coeficiente, faturação, balanço) — hoje cada simulador volta a pedir o que o Perfil já sabe.
- **Eixo 6:** KB do `profile` tem as chaves reais e abrangentes. Nota menor: `atividadePrincipal` no KB lista "serviços/bens/mista", mas o motor (`coefFromProfile`) aceita também os códigos do art.31 (vendas_restauracao, servicos_outros, servicos_listados, mining_cripto) — alinhar na Fase 2.

## Honorários (`src/lib/honorarios.ts`)
Calculadora de **proposta de preços do escritório** — não é cálculo fiscal (a única parte fiscal é o IVA 23%, correto).
- ✅ Função pura `calcularProposta`. **3 casos golden** (`src/lib/honorarios.test.ts`): base por entidade + funcionários extra + escalão de faturação + serviços extra + IVA. Todos passam.
- Tabela de preços é configurável pelo escritório (Definições). Sem números fiscais a sinalizar.

## Exportar (`ExportarRelatorio.tsx` + wordDocs + PDF)
Gerador de documentos (Word/PDF) — **não tem motor de cálculo próprio**; reutiliza os resultados dos simuladores (ex.: `impostoEstimado` do Previsa).
- **Eixo 6:** ok. **Mobile:** a vista de exportação não entra no varrimento dos simuladores; o relatório estático de mobilidade levantou pontos (sticky/flex/print) **a verificar ao vivo** (o relatório provou-se pouco fiável noutras secções). Prioridade baixa.

## Fase 1 — implementado agora
1. Honorários: 3 casos golden.
2. Esta auditoria + notas para Fase 2.

## Fase 2 — transversal (a maior alavanca de usabilidade)
1. **Pré-preencher os simuladores a partir do Perfil** (remove perguntas repetidas em todas as ferramentas).
2. Alinhar os valores de `atividadePrincipal` (art.31) entre Perfil, KB e motores.
3. Verificar a vista Exportar em mobile ao vivo.
