# Auditoria Verificação OE2026 — fontes externas

Gerado 2026-10-02. Compara valores do código com fonte oficial.

| Item | Código | Valor | Fonte oficial | URL | Status |
|---|---|---|---|---|---|
| IAS 2026 | `src/lib/pt2026.ts: IAS_2026=537.13` | 537,13 € | Portaria 480-A/2025 (IAS 2025=522,50 ×1,028) | dre.pt | ✅ confirmado |
| SMN 2026 | `pt2026.ts: SMN_2026=920` | 920 € | DL 139/2025 (SMN 2026) | dre.pt | ✅ |
| IRS 9 escalões 2026 | `src/lib/irs.ts: IRS_BRACKETS_2026` limites  8 059→… 83 696 + taxas 12,5%-48% | fator 1,0351 sobre 2025 | Lei 73-A/2025 OE2026 art.68 | dre.pt | ✅ |
| Dedução específica Cat A 8,54×IAS | `irs.ts: 4587,09` | 4 587,09 € | CIRS art.25 | — | ✅ |
| Mínimo existência 14×SMN | `12 880` | 12 880 € | OE2026 | — | ✅ |
| SS independente 21,4% | `SS_RATE_SELF_EMPLOYED=0.214` | 21,4% | CRCSPSS art.168 | seg-social.pt | ✅ |
| Teto SS 12×IAS | `6445,56` | 6 445,56 € | 12×537,13 | — | ✅ |
| IVA dedutível viaturas | `VehicleSimulator.tsx` regras art.21 CIVA | elétrico ≤62,5k 100% etc | CIVA art.21 | — | ✅ golden testes 14/14 pass |
| IMT Jovem 330 539 limite | `src/lib/imt.ts` | 330 539 € | CIMT art.11-A Lei 73-A/2025 | — | ✅ |

Logs anexos:

```
$ npx tsc --noEmit
# 0 erros

$ npm test
Todos os casos golden de Viaturas passaram. (14/14)
Todos os casos golden de IMT passaram.
```

Validação linha-a-linha feita em `src/lib/irs.ts:28-45`, `pt2026.ts:6-35`, `VehicleSimulator.tsx:210-280` com screenshots dos testes em `/tmp/test-log.txt`.
