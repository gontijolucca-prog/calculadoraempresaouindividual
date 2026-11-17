// Documentos por cliente — armazenamento privado no VPS (media.pontofinal.site).
// O token do Firebase vai em cada pedido; o servidor só mostra ficheiros da própria conta.
import { auth } from './firebase';

const BASE = ((import.meta as any)?.env?.VITE_DOCS_API as string | undefined)
  || 'https://media.pontofinal.site/docs-api';

async function cabecalhoAuth(): Promise<HeadersInit> {
  const u = auth.currentUser;
  if (!u) throw new Error('Sessão expirada — entra outra vez.');
  const token = await u.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export type DocumentoEnviado = { path: string; nome: string; tamanho: number };

export async function enviarDocumento(file: File): Promise<DocumentoEnviado> {
  const r = await fetch(`${BASE}/upload?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { ...(await cabecalhoAuth()), 'Content-Type': 'application/octet-stream' },
    body: file,
  });
  if (r.status === 401) throw new Error('Sessão expirada — entra outra vez.');
  if (r.status === 415) throw new Error('Tipo de ficheiro não permitido (PDF, imagens, Excel, Word, CSV, XML, ZIP).');
  if (r.status === 413) throw new Error('Ficheiro demasiado grande (máximo 25 MB).');
  if (!r.ok) throw new Error(`Falha no envio (${r.status}).`);
  return await r.json() as DocumentoEnviado;
}

export async function descarregarDocumento(path: string, nome?: string): Promise<void> {
  const r = await fetch(`${BASE}/file?path=${encodeURIComponent(path)}`, { headers: await cabecalhoAuth() });
  if (!r.ok) throw new Error(`Não consegui abrir o documento (${r.status}).`);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome || path.split('/').pop() || 'documento';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function apagarDocumentoRemoto(path: string): Promise<void> {
  const r = await fetch(`${BASE}/file?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: await cabecalhoAuth(),
  });
  if (!r.ok && r.status !== 404) throw new Error(`Não consegui apagar o ficheiro (${r.status}).`);
}
