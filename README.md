# Estudo 360

Análise. Estratégia. Decisão.

**estudo360.pt** — plataforma de simulação fiscal para contabilistas e empresários. 10 simuladores, 3 documentos num clique, sempre actualizado com o OE.

## Stack

- React 19 + Vite 6 + TypeScript 5.8
- Tailwind CSS v4 + Motion (Framer Motion)
- Firebase (Auth + Firestore)
- Cloudflare Pages (deploy)
- jsPDF, Recharts, Lucide Icons

## Desenvolvimento

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # dist/
npm run lint    # tsc --noEmit
```

## Deploy

Push para `main` → GitHub Action deploy para Cloudflare Pages (estudo360.pt).

## Projectos relacionados

- **AIContabilista** — chat com acesso aos simuladores + SAF-T
- **PreviSa** — simulador Modelo 22 / IRC com discriminação por ano de origem
- **Diagnóstico de Autonomia** — rácios financeiros
- **Enquadramento 2026** — ENI vs Lda vs Sociedade em 2 camadas
