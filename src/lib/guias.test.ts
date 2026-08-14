// Testes do sistema de guias interativos. Correr: npx tsx src/lib/guias.test.ts
// Garante: (1) todas as ferramentas têm guia completo; (2) flags de "não perguntar"
// e "reativar guias" funcionam; (3) os alvos dos passos estão bem formados.

import { GUIAS, ViewKey, guiaDesativado, marcarGuiaDesativado, reativarGuias } from './guias';

// Shim mínimo de localStorage para o teste correr em Node
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {},
  key: () => null, get length() { return 0; },
};

let fails = 0;
function check(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); }
  else console.log(`✓ ${label}`);
}

const VIEWS: ViewKey[] = [
  'empresas', 'profile', 'tax', 'vehicle', 'ticket', 'selfss', 'diagnostico',
  'imoveis', 'imt', 'salario', 'irs', 'previsa', 'legal', 'office-settings',
  'historico', 'exportar', 'hub',
];

// ── 1. Completude: todas as ferramentas têm guia ──
check(`existem guias para todas as ${VIEWS.length} ferramentas`, VIEWS.every((v) => GUIAS[v] !== undefined));

for (const v of VIEWS) {
  const g = GUIAS[v];
  check(`[${v}] título não vazio`, !!g?.titulo?.trim());
  check(`[${v}] intro não vazia`, !!g?.intro?.trim());
  check(`[${v}] tem "próxima ação" (acao)`, !!g?.acao?.trim());
  check(`[${v}] ≤7 passos no total (intro+passos)`, (g?.passos.length ?? 0) + 1 <= 7);
  check(`[${v}] tem ≥2 passos (tem ${g?.passos.length})`, (g?.passos.length ?? 0) >= 2);
  g?.passos.forEach((p, i) => {
    check(`[${v}] passo ${i + 1} tem título`, !!p.titulo?.trim());
    check(`[${v}] passo ${i + 1} tem corpo (≥40 chars)`, (p.corpo?.trim().length ?? 0) >= 40);
    const temAlvo = !!p.alvo?.sel || !!p.alvo?.texto;
    check(`[${v}] passo ${i + 1} tem alvo (sel ou texto)`, temAlvo);
  });
}

// ── 2. Flags: "não perguntar novamente" ──
// (usa chaves de teste para não poluir o localStorage real)
const K = 'empresas' as ViewKey;
localStorage.removeItem('estudo360:guias:off:' + K);
check('flag começa desativada', !guiaDesativado(K));
marcarGuiaDesativado(K);
check('após marcar, fica desativada', guiaDesativado(K));
reativarGuias();
check('após reativar, deixa de estar desativada', !guiaDesativado(K));
check('reativar limpa TODAS as flags de guias', localStorage.length === 0 ||
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).every((k) => !k?.startsWith('estudo360:guias:')));

// ── 3. Alvos bem formados ──
for (const v of VIEWS) {
  for (const p of GUIAS[v]?.passos ?? []) {
    if (p.alvo?.sel) {
      check(`[${v}] seletor válido: ${p.alvo.sel}`, /^[.#\[]/.test(p.alvo.sel) && p.alvo.sel.length > 2);
    }
    if (p.alvo?.texto) {
      check(`[${v}] texto alvo não vazio`, p.alvo.texto.trim().length >= 2);
    }
  }
}

if (fails > 0) {
  console.error(`\n✗ ${fails} verificações falharam`);
  process.exit(1);
}
console.log('\n✓ Todos os testes de guias passaram.');
