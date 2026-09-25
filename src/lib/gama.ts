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
  office: { nome?: string; nif?: string; morada?: string; localidade?: string; codigoPostal?: string; email?: string; telefone?: string; website?: string; cedulaProfissional?: string; numeroInscricaoOCC?: string; tipo?: string; anoFundacao?: number; historia?: string },
  honorarios?: { baseMensal?: Record<string, number>; taxaIVA?: number },
  cliente?: { nome?: string; nif?: string },
): string {
  const o = office || {};
  const h = honorarios || {};
  const lines: string[] = [];
  // Estrutura de onboarding: apresentação e história primeiro, preço só no fim.
  // Tom formal (você), simples, sem jargão.
  const paraQuem = cliente?.nome ? `, ${cliente.nome}` : '';
  lines.push(`# Bem-vindo${paraQuem} — ${o.nome || 'o nosso escritório'}`);
  lines.push('');
  lines.push(`Uma breve apresentação de quem somos, como trabalhamos e o que propomos para si.`);
  lines.push('');
  lines.push('## Quem somos');
  if (o.historia?.trim()) {
    lines.push(o.historia.trim());
  } else {
    lines.push(`${o.nome || 'O nosso escritório'} é um escritório de contabilidade certificado em Portugal. Acompanhamos empresas e empresários em nome individual com proximidade e rigor — da contabilidade do dia a dia ao planeamento fiscal.`);
  }
  if (o.anoFundacao) lines.push(`A acompanhar clientes desde ${o.anoFundacao}.`);
  lines.push('');
  lines.push('## Como trabalhamos');
  lines.push('- Cada cliente tem um responsável dedicado — fala sempre com a mesma pessoa.');
  lines.push('- Avisamos antes dos prazos, para nunca pagar multas por esquecimento.');
  lines.push('- Explicamos tudo por palavras simples, sem termos complicados.');
  lines.push('- Vê todos os meses o que já está feito e o que ainda falta.');
  lines.push('');
  lines.push('## O que fazemos por si');
  lines.push('- Contabilidade organizada e simplificada');
  lines.push('- Salários e Segurança Social');
  lines.push('- IVA e obrigações fiscais');
  lines.push('- Ajudamos a decidir: recibos verdes ou empresa (ENI vs Lda)');
  lines.push('- Relatórios claros e encerramento de contas');
  lines.push('');
  if (cliente?.nome) {
    lines.push(`## A nossa proposta para si${cliente.nif ? ` (${cliente.nome}, NIF ${cliente.nif})` : ''}`);
    lines.push('Inclui enquadramento fiscal, calendário de obrigações e acompanhamento contínuo ao longo do ano.');
    lines.push('');
  }
  lines.push('## Honorários');
  lines.push('Só agora, no fim: quanto custa. Sem surpresas.');
  if (h.baseMensal && Object.keys(h.baseMensal).length) {
    const ivaPct = h.taxaIVA != null ? ` (IVA ${Math.round((h.taxaIVA as number)*100)}% não incluído)` : '';
    lines.push(`Valores mensais por tipo de entidade${ivaPct}:`);
    for (const [k, v] of Object.entries(h.baseMensal)) {
      if (typeof v === 'number' && v > 0) lines.push(`- ${k}: ${new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(v as number)}/mês`);
    }
  } else {
    lines.push('Proposta personalizada — ver valores detalhados no dossiê do cliente.');
  }
  lines.push('');
  lines.push('## Próximos passos');
  lines.push('1. Responda a esta proposta — basta um email ou telefonema.');
  lines.push('2. Envia-nos o NIF e tratamos de tudo a partir daí.');
  const contacto = [o.email, o.telefone].filter(Boolean).join(' · ') || '—';
  lines.push(`Contacto: ${contacto}${o.website ? ` · ${o.website}` : ''}`);
  lines.push(`Sede: ${[o.morada, o.codigoPostal, o.localidade].filter(Boolean).join(', ') || '—'}`);
  const ced = o.cedulaProfissional ? ` · Cédula: ${o.cedulaProfissional}` : '';
  const occ = o.numeroInscricaoOCC ? ` · OCC: ${o.numeroInscricaoOCC}` : '';
  lines.push(`NIF: ${o.nif || '—'}${ced}${occ}`);
  lines.push('');
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
