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

for (const def of DOC_TYPES) {
  try {
    const html = def.build(demoEmp, demoOffice);
    const filename = def.filename(demoEmp) + '.doc';
    fs.writeFileSync(path.join(outDir, filename), html, 'utf8');
    console.log('✓', filename);
  } catch(e) { console.error('x', def.id, e.message); }
}
console.log('done word docs');
