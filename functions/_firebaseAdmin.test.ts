import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify, createPublicKey } from 'node:crypto';
import {
  commitFirestoreFields,
  createAuthUser,
  createEmployeeCustomToken,
  getFirestoreDoc,
  lookupAuthByEmail,
  patchFirestoreDoc,
  signInAuthPassword,
} from './_firebaseAdmin';

const emulatorEnv = {
  FIREBASE_PROJECT_ID: 'demo-estudo360-audit',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180',
  FIREBASE_API_KEY: 'test-key',
};

function serviceAccountEnv(suffix: string) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return {
    env: {
      FIREBASE_PROJECT_ID: `demo-${suffix}`,
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        project_id: `demo-${suffix}`,
        client_email: `qa-${suffix}@demo.iam.gserviceaccount.com`,
        private_key: pem,
      }),
    },
    publicKey: createPublicKey(privateKey),
  };
}

function decodePart(value: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

describe('Firebase Admin REST', () => {
  it('cria a conta com password e aplica claims num segundo passo', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body || '{}')),
      });
      return new Response(JSON.stringify({ localId: 'emp_123' }), { status: 200 });
    };

    await createAuthUser(emulatorEnv, {
      localId: 'emp_123',
      email: 'employee+emp_123@auth.estudo360.pt',
      password: 'Teste12345!',
      displayName: 'Ana Silva',
      claims: { employeeOnly: true, credentialId: 'cred_123', gabineteId: 'gab_1' },
    }, fakeFetch as typeof fetch);

    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/projects\/demo-estudo360-audit\/accounts\?key=/);
    assert.equal(calls[0].body.password, 'Teste12345!');
    assert.equal(calls[0].body.rawPassword, undefined);
    assert.match(calls[1].url, /\/accounts:update\?key=/);
    assert.match(String(calls[1].body.customAttributes), /employeeOnly/);
  });

  it('produz custom token sem assinatura no emulador e com claims esperadas', async () => {
    const token = await createEmployeeCustomToken(emulatorEnv, 'emp_123', {
      employeeOnly: true,
      credentialId: 'cred_123',
      gabineteId: 'gab_1',
    });
    const [header, payload, signature] = token.split('.');
    assert.equal(signature, '');
    assert.equal(decodePart(header).alg, 'none');
    const claims = decodePart(payload).claims as Record<string, unknown>;
    assert.equal(claims.employeeOnly, true);
    assert.equal(claims.credentialId, 'cred_123');
    assert.equal(claims.gabineteId, 'gab_1');
  });

  it('valida password pela API do emulador', async () => {
    const fakeFetch = async (input: string | URL | Request) => {
      assert.match(String(input), /accounts:signInWithPassword\?key=test-key/);
      return new Response(JSON.stringify({
        localId: 'emp_123',
        email: 'employee+emp_123@auth.estudo360.pt',
        idToken: 'id-token',
      }), { status: 200 });
    };
    const result = await signInAuthPassword(
      emulatorEnv,
      'employee+emp_123@auth.estudo360.pt',
      'Teste12345!',
      fakeFetch as typeof fetch,
    );
    assert.deepEqual(result, {
      uid: 'emp_123',
      email: 'employee+emp_123@auth.estudo360.pt',
      idToken: 'id-token',
    });
  });

  it('não transforma falha de rede em password errada', async () => {
    const offline = async () => { throw new Error('offline'); };
    await assert.rejects(
      signInAuthPassword(
        emulatorEnv,
        'employee+emp_123@auth.estudo360.pt',
        'Teste12345!',
        offline as typeof fetch,
      ),
      /Auth Admin/,
    );
  });

  it('converte documentos Firestore sem alterar números e mapas', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : {} });
      if (init?.method === 'PATCH') return new Response('{}', { status: 200 });
      return new Response(JSON.stringify({
        updateTime: '2026-11-02T10:00:00Z',
        fields: {
          nome: { stringValue: 'Gabinete QA' },
          ativo: { booleanValue: true },
          total: { integerValue: '42' },
          tags: { arrayValue: { values: [{ stringValue: 'a' }, { stringValue: 'b' }] } },
          config: { mapValue: { fields: { limite: { integerValue: '7' } } } },
        },
      }), { status: 200 });
    };

    await patchFirestoreDoc(emulatorEnv, 'gabinetes/gab_1', {
      nome: 'Gabinete QA',
      ativo: true,
      total: 42,
      tags: ['a', 'b'],
      config: { limite: 7 },
    }, {}, fakeFetch as typeof fetch);
    assert.match(calls[0].url, /127\.0\.0\.1:8180\/v1\/projects\/demo-estudo360-audit/);
    const fields = (calls[0].body.fields as Record<string, Record<string, unknown>>);
    assert.deepEqual(fields.total, { integerValue: '42' });
    assert.deepEqual(fields.config, { mapValue: { fields: { limite: { integerValue: '7' } } } });

    const doc = await getFirestoreDoc<Record<string, unknown>>(emulatorEnv, 'gabinetes/gab_1', fakeFetch as typeof fetch);
    assert.deepEqual(doc?.data, {
      nome: 'Gabinete QA',
      ativo: true,
      total: 42,
      tags: ['a', 'b'],
      config: { limite: 7 },
    });
    assert.equal(doc?.updateTime, '2026-11-02T10:00:00Z');
  });

  it('atualiza UIDs com transformação atómica append/remove', async () => {
    let body: Record<string, any> = {};
    const fakeFetch = async (_input: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body || '{}'));
      return new Response('{}', { status: 200 });
    };
    await commitFirestoreFields(
      emulatorEnv,
      'gabinetes/gab_1',
      {
        members: {
          emp_1: { role: 'contabilista', email: 'ana@empresa.pt', addedAt: 1 },
        },
        updatedAt: 2,
      },
      ['updatedAt', 'members.emp_1'],
      [{ fieldPath: 'memberUids', append: ['emp_1'], remove: ['emp_old'] }],
      fakeFetch as typeof fetch,
    );
    const write = body.writes[0];
    assert.deepEqual(write.updateMask.fieldPaths, ['updatedAt', 'members.emp_1']);
    assert.deepEqual(write.updateTransforms[0], {
      fieldPath: 'memberUids',
      appendMissingElements: { values: [{ stringValue: 'emp_1' }] },
      removeAllFromArray: { values: [{ stringValue: 'emp_old' }] },
    });
    assert.match(write.update.name, /projects\/demo-estudo360-audit\/databases\/\(default\)\/documents\/gabinetes\/gab_1$/);
  });
});

describe('Service Account JWT', () => {
  it('troca uma assinatura RS256 por OAuth e usa o access token no lookup', async () => {
    const { env, publicKey } = serviceAccountEnv(`oauth${Date.now()}`);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(JSON.stringify({ access_token: 'oauth-token', expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({
        users: [{ localId: 'uid-1', email: 'ana@empresa.pt', customAttributes: '{}' }],
      }), { status: 200 });
    };

    const user = await lookupAuthByEmail(env, 'ana@empresa.pt', fakeFetch as typeof fetch);
    assert.equal(user?.uid, 'uid-1');
    assert.equal(calls.length, 2);
    const body = new URLSearchParams(String(calls[0].init?.body));
    const assertion = body.get('assertion') || '';
    const [header, payload, signature] = assertion.split('.');
    assert.equal(decodePart(header).alg, 'RS256');
    const claims = decodePart(payload);
    assert.equal(claims.iss, `qa-${env.FIREBASE_PROJECT_ID.slice(5)}@demo.iam.gserviceaccount.com`);
    assert.match(String(claims.scope), /cloud-platform/);
    const valid = verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
    );
    assert.equal(valid, true);
    assert.equal(new Headers(calls[1].init?.headers).get('Authorization'), 'Bearer oauth-token');
  });

  it('assina custom tokens de produção com a chave da conta de serviço', async () => {
    const { env, publicKey } = serviceAccountEnv(`custom${Date.now()}`);
    const token = await createEmployeeCustomToken(env, 'emp_9', {
      employeeOnly: true,
      credentialId: 'cred_9',
      gabineteId: 'gab_9',
    });
    const [header, payload, signature] = token.split('.');
    const valid = verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
    );
    assert.equal(valid, true);
    assert.equal(decodePart(payload).uid, 'emp_9');
  });
});
