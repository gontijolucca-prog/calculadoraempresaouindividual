import fs from 'fs';
import path from 'path';
import { DOC_TYPES } from './src/lib/wordDocs.ts';
import { defaultPreviSaState } from './src/previSaState.ts';

const outDir = './docs-export-review';
fs.mkdirSync(outDir, {recursive:true});

const demoEmp = {
  id: 'demo-001',
  nome: 'Exemplo Lda — Demonstração',
  nif: '500000000',
  profile: {
    nomeCliente: 'Exemplo Lda',
    nif: '500000000',
    societaria: { capitalSocial: 5000, quotaSocios: [{nome:'Sócio A', quota:50},{nome:'Sócio B', quota:50}], gerente:'Sócio A' },
    contabilidade: { balancoActivo: 100000, balancoPassivo: 40000, resultadoLiquido: 15000 },
    contabilidadeAbertura: {},
  },
  previsa: { ...defaultPreviSaState(), volumeNegocios: 120000, periodo: 2025 },
};
const demoOffice = {
  nome: 'Gabinete Exemplo',
  nif: '500000001',
  morada: 'Rua Exemplo 1, Lisboa',
  contabilistaResponsavel: 'Dra. Contabilista',
  cedulaProfissional: '12345',
  tipo: 'sociedade',
};

// For PDF generation we use simple HTML to PDF via puppeteer if available, else save as .html for manual print
// Try to use puppeteer if installed, else fallback to html
let puppeteer = null;
try { puppeteer = await import('puppeteer'); } catch {}
if (!puppeteer) {
  console.log('puppeteer not installed, saving as HTML for print');
  for (const def of DOC_TYPES) {
    const html = def.build(demoEmp, demoOffice);
    fs.writeFileSync(path.join(outDir, def.filename(demoEmp) + '.html'), html, 'utf8');
    console.log('✓', def.filename(demoEmp) + '.html');
  }
  process.exit(0);
}
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
for (const def of DOC_TYPES) {
  const html = def.build(demoEmp, demoOffice);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfPath = path.join(outDir, def.filename(demoEmp) + '.pdf');
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
  console.log('✓', path.basename(pdfPath));
  await page.close();
}
await browser.close();
console.log('done');
