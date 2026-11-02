import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bearerToken, verifyFirebaseRequest } from './_auth';
import { onRequestPost as chatPost } from './api/chat';
import { onRequestPost as deckPost } from './api/deck';
import { isAllowedTocUrl } from './api/toconline';

describe('autenticação Firebase dos proxies', () => {
  it('lê apenas um bearer token válido', () => {
    assert.equal(
      bearerToken(new Request('https://estudo360.pt', { headers: { Authorization: 'Bearer abc.def' } })),
      'abc.def',
    );
    assert.equal(bearerToken(new Request('https://estudo360.pt')), '');
    assert.equal(
      bearerToken(new Request('https://estudo360.pt', { headers: { Authorization: 'Basic abc' } })),
      '',
    );
  });

  it('aceita utilizador devolvido pelo Identity Toolkit', async () => {
    const fakeFetch = async () => new Response(JSON.stringify({
      users: [{ localId: 'uid-1', email: 'ana@estudo360.pt' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const req = new Request('https://estudo360.pt', { headers: { Authorization: 'Bearer ok' } });
    const user = await verifyFirebaseRequest(req, {}, fakeFetch as typeof fetch);
    assert.deepEqual(user, { uid: 'uid-1', email: 'ana@estudo360.pt' });
  });

  it('rejeita token inválido e falhas de rede', async () => {
    const bad = async () => new Response('{}', { status: 401 });
    const req = new Request('https://estudo360.pt', { headers: { Authorization: 'Bearer bad' } });
    assert.equal(await verifyFirebaseRequest(req, {}, bad as typeof fetch), null);

    const offline = async () => { throw new Error('offline'); };
    assert.equal(await verifyFirebaseRequest(req, {}, offline as typeof fetch), null);
  });

  it('bloqueia chat e geração de propostas sem sessão', async () => {
    const mk = () => new Request('https://estudo360.pt/api/teste', {
      method: 'POST',
      headers: { Origin: 'https://estudo360.pt', 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal((await chatPost({ request: mk(), env: {} })).status, 401);
    assert.equal((await deckPost({ request: mk(), env: {} })).status, 401);
  });

  it('só aceita os domínios oficiais do TOConline', () => {
    assert.equal(isAllowedTocUrl('https://app32.toconline.pt/oauth'), true);
    assert.equal(isAllowedTocUrl('https://api32.toconline.pt'), true);
    assert.equal(isAllowedTocUrl('https://toconline.attacker.example'), false);
    assert.equal(isAllowedTocUrl('http://app32.toconline.pt/oauth'), false);
  });
});
