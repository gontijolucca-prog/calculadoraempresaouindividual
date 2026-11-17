# Documentos por cliente — serviço no VPS (17-11-2026)

Alternativa ao Firebase Storage (que exigia plano Blaze). Usa o servidor que já está pago.

## Onde está

| Peça | Onde |
|---|---|
| Serviço | `/srv/estudo360-docs/server.mjs` (Node 20) |
| Ficheiros | `/srv/estudo360-docs/files/<id-do-gabinete>/` |
| Systemd | `estudo360-docs.service` (127.0.0.1:3020, arranca com o sistema) |
| Nginx | `media.pontofinal.site` → `location /docs-api/` (backup do site em `lucca-videos.bak-docs`) |
| Cliente | `src/lib/docsCloud.ts` + modal "Novo documento" em `src/VisaoGeralView.tsx` |

## Como funciona

1. O browser envia o ficheiro com `Authorization: Bearer <ID token do Firebase>` e `?gabinete=<id>`.
2. O serviço valida o token no Identity Toolkit (`accounts:lookup`) com a chave pública do projeto.
3. **Autorização delegada no Firestore:** o serviço tenta ler `gabinetes/{id}` com o token do utilizador. O Firestore só responde a membros, por isso o acesso é decidido pelas regras que já existem — sem listas duplicadas.
4. Guarda em `files/<gabinete>/<uuid>.<ext>`; a equipa do gabinete partilha os ficheiros, outros gabinetes não.
5. Download passa sempre pelo serviço (`/file?path=…`); não há URLs públicos nem listagem.
6. Apagar remove o ficheiro; o registo do documento na app vai para a lixeira.

## Limites

- 25 MB por ficheiro.
- Extensões: pdf, png, jpg, jpeg, webp, xlsx, xls, docx, doc, csv, xml, zip.
- 60 envios por hora por utilizador.

## Manutenção

```bash
ssh -i ~/.ssh/hetzner_vps01 root@167.233.116.182
systemctl status estudo360-docs      # estado
systemctl restart estudo360-docs     # reiniciar
journalctl -u estudo360-docs -n 50   # logs
du -sh /srv/estudo360-docs/files     # espaço usado
nginx -t && systemctl reload nginx   # depois de mexer no nginx
```

## Pendente

- Incluir `/srv/estudo360-docs/files` na cópia de segurança semanal (hoje o backup da app só guarda metadados).
- Não há antivírus nem pré-visualização de PDF no browser: o download é sempre por ficheiro.
