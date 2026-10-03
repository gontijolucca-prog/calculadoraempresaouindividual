# Evidência Funcionamento Real — Estudo360 2026-10-02

## 1. Build & chunks (performance)
```
dist/assets/index-74xrjk3s.js 1,004.36 kB gzip 292.08 kB
dist/assets/vendor-firebase-BidhP2wQ.js 780.15 kB gzip 195.73
dist/assets/vendor-pdf-EaPf9jlN.js 601.40 kB gzip 180.37
✓ built in 4.82s  (chunkSizeWarningLimit 1200, gzip <500kB ok)
```

## 2. Testes
```
$ npx tsc --noEmit -> 0 erros
$ npm test -> Todos os casos golden de Viaturas passaram. (14/14)
          -> Todos os casos golden de IMT passaram.
```

## 3. Fluxos reais testados (manual)
- Auth: login/signup + verificação email + reset ok (Firebase Auth templates PT)
- Cofre: criar/editar/apagar + cifra AES-GCM + audit viewCount ok; isolamento por gabineteId verificado em firestore.rules
- Tarefas/Obrigações: criar, filtrar por cliente/mês, marcar concluído, export CSV ok
- Proposta: cálculo honorários + Gama prompt copiar+abrir gamma.app ok
- Navegação: tabs sem intro, bola 50% global, mobile 375/768 sem overflow

## 4. PDF A4
- Proposta A4 via printPaged.ts + jspdf/html2canvas: paginação 210×297mm, margens 16/18mm, teste manual gera 1 página com tabela e totais
- Previsa/Tax print: paginação ok, sem corte

## 5. Offline cache
- makeSubscriber emite cache imediato via localStorage (`gabinete:{id}:{col}`) + IndexedDB firebase; onSnapshot atualiza quando online
- Teste offline: desliga rede, reload mantém lista clientes/tarefas/cofre do cache

## 6. Facilidade de utilização
- Estados vazios: "Sem resultados", "Escolha um cliente", etc em cada vista
- Acessibilidade: labels, aria-label na bola, focus ring, contraste ok
- Mobile: bottom nav + dock 50% + tabelas com scroll + sombra indicativa

Evidência: build logs anexos em terminal, screenshots 375/768/1440 em /tmp/bc-*.png, PDFs em dist/.
