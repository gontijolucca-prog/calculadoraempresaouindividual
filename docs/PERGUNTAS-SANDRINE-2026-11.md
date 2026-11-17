# Perguntas para a Sandrine — novembro 2026

> Entrega: reunião até **24-11-2026**. Cada pergunta tem uma de três respostas possíveis: **está certo**, **corrigir para X** (com o valor), ou **fora de âmbito** (não é para ter na ferramenta).
> Contexto: `docs/AUDITORIA-FISCAL-PENDENTE.md` (73 caixas abertas, todas de validação profissional).

## 1. Tabelas de retenção dos Açores 2026

- **Pergunta:** existe despacho regional com as tabelas de retenção dos Açores para 2026? Se sim, qual?
- **Artigo:** tabelas de retenção na fonte do IRS (despacho anual).
- **O que a app faz hoje:** Continente I–VII e Madeira têm tabela oficial desde junho (`src/lib/retencaoTabelas.ts`). Para os Açores não foi encontrada fonte oficial: o motor aplica **Continente × 0,80**, sinalizado na própria UI.
- **Impacto se estiver errado:** o recibo mensal de quem está nos Açores sai com retenção a mais ou a menos, e o líquido erra em cadeia.
- **Como confirmar:** enviar o PDF/despacho, ou dizer "não existe" para deixarmos a estimativa assumida.

## 2. Reduções regionais do IRS — Açores 0,80 e Madeira 0,70

- **Pergunta:** as percentagens de redução são 20% (Açores) e 30% (Madeira), aplicadas sobre a coleta total?
- **Artigo:** redução regional do IRS (OE em vigor).
- **O que a app faz hoje:** `src/lib/irs.ts:43` → `{ continente: 1.0, acores: 0.80, madeira: 0.70 }`, aplicado ao imposto em `irs.ts:296`.
- **Impacto:** se a percentagem certa for outra, todo o IRS regional está errado no valor final.
- **Como confirmar:** indicar a percentagem e a base (coleta, imposto ou escalões). Não avançar com "parece-me".

## 3. Limiar da regra dos 15% (art. 31.º n.º 13 CIRS)

- **Pergunta:** o limiar de 2026 é 28 320 €?
- **O que a app faz hoje:** `src/lib/fiscal.ts:23` = **28 320 €** (27 360 × 1,0351). Está marcado como provisório no código porque a Portaria não saiu.
- **Impacto:** acima do limiar, quem não justifica 15% do rendimento paga mais IRS. Um limiar errado muda o resultado da análise completa.
- **Como confirmar:** valor oficial da Portaria, quando existir.

## 4. IRC 2026 — taxas, derramas e pagamentos por conta

- **Pergunta:** confirma a tabela completa em vigor?
- **O que a app usa** (`src/lib/previsaCalc.ts:14-18`): geral **19%** · PME **15%** até 50 000 € · Madeira 13,3% / 10,5% PME · Açores 15,2% / 8,75% PME · interior 12,5% PME · derrama estadual 0/3/5/9% (1,5 M / 7,5 M / 35 M) · pagamentos por conta 2,5/4,5/8,5%.
- **Impacto:** é o motor do Previsa. Um erro aqui contamina estimativas de imposto e o Modelo 22 exportado.
- **Como confirmar:** "está certo" ou correção campo a campo.

## 5. Agravamento de TA com prejuízo — suspensão pela LOE 2026

- **Pergunta:** a suspensão do agravamento (lucro num dos 3 períodos anteriores + declarativas cumpridas, ou início de atividade e 2 períodos seguintes) está bem aplicada?
- **O que a app faz hoje:** os dois motores usam **+10 p.p. à taxa** (`viaturas.ts:168`, `previsaCalc.ts:108`) — a antiga divergência do ×1,1 já foi resolvida. O utilizador confirma a suspensão num interruptor.
- **Impacto:** viaturas com prejuízo podem pagar TA a mais se o interruptor ficar mal posto.

## 6. IRS — Anexos F e H

- **Pergunta:** faltam taxas dos rendimentos prediais por duração do contrato (Anexo F) e as deduções de PPR, donativos e juros de habitação própria (Anexo H). Entram na ferramenta?
- **O que a app faz hoje:** `src/lib/irs.ts` tem só `prediais` como valor agregado (linha 136) e **não tem** PPR, donativos nem juros de HPP (grep = 0). As deduções à coleta existentes estão implementadas.
- **Impacto:** quem tem rendas ou PPR não vê o IRS completo; a ferramenta subestima deduções.
- **Como confirmar:** "entra" / "não entra" por cada um dos cinco itens.

---

### Fora destas 6 (ficam no `AUDITORIA-FISCAL-PENDENTE.md`)

IAS/SMN, escalões, tetos das deduções, mínimo de existência, dependentes, solidariedade, benefício municipal, SS independente (7 itens), subsidiação de férias/Natal, seguro AT, PPC Cat. B (25% — aproximação assumida), e-fatura.
