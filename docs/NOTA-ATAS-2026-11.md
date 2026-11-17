# Nota interna — Atas de Assembleia Geral (17-11-2026)

**Não é para o changelog público.** Registo para o escritório e para o histórico.

## O que estava mal

Até 17-11-2026, a Ata gerada pela app (`src/lib/wordDocs.ts`) afirmava três factos que não tinha:

1. "Todos os Sócios estiveram presentes"
2. "porque estão todos os Sócios presentes"
3. "Decisões tomadas por unanimidade, por todos os Sócios presentes"

A app não tem campos de presenças nem de resultado de votação — as frases saíam sempre, mesmo numa empresa sem sócios preenchidos.

## O que mudou

As três frases passaram a espaço em branco para preencher (o mesmo tracejado que já se usava para presidente e capital):

- "Quotas de Capital Social subscritas e realizadas pelos Sócios:"
- "Dispensa de formalidades prévias de convocatória (art. 54.º CSC): ………"
- "Deliberações (resultado da votação: ………)"

Protegido por `src/lib/wordDocs.test.ts` (13 asserções): se alguém repuser as afirmações, o teste falha.

## O que fazer com atas já emitidas

Atas geradas e assinadas antes desta data podem conter as frases. Se alguma for entregue a cliente ou à AT:

- confirmar as presenças reais e a forma de deliberação;
- se houver dúvida, substituir a página pela versão nova, preenchida à mão;
- não reemitir em massa sem verificar caso a caso.

A versão seguinte (R2) acrescenta campos na ficha do cliente (`sociosPresentes`, `decisaoUnanime`) para a Ata afirmar apenas o que os dados disserem.
