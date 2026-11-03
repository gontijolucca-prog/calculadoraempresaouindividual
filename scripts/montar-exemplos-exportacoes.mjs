#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public', 'exemplos-exportacoes-2026-11-03');
mkdirSync(OUT, { recursive: true });

const files = [
  ['01-simulacao-fiscal.pdf', 'docs/audit-2026-10-26/pdf/tax.pdf', 'Simulador Fiscal', 'ENI vs Sociedade, parâmetros, comparação, recomendação, enquadramento e escritório.'],
  ['02-simulacao-viaturas.pdf', 'docs/audit-2026-10-26/pdf/vehicle.pdf', 'Simulador de Viaturas', 'IVA, tributação autónoma, depreciação e comparação de formas de aquisição.'],
  ['03-simulacao-aquisicao.pdf', 'docs/audit-2026-10-26/pdf/aquisicao.pdf', 'Simulador de Aquisição', 'Compra, crédito, leasing e renting com o regime fiscal escolhido.'],
  ['04-simulacao-tickets.pdf', 'docs/audit-2026-10-26/pdf/ticket.pdf', 'Tickets e Benefícios', 'Custo, poupança, limites isentos e enquadramento fiscal.'],
  ['05-seguranca-social-independente.pdf', 'docs/audit-2026-10-26/pdf/selfss.pdf', 'SS Independente', 'Base de incidência, contribuição mensal, anual e regras aplicáveis.'],
  ['06-diagnostico-autonomia.pdf', 'docs/audit-2026-10-26/pdf/diagnostico.pdf', 'Diagnóstico de Autonomia', 'Cinco pilares, scores, pontos fortes, riscos e plano de ação.'],
  ['07-imoveis-na-empresa.pdf', 'docs/audit-2026-10-26/pdf/imoveis.pdf', 'Imóveis na Empresa', 'Arrendamento/comodato vs entrada em espécie, IMT, selo e impacto fiscal.'],
  ['08-simulacao-imt.pdf', 'docs/audit-2026-10-26/pdf/imt.pdf', 'IMT e Imposto do Selo', 'Valor, localização, tipo de imóvel, taxa, benefícios e total.'],
  ['09-salario-liquido.pdf', 'docs/audit-2026-10-26/pdf/salario.pdf', 'Salário Líquido', 'Bruto, descontos, líquido, custo empregador e pressupostos.'],
  ['10-simulacao-irs.pdf', 'docs/audit-2026-10-26/pdf/irs.pdf', 'IRS — Modelo 3', 'Agregado, rendimentos, deduções, taxa, imposto e resultado.'],
  ['11-previsa-modelo-22.pdf', 'docs/audit-2026-10-26/pdf/previsa.pdf', 'Previsa — Modelo 22', 'Q07, Q09, Q10, IRC, derramas, tributação autónoma, PPC e notas.'],
  ['12-ficha-simulacao-cliente.pdf', 'docs/audit-2026-11-03/extra/08-ficha-simulacao-cliente.pdf', 'Ficha de simulação do cliente', 'Resumo executivo com identificação, fiscalidade, resultados e honorários.'],
  ['13-ficha-360-gabinete.pdf', 'docs/audit-2026-11-03/extra/09-ficha-360-gabinete.pdf', 'Ficha 360 do gabinete', 'Cliente, obrigações, alertas, contactos, tarefas, situação e orientações.'],
  ['14-quadro-obrigacoes.pdf', 'docs/audit-2026-11-03/extra/10-quadro-obrigacoes.pdf', 'Quadro Resumo de Obrigações', 'Matriz anual de obrigações por cliente e estado.'],
  ['15-mapa-controlo.pdf', 'docs/audit-2026-11-03/extra/11-mapa-controlo.pdf', 'Mapa de Controlo', 'Pilares de controlo por cliente e mês, com filtros refletidos no PDF.'],
  ['16-mapa-rh.pdf', 'docs/audit-2026-11-03/extra/12-mapa-rh.pdf', 'Mapa RH', 'Pilares de recursos humanos por cliente e mês.'],
  ['17-proposta-honorarios.pdf', 'docs/audit-2026-10-26/pdf/proposta-honorarios.pdf', 'Proposta de Honorários', 'Serviços, mensalidade, totais, condições e dados do escritório.'],
  ['18-minuta-contrato.pdf', 'docs/audit-2026-10-26/pdf/minuta-contrato.pdf', 'Minuta de Contrato', 'Partes, objeto, serviços, honorários, obrigações, duração e foro.'],
  ['19-proposta-comercial.pdf', 'docs/audit-2026-11-03/extra/13-proposta-comercial.pdf', 'Proposta Comercial', 'Síntese dos sete blocos da proposta comercial com branding e próximo passo.'],
  ['20-demonstracao-resultados.pdf', 'docs/audit-2026-11-03/word/01-demonstracao-resultados.pdf', 'Demonstração dos Resultados', 'Rendimentos, gastos, EBITDA, resultado operacional, impostos e resultado líquido.'],
  ['21-alteracoes-capital-proprio.pdf', 'docs/audit-2026-11-03/word/02-alteracoes-capital-proprio.pdf', 'Alterações no Capital Próprio', 'Capital, reservas, resultados e movimentos do período.'],
  ['22-fluxos-caixa.pdf', 'docs/audit-2026-11-03/word/03-fluxos-caixa.pdf', 'Fluxos de Caixa', 'Atividades operacionais, investimento, financiamento e variação de caixa.'],
  ['23-balanco.pdf', 'docs/audit-2026-11-03/word/04-balanco.pdf', 'Balanço', 'Ativo, capital próprio, passivo, totais e comparação com abertura.'],
  ['24-demonstracoes-financeiras-sintese.pdf', 'docs/audit-2026-11-03/word/05-demonstracoes-financeiras-sintese.pdf', 'Demonstrações Financeiras — Síntese', 'Visão consolidada de Balanço, Resultados, Capital Próprio e Fluxos.'],
  ['25-ata-assembleia-geral.pdf', 'docs/audit-2026-11-03/word/06-ata-assembleia-geral.pdf', 'Ata de Assembleia Geral', 'Convocatória, sócios, deliberações, resultado e assinaturas.'],
  ['26-declaracao-responsabilidade.pdf', 'docs/audit-2026-11-03/word/07-declaracao-responsabilidade.pdf', 'Declaração de Responsabilidade', 'Entidade, contabilista, cédula, declarações e assinatura da gerência.'],
];

const catalogo = [];
for (const [targetName, relativeSource, titulo, descricao] of files) {
  const source = path.join(ROOT, relativeSource);
  const target = path.join(OUT, targetName);
  copyFileSync(source, target);
  const raw = readFileSync(target).toString('latin1');
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const media = (raw.match(/\/MediaBox\s*\[([^\]]+)\]/) || [])[1]?.trim() || '';
  if (pages !== 1) throw new Error(`${targetName}: ${pages} páginas`);
  const [x0, y0, x1, y1] = media.split(/\s+/).map(Number);
  const portrait = Math.abs((x1 - x0) - 595.28) < 1.5 && Math.abs((y1 - y0) - 841.89) < 1.5;
  const landscape = Math.abs((x1 - x0) - 841.89) < 1.5 && Math.abs((y1 - y0) - 595.28) < 1.5;
  if (!portrait && !landscape) throw new Error(`${targetName}: MediaBox inválido (${media})`);
  const bytes = statSync(target).size;
  const sha256 = createHash('sha256').update(readFileSync(target)).digest('hex');
  catalogo.push({ ficheiro: targetName, titulo, descricao, formato: portrait ? 'A4 retrato' : 'A4 paisagem', paginas: pages, bytes, sha256 });
}

const lines = [
  '# Exemplos de exportações — Estudo360',
  '',
  `Gerado em ${new Date().toLocaleDateString('pt-PT')}. Todos os ficheiros têm exactamente uma página A4.`,
  '',
  '| # | Documento | Onde testar | Conteúdo principal |',
  '|---|---|---|---|',
  ...catalogo.map((item, index) => `| ${String(index + 1).padStart(2, '0')} | ${item.titulo} | [Abrir PDF](./${item.ficheiro}) | ${item.descricao} |`),
  '',
  '## Como rever',
  '',
  '1. Abrir cada PDF e confirmar que tem uma única página.',
  '2. Confirmar identificação do escritório, cliente, valores e base legal.',
  '3. Confirmar que não existem textos cortados, sobrepostos ou campos obrigatórios em falta.',
  '4. Registar qualquer documento a corrigir pelo número indicado.',
  '',
  'A lista técnica com tamanho, orientação e hash está em `catalogo.json`.',
];
writeFileSync(path.join(OUT, 'README.md'), lines.join('\n'));
writeFileSync(path.join(OUT, 'catalogo.json'), JSON.stringify({ data: new Date().toISOString(), total: catalogo.length, documentos: catalogo }, null, 2));

const cards = catalogo.map((item, index) => `
  <a class="doc" href="./${item.ficheiro}" target="_blank" rel="noopener">
    <span class="num">${String(index + 1).padStart(2, '0')}</span>
    <span class="body">
      <strong>${item.titulo}</strong>
      <span>${item.descricao}</span>
    </span>
    <span class="meta">${item.formato}<br>${item.paginas} página</span>
  </a>`).join('');

const html = `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Exemplos de documentos exportáveis · Estudo360</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&family=Fraunces:opsz,wght@9..144,700&display=swap" rel="stylesheet">
<style>
  :root{--paper:#fff;--bg:#fafaf7;--ink:#14181e;--muted:#667085;--line:#e7e6e1;--blue:#0677ff}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Montserrat,sans-serif;line-height:1.5}
  .wrap{max-width:980px;margin:0 auto;padding:0 22px}header{padding:50px 0 34px;background:var(--paper);border-bottom:1px solid var(--line)}
  .top{display:flex;align-items:center;gap:10px;margin-bottom:28px}.logo{width:30px;height:30px}.brand{font-weight:700}.brand span{color:var(--blue)}
  h1{font-family:Fraunces,Georgia,serif;font-size:clamp(32px,5vw,52px);line-height:1.04;letter-spacing:-1px;margin:0 0 12px;max-width:760px}
  header p{max-width:720px;color:var(--muted);margin:0;font-size:14.5px}.badge{display:inline-flex;margin-top:18px;padding:7px 11px;border-radius:999px;background:#eef6ff;color:#0558c9;font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:600;letter-spacing:.7px;text-transform:uppercase}
  main{padding:38px 0 60px}.docs{display:grid;grid-template-columns:1fr 1fr;gap:9px}.doc{display:flex;align-items:flex-start;gap:12px;padding:14px 15px;border:1px solid var(--line);border-radius:10px;background:var(--paper);text-decoration:none;color:inherit}.doc:hover{border-color:#b9d7ff;background:#fbfdff}
  .num{width:28px;height:28px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:600;flex:none}
  .body{min-width:0;flex:1}.body strong{display:block;font-size:12.5px}.body span{display:block;margin-top:3px;color:var(--muted);font-size:11.5px;line-height:1.45}
  .meta{text-align:right;color:#98a2b3;font-family:"JetBrains Mono",monospace;font-size:8.5px;line-height:1.6;white-space:nowrap}
  footer{border-top:1px solid var(--line);padding-top:20px;margin-top:26px;display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;color:var(--muted);font-size:11.5px}footer a{color:var(--blue);text-decoration:none}
  @media(max-width:720px){.docs{grid-template-columns:1fr}.top{margin-bottom:20px}.meta{display:none}}
</style>
</head>
<body>
<header><div class="wrap"><div class="top"><img class="logo" src="/logo.svg" alt=""><div class="brand">Estudo<span>360</span></div></div>
<h1>Documentos exportáveis, revistos um a um.</h1>
<p>Esta pasta reúne um exemplo real de cada PDF que o Estudo360 consegue gerar. Todos têm exatamente uma página A4, identificação do escritório e cliente, dados úteis e acabamento visual consistente.</p>
<span class="badge">${catalogo.length} PDFs · 1 página cada</span></div></header>
<main class="wrap"><div class="docs">${cards}</div>
<footer><span><b>Estudo360</b> · revisão de ${new Date().toLocaleDateString('pt-PT')}</span><span><a href="/estudo360-novidades-semana-03-11">Voltar ao changelog</a></span></footer></main>
</body></html>`;
writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`OK — ${catalogo.length} PDFs, todos com uma página A4, em ${path.relative(ROOT, OUT)}`);
