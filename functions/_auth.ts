const FIREBASE_KEY = 'AIzaSyChJKEBjPKZcRVF4R_n07UoUB9QO0q_EzM';

export interface FirebaseUser {
  uid: string;
  email: string;
}

export function bearerToken(request: Request): string {
  const raw = String(request.headers.get('Authorization') || '').trim();
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  return match?.[1]?.trim() || '';
}

/**
 * Valida um Firebase ID token no Google Identity Toolkit.
 * O token tem de vir no header Authorization: Bearer <idToken>.
 */
export async function verifyFirebaseRequest(
  request: Request,
  env: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<FirebaseUser | null> {
  const idToken = bearerToken(request);
  if (!idToken) return null;
  try {
    const key = String(env.FIREBASE_API_KEY || FIREBASE_KEY);
    const emulator = String(env.FIREBASE_AUTH_EMULATOR_HOST || '')
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');
    const base = emulator
      ? `http://${emulator}/identitytoolkit.googleapis.com/v1`
      : 'https://identitytoolkit.googleapis.com/v1';
    const res = await fetchImpl(
      `${base}/accounts:lookup?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as { users?: Array<{ localId?: string; email?: string }> };
    const user = data.users?.[0];
    if (!user?.localId) return null;
    return { uid: user.localId, email: String(user.email || '') };
  } catch {
    return null;
  }
}
