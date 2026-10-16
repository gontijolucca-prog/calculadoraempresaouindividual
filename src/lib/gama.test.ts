// Testes da integração Gama (lib/gama.ts) com fetch stubbado — sem rede real.
// Correr: npx tsx src/lib/gama.test.ts

import {
  buildGamaPrompt, createGamaPresentation, pollGamaGeneration,
  generateGamaPresentation, resolveGamaUrl,
} from './gama';

let fails = 0;
function check(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); }
  else console.log(`✓ ${label}`);
}

let requests: Array<{ url: string; init: any }> = [];
function stubFetch(handler: (url: string, init: any) => { status?: number; body: unknown }) {
  requests = [];
  (globalThis as any).fetch = async (url: any, init?: any) => {
    requests.push({ url: String(url), init });
    const r = handler(String(url), init);
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    };
  };
}

async function run() {
  // ── 1) buildGamaPrompt ────────────────────────────────────────────────────
  const office = { nome: 'Gabinete Teste', historia: 'História X.', email: 'a@b.pt' };
  const p1 = buildGamaPrompt(office, {}, { nome: 'Cliente Y', nif: '123456789' }, {});
  check('prompt inclui nome do escritório', p1.includes('Gabinete Teste'));
  check('prompt inclui cliente + NIF', p1.includes('Cliente Y') && p1.includes('123456789'));
  check('prompt inclui secção equipa por defeito', p1.includes('## A nossa equipa'));
  const p2 = buildGamaPrompt(office, {}, {}, { equipa: false, valores: false, beneficios: false });
  check('toggle equipa remove secção', !p2.includes('## A nossa equipa'));
  check('toggle valores remove secção', !p2.includes('## Os nossos valores'));
  const p3 = buildGamaPrompt(office, {}, {}, { observacoes: 'Nota final Z' });
  check('observações incluídas', p3.includes('Nota final Z'));

  // ── 2) createGamaPresentation ────────────────────────────────────────────
  stubFetch(() => ({ body: {} }));
  let err1 = '';
  try { await createGamaPresentation('texto'); } catch (e) { err1 = (e as Error).message; }
  check('sem key → erro claro', err1.includes('Gama API key em falta'));

  stubFetch(() => ({ body: { id: 'gen-1' } }));
  const c1 = await createGamaPresentation('texto', 'sk-test');
  check('create devolve generationId (id)', c1.generationId === 'gen-1');
  check('create fala com o proxy /api/gama', requests[0].url === '/api/gama');
  const body1 = JSON.parse(requests[0].init.body);
  check('body leva ação create + inputText', body1.action === 'create' && body1.inputText === 'texto');
  check('body leva a key do gabinete', body1.key === 'sk-test');

  stubFetch(() => ({ body: { generationId: 'gen-2' } }));
  const c2 = await createGamaPresentation('t', 'k');
  check('create aceita generationId', c2.generationId === 'gen-2');

  stubFetch(() => ({ status: 401, body: { message: 'unauthorized' } }));
  let err2 = '';
  try { await createGamaPresentation('t', 'k'); } catch (e) { err2 = (e as Error).message; }
  check('HTTP 401 → erro com status', err2.includes('401'));

  // ── 3) pollGamaGeneration ────────────────────────────────────────────────
  let n = 0;
  stubFetch(() => { n++; return { body: n < 2 ? { status: 'processing' } : { status: 'completed', gammaUrl: 'https://gamma.app/docs/abc' } }; });
  const st = await pollGamaGeneration('g', 'k', { intervalMs: 5, timeoutMs: 200 });
  check('poll processing → completed', st.status === 'completed');
  const stBody = JSON.parse(requests[requests.length - 1].init.body);
  check('status via proxy com generationId', stBody.action === 'status' && stBody.generationId === 'g');

  stubFetch(() => ({ body: { status: 'failed', error: 'quota esgotada' } }));
  let err3 = '';
  try { await pollGamaGeneration('g', 'k', { intervalMs: 5, timeoutMs: 100 }); } catch (e) { err3 = (e as Error).message; }
  check('failed → erro com mensagem do servidor', err3.includes('quota esgotada'));

  stubFetch(() => ({ body: { status: 'processing' } }));
  let err4 = '';
  try { await pollGamaGeneration('g', 'k', { intervalMs: 5, timeoutMs: 25 }); } catch (e) { err4 = (e as Error).message; }
  check('timeout → erro', err4.includes('timeout'));

  // ── 4) resolveGamaUrl ────────────────────────────────────────────────────
  check('prioridade gammaUrl', resolveGamaUrl({ status: 'completed', gammaUrl: 'a', exportUrl: 'b', webUrl: 'c' }) === 'a');
  check('fallback exportUrl', resolveGamaUrl({ status: 'completed', exportUrl: 'b', webUrl: 'c' }) === 'b');
  check('fallback webUrl', resolveGamaUrl({ status: 'completed', webUrl: 'c' }) === 'c');
  check('sem links → null', resolveGamaUrl({ status: 'completed' }) === null);

  // ── 5) generateGamaPresentation (create + poll juntos) ───────────────────
  let m = 0;
  stubFetch(() => { m++; return { body: m === 1 ? { id: 'gen-9' } : { status: 'completed', gammaUrl: 'https://gamma.app/docs/xyz' } }; });
  const g = await generateGamaPresentation('t', 'k', { intervalMs: 5, timeoutMs: 200 });
  check('generate devolve generationId', g.generationId === 'gen-9');
  check('generate devolve URL final', resolveGamaUrl(g) === 'https://gamma.app/docs/xyz');

  if (fails) { console.error(`\n${fails} falhas`); process.exit(1); }
  console.log('\nTodos os testes da integração Gama passaram.');
}

run().catch((e) => { console.error(e); process.exit(1); });
