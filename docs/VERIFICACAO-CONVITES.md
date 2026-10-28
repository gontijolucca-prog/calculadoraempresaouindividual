# Verificação do fluxo de convites — 2026-10-28

## Resultado: PASS (2 execuções consecutivas em produção)

Canário: `scripts/audit-convite-canary.mjs` (conta descartável, limpeza no fim).

| Verificação | 07:06 | 07:07 |
|---|---|---|
| Conta canário criada e login | ✓ | ✓ |
| Gabinete criado | ✓ | ✓ |
| Link do convite criado | ✓ | ✓ |
| Copiar link (clipboard) | ✓ | ✓ |
| Link pede password | ✓ | ✓ |
| Colaborador continua na lista | ✓ | ✓ |
| Estado muda para Ativa | ✓ | ✓ |
| Remoção | ✓ | ✓ |

Capturas: `docs/canario-producao-1793171118240.png`, `docs/canario-producao-1793171166565.png`.

## Contexto
- Antes das 07:00 (reset da quota gratuita) o servidor devolvia HTTP 429
  `Quota exceeded` às escritas; o canário registou BLOQUEADO às 00:17.
- Correção aplicada: calendário fiscal deixou de gravar 313 documentos por
  gabinete (passa a referência local); convite com retry + rollback e erros
  classificados; colaborador pendente mantém-se visível.
- Código em produção: `5fae2e9`.
