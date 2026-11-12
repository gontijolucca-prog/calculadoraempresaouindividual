# Campos obrigatórios — checklist

Regra: `[x]` só quando o campo é usado no submit, no cálculo ou já tem validação.
`[ ]` fica com a razão em quatro palavras.

## 1. Perfil do cliente (6 passos)
- [x] Identificação (nome, NIF) — nome no submit; NIF validado (isValidNIFPT)
- [x] Dados empresariais — faturação, funcionários e início no cálculo
- [x] Fiscais e família — idade e dependentes no IRS/salário
- [x] Custos e investimento — custos e investimento no cálculo fiscal
- [x] Viaturas, sócios, dívidas — capital, gerente e sócios nos documentos
- [ ] Objetivos e documentos — sem uso em cálculo

## 2. Novo cliente
- [x] Nome do cliente — upsertEmpresa usa nome; exigido nos documentos
- [x] NIF — isValidNIFPT + upsertEmpresa; exigido nos documentos

## 3. Cofre
- [ ] Serviço / título — falta mapear submit
- [ ] Utilizador — falta mapear submit
- [ ] Password — falta mapear submit

## 4. Definições do escritório
- [ ] Nome do escritório — usado no topo
- [ ] NIF — usado nos documentos
- [ ] Identidade (logo, cor) — usada nos PDFs

## 5. Proposta
- [ ] Cliente — falta mapear submit
- [ ] Serviços — falta mapear cálculo
- [ ] Honorários — falta mapear cálculo
