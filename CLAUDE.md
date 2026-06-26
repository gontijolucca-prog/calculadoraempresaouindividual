# CLAUDE.md — Estudo 360

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpnf8ykk_w7fz score=5.3 created=2026-05-27 source=observation complexity=simple -->
- Always Read a file before editing it — even when the edit target seems obvious from context
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpnf8yn1_cmkr score=5.9 created=2026-05-27 source=anti_pattern complexity=simple -->
- Before committing any code change, run tsc --noEmit AND verify the production build succeeds — grep counts or partial checks are not sufficient.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->

## Project state (2026-06-26 — Hermes handoff)

**Estudo 360** = estudo360.pt — plataforma de simulação fiscal para escritórios de contabilidade.
Cliente: Recofátima (contacto: Sandrine, WhatsApp 133921408831547@lid).

### Paths
- Repo: `/Volumes/Extreme SSD/Mac-Lucca/Documents-store/Documents/GitHub/estudo360`
- GitHub: `gontijolucca-prog/calculadoraempresaouindividual`
- Domain: https://estudo360.pt (CF Pages auto-deploy on push to main)
- Node: `/Users/lucca/.nvm/versions/node/v24.14.0/bin/node`
- NPM: `/Users/lucca/.nvm/versions/node/v24.14.0/bin/npm`
- PDF report: `~/Desktop/relatorio-estudo360-junho2026.pdf`
- HTML source: `~/Desktop/relatorio.html`

### Stack
- React 19 + Vite 6 + TypeScript 5.8 + Tailwind v4 + Firebase + Cloudflare Pages
- 10 simuladores; 11 documentos automatizados; AI Contabilista (OpenRouter free models)
- 254 testes golden (npm test); verify.sh em scripts/

### Key fixes (June 2026 — Hermes sessions)
- Volume de negócios: só contas 71+72 (art.105 CIRC) — `src/lib/saft.ts`
- Taxas IRC dinâmicas por ano: `RATES_BY_YEAR` em `src/lib/previsaCalc.ts`
- profileRules: sociedades >200k → organizada (art.86-A) — `src/lib/profileRules.ts`
- SOCIEDADE_TYPES exported; ClientProfile.tsx reusa
- Faturação não aceita negativos: `min="0"` + `Math.max(0,val)` — `src/ClientProfile.tsx`
- Disclaimer legal: "Cálculos indicativos — confirme com o seu TOC" — `src/App.tsx`
- 4.779 linhas removidas (código morto, pnpm-lock, auditorias)

### Commands
```
npm run dev       # local dev
npm run build     # production build
npm run lint      # tsc --noEmit
npm test          # all golden tests (tsx)
bash scripts/verify.sh   # full check: lint+test+build+live
```

### Memory
- Sessão Hermes 25-26 jun: 9 commits, GLM review cycles, +82 asserções golden
- Deploy: commit `3e9e20eb` — CF Pages passing
- Próximo: multi-tenancy, constantes fiscais externalizadas, onboarding
