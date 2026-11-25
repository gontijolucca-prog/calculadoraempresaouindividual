// Testes dos alvos dos guias. Correr: npx tsx src/lib/guiasAlvos.test.ts
//
// Regra: se um guia destaca um texto ("alvo.texto"), esse texto tem de existir
// algures na interface. Foi assim que se apanhou o guia do Gabinete a apontar
// para KPIs e "Próximos 7 dias" que nunca existiram.
import fs from 'node:fs';
import path from 'node:path';
import { GUIAS, type ViewKey } from './guias';

let fails = 0;
function ok(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); } else console.log(`✓ ${label}`);
}

// Junta todo o código da interface (src) exceto o próprio guias.ts.
const ficheiros: string[] = [];
(function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|html)$/.test(e.name) && !p.endsWith('guias.ts')) ficheiros.push(p);
  }
})(path.resolve(process.cwd(), 'src'));

const fonte = ficheiros.map(f => fs.readFileSync(f, 'utf8')).join('\n');

let totalTextos = 0, totalSels = 0;
for (const [view, guia] of Object.entries(GUIAS) as [ViewKey, (typeof GUIAS)[ViewKey]][]) {
  for (const [i, passo] of guia.passos.entries()) {
    const ref = `[${view}] passo ${i + 1} (${passo.titulo})`;
    if (passo.alvo.texto) {
      totalTextos++;
      ok(`${ref}: o texto "${passo.alvo.texto}" existe na interface`, fonte.includes(passo.alvo.texto));
    }
    if (passo.alvo.sel) {
      totalSels++;
      const sel = passo.alvo.sel;
      ok(`${ref}: seletor com forma válida (${sel})`, /^[.#\[]/.test(sel) && sel.length > 2);
    }
    ok(`${ref}: tem alvo`, !!(passo.alvo.sel || passo.alvo.texto));
  }
}

// O guia do Gabinete não pode voltar a prometer KPIs que não existem.
const gab = GUIAS.gabinete;
const gabTexto = JSON.stringify(gab);
ok('guia do Gabinete não promete "Tarefas hoje"', !gabTexto.includes('Tarefas hoje'));
ok('guia do Gabinete não promete "Próximos 7 dias"', !gabTexto.includes('Próximos 7 dias'));
ok('guia do Gabinete não promete "Atalhos"', !gabTexto.includes('Atalhos'));

// ── Cobertura: nenhuma página/ferramenta pode ficar sem guia ────────────────
// O chatbot de escolha múltipla só pode prometer o que tem visita guiada.
const lerSrc = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

const appSrc = lerSrc('src/App.tsx');
const blocoViewType = appSrc.match(/type ViewType =([\s\S]*?);/)?.[1] ?? '';
const vistas = [...blocoViewType.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);

ok(`ViewType encontrado (${vistas.length} vistas)`, vistas.length >= 15);
for (const v of vistas) {
  ok(`vista "${v}" tem guia`, Object.hasOwn(GUIAS, v));
}

// Tabs internas do Gabinete: cada uma tem de ter um guia próprio.
const gabSrc = lerSrc('src/Gabinete.tsx');
const hubSrc = lerSrc('src/GabineteHub.tsx');
const blocoFuncoes = hubSrc.match(/GABINET_FUNCTIONS[^=]*=\s*\[([\s\S]*?)\];/)?.[1] ?? '';
const tabs = [...blocoFuncoes.matchAll(/\{\s*id:\s*'([a-z-]+)'/g)].map((m) => m[1]);
const blocoMapa = gabSrc.match(/GAB_TAB_GUIA[^=]*=\s*\{([\s\S]*?)\};/)?.[1] ?? '';
const mapa: Record<string, string> = {};
for (const m of blocoMapa.matchAll(/'?([a-z-]+)'?:\s*'([a-z-]+)'/g)) mapa[m[1]] = m[2];

ok(`GABINET_FUNCTIONS encontradas (${tabs.length} tabs)`, tabs.length >= 8);
for (const t of tabs) {
  ok(`tab "${t}" tem guia mapeado`, !!mapa[t]);
  if (mapa[t]) ok(`tab "${t}" aponta para um guia existente (${mapa[t]})`, Object.hasOwn(GUIAS, mapa[t]));
}
const guiasUsados = new Set(Object.values(mapa));
for (const [t, g] of Object.entries(mapa)) {
  ok(`guia "${g}" não é reciclado na tab "${t}"`, t === '' || g !== 'gabinete');
}
ok('tabs do gabinete usam guias distintos', guiasUsados.size === Object.keys(mapa).length);

// Os guias novos têm de ter pelo menos 3 passos (não são placeholders).
for (const v of ['aquisicao', 'custos', 'proposta', 'gab-dashboard', 'gab-mapa-controlo', 'gab-lixeira'] as ViewKey[]) {
  ok(`guia "${v}" tem 3+ passos`, (GUIAS[v]?.passos.length ?? 0) >= 3);
}


console.log(`\n${totalTextos} alvos de texto e ${totalSels} seletores verificados.`);
if (fails) { console.error(`${fails} falha(s)`); process.exit(1); }
console.log('Todos os alvos dos guias existem na interface.');
