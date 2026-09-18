/**
 * Integração Gama — geração de apresentações via Gamma API v1 (public-api.gamma.app)
 * Docs: gamma-app/gamma-docs (endpoints create-generation / get-generation-status)
 * Fluxo async: POST /v0.2/generations -> {id} -> poll GET /v0.2/generations/:id até completed -> gammaUrl
 */

export type GamaStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GamaCreateResponse {
  id?: string;
  generationId?: string;
  status?: string;
}

export interface GamaStatusResponse {
  id?: string;
  status: GamaStatus | string;
  gammaUrl?: string;
  exportUrl?: string;
  webUrl?: string;
  error?: string;
}

const GAMMA_API_BASE = 'https://public-api.gamma.app';
const GAMMA_CREATE_PATH = '/v0.2/generations';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;

function resolveApiKey(explicit?: string): string {
  const envKey = (import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_GAMMA_API_KEY as string | undefined;
  return (explicit?.trim() || envKey?.trim() || '').trim();
}

export function isGamaConfigured(explicit?: string): boolean {
  return !!resolveApiKey(explicit);
}

export function buildGamaPrompt(
  office: { nome?: string; nif?: string; morada?: string; localidade?: string; codigoPostal?: string; email?: string; telefone?: string; website?: string; cedulaProfissional?: string; numeroInscricaoOCC?: string; tipo?: string },
  honorarios?: { baseMensal?: Record<string, number>; taxaIVA?: number },
  cliente?: { nome?: string; nif?: string },
): string {
  const o = office || {};
  const h = honorarios || {};
  const lines: string[] = [];
  lines.push(`# Apresentação do escritório ${o.nome || '—'}`);
  lines.push('');
  lines.push(`Sede: ${[o.morada, o.codigoPostal, o.localidade].filter(Boolean).join(', ') || '—'}`);
  const ced = o.cedulaProfissional ? ` · Cédula: ${o.cedulaProfissional}` : '';
  const occ = o.numeroInscricaoOCC ? ` · OCC: ${o.numeroInscricaoOCC}` : '';
  lines.push(`NIF: ${o.nif || '—'}${ced}${occ}`);
  const contacto = [o.email, o.telefone].filter(Boolean).join(' · ') || '—';
  lines.push(`Contacto: ${contacto}${o.website ? ` · ${o.website}` : ''}`);
  lines.push('');
  lines.push('## Quem somos');
  lines.push(`${o.nome || 'O nosso escritório'} é um escritório de contabilidade certificado em Portugal. Acompanhamos empresas e ENIs com análise, estratégia e decisão — da contabilidade corrente ao planeamento fiscal.`);
  lines.push('');
  lines.push('## Serviços');
  lines.push('- Contabilidade organizada e simplificada');
  lines.push('- Processamento salarial e Segurança Social');
  lines.push('- Apuramento de IVA e obrigações fiscais');
  lines.push('- Planeamento fiscal e enquadramento (ENI vs Lda)');
  lines.push('- Apoio SAF-T, relatórios e encerramento de contas');
  lines.push('');
  lines.push('## Honorários (indicativo)');
  if (h.baseMensal && Object.keys(h.baseMensal).length) {
    const ivaPct = h.taxaIVA != null ? ` (IVA ${Math.round((h.taxaIVA as number)*100)}% não incluído)` : '';
    lines.push(`Tabela base mensal por tipo de entidade${ivaPct}:`);
    for (const [k, v] of Object.entries(h.baseMensal)) {
      if (typeof v === 'number' && v > 0) lines.push(`- ${k}: ${new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(v as number)}/mês`);
    }
  } else {
    lines.push('Tabela de honorários personalizada — ver proposta detalhada no dossiê do cliente.');
  }
  lines.push('');
  lines.push('## Porquê nós');
  lines.push('- Resposta rápida e acompanhamento próximo');
  lines.push('- Relatórios claros e simuladores Estudo 360°');
  lines.push('- Foco em poupança fiscal legal e tranquilidade do cliente');
  lines.push('');
  if (cliente?.nome) {
    lines.push(`## Proposta para ${cliente.nome}${cliente.nif ? ` (NIF ${cliente.nif})` : ''}`);
    lines.push('Inclui enquadramento fiscal, calendário de obrigações e acompanhamento contínuo.');
    lines.push('');
  }
  lines.push('---');
  lines.push('_Proposta gerada no Estudo 360° — conteúdo editável no Gama._');
  return lines.join('\n');
}

export async function createGamaPresentation(inputText: string, apiKeyExplicit?: string): Promise<{ generationId: string }> {
  const apiKey = resolveApiKey(apiKeyExplicit);
  if (!apiKey) throw new Error('Gama API key em falta. Configura em Definições do Escritório ou VITE_GAMMA_API_KEY.');
  const res = await fetch(`${GAMMA_API_BASE}${GAMMA_CREATE_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputText,
      textMode: 'generate',
      format: 'presentation',
      cardOptions: { dimensions: '16x9' },
      sharingOptions: { workspaceAccess: 'view' },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    throw new Error(`Gama create falhou (${res.status}): ${txt.slice(0,500)}`);
  }
  const data = await res.json() as GamaCreateResponse & Record<string, unknown>;
  const id = (data.generationId || data.id || (data as unknown as { generation_id?: string }).generation_id || '') as string;
  if (!id) throw new Error('Gama: resposta sem generationId');
  return { generationId: String(id) };
}

export async function getGamaGenerationStatus(generationId: string, apiKeyExplicit?: string): Promise<GamaStatusResponse> {
  const apiKey = resolveApiKey(apiKeyExplicit);
  if (!apiKey) throw new Error('Gama API key em falta');
  const res = await fetch(`${GAMMA_API_BASE}${GAMMA_CREATE_PATH}/${encodeURIComponent(generationId)}`, {
    headers: {
      'X-API-KEY': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    throw new Error(`Gama status falhou (${res.status}): ${txt.slice(0,500)}`);
  }
  const data = await res.json() as GamaStatusResponse;
  return data;
}

export async function pollGamaGeneration(generationId: string, apiKeyExplicit?: string, opts?: { intervalMs?: number; timeoutMs?: number }): Promise<GamaStatusResponse> {
  const interval = opts?.intervalMs ?? POLL_INTERVAL_MS;
  const timeout = opts?.timeoutMs ?? POLL_TIMEOUT_MS;
  const t0 = Date.now();
  while (true) {
    const st = await getGamaGenerationStatus(generationId, apiKeyExplicit);
    const s = String(st.status || '').toLowerCase();
    if (s === 'completed' || s === 'complete' || s === 'done' || st.gammaUrl || st.exportUrl || st.webUrl) return st;
    if (s === 'failed' || s === 'error') throw new Error(st.error || 'Gama: geração falhou');
    if (Date.now() - t0 > timeout) throw new Error('Gama: timeout a aguardar geração (tenta abrir o Gama manualmente)');
    await new Promise(r => setTimeout(r, interval));
  }
}

export async function generateGamaPresentation(inputText: string, apiKeyExplicit?: string, opts?: { intervalMs?: number; timeoutMs?: number }): Promise<GamaStatusResponse & { generationId: string }> {
  const { generationId } = await createGamaPresentation(inputText, apiKeyExplicit);
  const final = await pollGamaGeneration(generationId, apiKeyExplicit, opts);
  return { ...final, generationId };
}

export function resolveGamaUrl(status: GamaStatusResponse): string | null {
  return (status.gammaUrl || status.exportUrl || status.webUrl || null) as string | null;
}
