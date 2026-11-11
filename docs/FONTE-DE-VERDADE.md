# Fonte de verdade — Estudo 360

> Atualizado: 2026-11-10. Se algo aqui não bater com a realidade, corrige-se este ficheiro primeiro.

## Repositório canónico

- **Path:** `/Volumes/Extreme SSD/Dev/GitHub/estudo360`
- **Atalho:** `~/Documents/GitHub/estudo360` — mesmo inode (verificado 2026-11-10).
- **GitHub:** `gontijolucca-prog/calculadoraempresaouindividual` · branch `main`
- **NÃO usar:** `/Volumes/Extreme SSD/Dev/GitHub/calculadoraempresaouindividual` — clone antigo, 159 commits atrás em 2026-11-10.

## Comandos

| O quê | Comando |
|---|---|
| Instalar | `npm ci` (CI) / `npm install` (local) |
| Dev | `npm run dev` → http://localhost:3000 |
| Build | `npm run build` → `dist/` |
| Tipos | `npm run lint` |
| Testes | `npm test` |
| Verificação completa | `bash scripts/verify.sh` |
| Audits | `npm run audit:segredos` · `npm run audit:pdf-palette` |

- **Porta dev:** 3000 (`package.json`: `vite --port=3000 --host=0.0.0.0`).
- Servidor dev ativo em 2026-11-10: `127.0.0.1:3000`, cwd canónico.
- **Node:** `v22.23.2` no PATH (`/Users/lucca/.local/bin/node`); `scripts/verify.sh` fixa `v24.14.0` em `~/.nvm/versions/node/v24.14.0`.

## URLs

- **Produção:** https://estudo360.pt
- **Dev:** http://localhost:3000/
- **Changelog semanal** (ficheiros em `public/`):
  - Mais recente: https://estudo360.pt/estudo360-novidades-semana-09-11
  - Anterior: https://estudo360.pt/estudo360-novidades-semana-03-11
  - Anterior: https://estudo360.pt/estudo360-novidades-semana-26-10
  - Arquivo: https://estudo360.pt/estudo360-novidades-e-svat
  - Em produção o Cloudflare serve **sem `.html`** (`.html` devolve 308). Em dev, usar `.html`.
- **Notas da reunião:** fim de cada página, secção «Próximos passos».
  - **Privadas desde 11/11:** a página lê pelo `GET /api/notas?m=<marcador>&k=<chave>`; sem chave responde 401 e as regras do Firestore já não expõem `updates` a terceiros.
  - Escrita: link pessoal com `?k=<chave>`; sem chave a página é só de leitura.
  - Servidor: `/api/notas`. Guarda apenas o SHA-256 da chave; cada gravação é uma versão nova (append-only) em `notasPainel/reuniao` + `updates`.
  - Rascunho local em `localStorage`; `Ctrl/⌘+Enter` grava.

## Cópia de segurança do Firestore (desde 11/11)

- Workflow `.github/workflows/backup.yml`: diário às 03:10 UTC e manual.
- `scripts/backup-firestore.mjs` percorre coleções e subcoleções, comprime e cifra (AES-256-GCM).
- Artefacto `firestore-backup-<run>` no GitHub, 30 dias. **Só é legível com `BACKUP_KEY`** (segredo do repositório + `~/.config/credentials/estudo360-backup-key`).
- Restauro: `BACKUP_KEY=… FIREBASE_SERVICE_ACCOUNT_JSON=… node scripts/restore-firestore.mjs <ficheiro> --apply` (sem `--apply` só simula).


## Deploy (web)

1. Commit + push para `main`.
2. GitHub Actions `.github/workflows/deploy.yml`:
   - `npm ci` → `npm run lint` → `npm test` → `npm run audit:segredos` → `npm run build`
   - publica Firestore rules: `firebase-tools ... --only firestore:rules --project estudo360-app`
   - configura secrets de runtime no Pages
   - `wrangler pages deploy dist --project-name=estudo360 --branch=main`
3. Produção: **Cloudflare Pages**, projeto `estudo360`.
4. Prova: `curl -s https://estudo360.pt/version.json` → `buildId` = short SHA do commit.
   - Em 2026-11-10: HEAD `b6e949d`; live `b6e949d`; run «Deploy to Cloudflare Pages» success (`gh run list`).
5. `workflow_dispatch` também disponível no GitHub Actions.
6. Tauri/desktop: workflow separado `tauri-build.yml`; não é o deploy web.

### Como provar que a versão nova está servida

```bash
curl -s https://estudo360.pt/version.json          # buildId = short SHA do commit
curl -s https://estudo360.pt/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js'
```

⚠ O `buildId` é só o short SHA do commit. Um build local com working tree sujo mantém o mesmo `buildId` do commit — para distinguir builds, usar o hash/nome do bundle (`assets/index-*.js`), não só o `version.json`.

## O que abrir

- **Para trabalhar:** http://localhost:3000/
- **Para a reunião:** https://estudo360.pt/estudo360-novidades-semana-09-11 (com o teu link `?k=` para escrever notas)
- **Para confirmar produção:** https://estudo360.pt/version.json
