# Sistema de Guias Interativos — Estudo 360

> Implementado 2026-08-13 · Verificado E2E: **17/17 ferramentas, 0 falhas, 0 erros de consola** (121 verificações).

## Como funciona (para o utilizador) — via AI Contabilista

As visitas guiadas vivem **dentro do AI Contabilista** (o bot fala primeiro):

1. **Ao entrar no site**, o AI Contabilista **abre sozinho** e é o primeiro a falar (saudação).
2. **Em cada página nova**, o bot envia uma mensagem: *"Visita guiada · [Ferramenta]"* com a
   descrição e os botões:
   - **Ver tour** → tour guiado (spotlight + explicação em contexto contabilístico).
   - **Agora não** → fecha a mensagem (não volta a perguntar nesta sessão).
   - **Não perguntar novamente nesta ferramenta** → nunca mais pergunta (localStorage).
3. **Durante o tour**: `Seguinte` / `Anterior` / `Saltar` / `Esc` fecha.
4. **Reativar**: escreve no chat "guia", "tour" ou "visita" → o bot reativa tudo e oferece a
   visita guiada da página atual.

## Onde está o código

| Ficheiro | O quê |
|---|---|
| `src/lib/guias.ts` | Conteúdo dos 17 guias (texto contabilístico, alvos) + flags localStorage |
| `src/components/GuiaSistema.tsx` | Motor de tour (spotlight + tooltip), controlado pelo bot via prop `iniciar` |
| `src/App.tsx` | Integração (render + `data-view` no `<main>` + bypass `?demo` em dev) |
| `scripts/verificar-guias.cjs` | Loop de verificação E2E (Playwright) |
| `src/lib/guias.test.ts` | Testes unitários das flags + completude dos guias |

## Regras do sistema

- **O bot fala primeiro**: abre sozinho ao entrar e oferece tour em cada página nova.
- **Opcional sempre**: "Agora não" fecha a oferta; nada bloqueia o utilizador.
- **"Não perguntar novamente"** persiste por ferramenta (localStorage) — escrever "guia"/"tour"
  no chat reativa tudo.
- **Passo 1 garantido**: apresenta a ferramenta sobre a vista (`[data-view]`); os passos
  seguintes são por texto real da app — se um elemento não existir (estado vazio), salta
  sem bloquear.
- **Nunca toca em dados**: só mostra; z-index acima da app; Esc fecha.

## Verificação (loops)

```bash
# 1. Dev server
npm run dev                                    # http://localhost:3000

# 2. Testes unitários (flags + completude dos 17 guias)
npx tsx src/lib/guias.test.ts                  # ✓ 100+

# 3. Loop E2E completo (percorre as 17 ferramentas em modo demo)
node scripts/verificar-guias.cjs                # esperado: 0 falhas, 17/17 OK

# 4. Suite completa
npm test                                       # 560+ ✓ (12 ficheiros)
```

O loop E2E valida por ferramenta: pergunta aparece → tour abre com spotlight → avança →
saltar fecha → não repete na sessão → "Ativar guias" reabre → Esc fecha → zero erros de consola;
e no fim: "não perguntar novamente" persiste entre sessões.

## Modo demo (dev)

`http://localhost:3000/?demo=1` abre a app **sem login** (só em desenvolvimento) — útil para
ver os guias com dados de exemplo e para os testes E2E. Em produção não existe.
