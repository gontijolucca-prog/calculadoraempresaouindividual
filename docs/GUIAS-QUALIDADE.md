# 🎯 Qualidade do Sistema de Guias — Estudo 360

> Análise + pesquisa de mercado + melhorias + matriz de verificação (2026-08-13).

## 1. Análise do guia (antes)

| Aspeto | Estado anterior | Problema |
|---|---|---|
| Comprimento | 2–6 passos + intro | OK (≤7) |
| Fim do tour | "Concluir" sem próximo passo | 🔴 **Acabava em beco** — pior erro segundo as melhores práticas |
| Acessibilidade | Sem role/ARIA/foco | 🔴 Incumprimento WCAG 2.1 AA (dialog, foco, live) |
| Teclado | Só Esc | 🟠 Faltavam setas ←/→ e focus trap |
| Motion | scroll suave sempre | 🟠 `prefers-reduced-motion` ignorado |
| Contraste | label pequeno `#0677FF` (~3.6:1) | 🟠 Falhava 4.5:1 (texto pequeno) |
| Re-aceder | Escrever "guia" no chat | ✅ |
| Progresso | "Passo X de Y" | ✅ (~+12% conclusão, pesquisa) |
| Skip | Sempre visível | ✅ |

## 2. Pesquisa (fontes reais, 2026)

- **Guideflow** — tours de 3 passos: 72% conclusão; 7+: 16%. Copy orientada a resultado (15–25 palavras/passo). Terminar SEMPRE com próxima ação. Progresso +12%. Triggers comportamentais > temporais (+123%).
- **Userpilot** — walkthroughs interativos > tours lineares; guia só quando o utilizador está preso; "a boa onboarding sente-se como uma pessoa competente a notar onde estás preso".
- **Kompassify** — 4–6 passos; foco em outcome ("o que vais conseguir fazer"); re-aceder; atualizar quando a UI muda.
- **WCAG 2.1 AA (usertourkit/WebAIM)** — 16 critérios aplicáveis a tours: `role="dialog"`+`aria-modal` (4.1.2), foco entra e volta ao gatilho (2.4.3), focus trap + Esc (2.1.2/1.4.13), `aria-live` polite (4.1.3), contraste 4.5:1, alvos ≥24px, `prefers-reduced-motion` (2.3.3).
- **GoogleChrome/modern-web-guidance** — popover manual + anchor positioning (progressivo; não necessário no nosso caso — overlay fixo funciona em todos os browsers).

## 3. Melhorias implementadas

### Motor (`src/components/GuiaSistema.tsx`)
1. ✅ **`role="dialog"` + `aria-modal="true"` + `aria-labelledby`/`aria-describedby`** em cada passo
2. ✅ **Foco move-se para o tooltip** ao abrir/cada passo; **volta ao gatilho** ao fechar (2.4.3)
3. ✅ **Focus trap** (Tab/Shift+Tab dentro do tooltip) com Esc sempre a sair
4. ✅ **`aria-live="polite"`** (visível só para leitores de ecrã) anuncia "Passo X de Y: título"
5. ✅ **Setas ←/→** navegam passos (ignoradas dentro de inputs)
6. ✅ **`prefers-reduced-motion`**: scroll sem animação
7. ✅ **Contraste**: label pequeno agora `#0456C0` (≥4.5:1); focus-visible rings nos botões
8. ✅ **Fim nunca em beco**: último passo mostra **"→ Agora experimenta: [próxima ação]"** (`guia.acao`)
9. ✅ **Bug fix**: se o último passo não encontrar alvo, o tour **fecha limpo** (não fica preso invisível) e dispara o follow-up

### Conteúdo (`src/lib/guias.ts`)
- ✅ **`acao` (próxima ação) nos 17 guias** — orientado a resultado ("Preenche o volume de negócios e compara o ENI com a sociedade.")
- ✅ Testes garantem: acao presente, ≤7 passos, corpo ≥40 chars

### Bot (`src/ai/AIContabilista.tsx` + `App.tsx`)
- ✅ **Follow-up do bot ao fechar o tour**: "Fechaste a visita guiada de X. Posso ajudar-te a avançar — *abre o PreviSa*, *cria um cliente novo*, *gera um documento*" (com botões) — via `useImperativeHandle` (React 19)

## 4. Matriz de verificação (loops)

| Loop | O quê | Corridas | Resultado |
|---|---|---|---|
| A | Testes unitários (guias: flags, completude, acao, ≤7) | 10 | ✅ **10/10 passaram** |
| B | E2E rápido: 5 vistas + acessibilidade (dialog, aria, foco, setas, follow-up, persistência) | 10 | ✅ **10/10 · 0 falhas** |
| C | E2E completo: 17 vistas (oferta, tour, saltar, reativar, Esc) | 3 | ✅ **3/3 · 17/17 ferramentas · 0 erros de consola** |
| D | Suite completa do projeto (npm test) | 3 | ✅ **3/3 · 597 verificações ✓** |

**Bugs reais encontrados pelos loops (e corrigidos):**
1. Tour podia **ficar preso invisível** no último passo sem alvo → fecha limpo + follow-up.
2. Passo sem alvo (ex: PreviSa em estado vazio) **rebentava o render** (`rect` null) → fallback: tooltip centrado sem spotlight.
3. Checks de timing instáveis → esperas condicionais (`waitForFunction`) em vez de leituras instantâneas.

## 5. Como correr

```bash
bash scripts/loops-guias.sh        # todos os loops (resultado em /tmp/loops-guias.txt)
node scripts/verificar-guias-rapido.cjs   # loop rápido isolado
node scripts/verificar-guias.cjs          # loop completo
npx tsx src/lib/guias.test.ts             # unit
```
